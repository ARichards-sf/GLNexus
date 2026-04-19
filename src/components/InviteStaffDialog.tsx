import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteInternalUser, useGlProfile } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

const ROLE_LABELS: Record<string, string> = {
  user:        "Standard User",
  manager:     "Manager",
  admin:       "Admin",
  super_admin: "Super Admin",
  developer:   "Developer",
};

const DEPARTMENTS = [
  { value: "vpm",         label: "VPM" },
  { value: "wam",         label: "WAM" },
  { value: "marketing",   label: "Marketing" },
  { value: "transitions", label: "Transitions" },
  { value: "compliance",  label: "Compliance" },
  { value: "accounting",  label: "Accounting" },
  { value: "operations",  label: "Operations" },
];

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(200),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function InviteStaffDialog({ open, onOpenChange }: Props) {
  const invite = useInviteInternalUser();
  const { toast } = useToast();
  const { data: myProfile } = useGlProfile();

  const myRole = myProfile?.platform_role || "user";
  const isSuperAdmin = myRole === "super_admin";
  const isAdmin = myRole === "admin";

  const assignableRoles = (() => {
    if (isSuperAdmin) return ["user", "manager", "admin", "super_admin", "developer"];
    if (isAdmin) return ["user", "manager"];
    return ["user"];
  })();

  const [role, setRole] = useState<string>("user");
  const [department, setDepartment] = useState<string>("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "" },
  });

  const onSubmit = async (values: Values) => {
    if (!role) {
      toast({ title: "Platform role is required", variant: "destructive" });
      return;
    }
    try {
      await invite.mutateAsync({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        platform_role: role,
        department: department || undefined as any,
      });
      toast({
        title: "Staff member invited",
        description: `${values.full_name} has been added.`,
      });
      form.reset();
      setRole("user");
      setDepartment("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>Provision a new GL internal staff account.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jane@goodlife.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min 8 characters" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-2">
              <Label>Platform Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "user" && "Standard access — sees their department tools only"}
                {role === "manager" && "Can view their team and department tools"}
                {role === "admin" && "Cross-department access, manages users and firms"}
                {role === "super_admin" && "Full platform access — assign with care"}
                {role === "developer" && "Full access including data deletion tools"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Department controls which feature queues the user can access
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={invite.isPending}>
              {invite.isPending ? "Provisioning..." : "Invite Staff Member"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
