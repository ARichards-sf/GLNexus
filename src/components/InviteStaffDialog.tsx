import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteInternalUser } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS = ["vpm", "wam", "marketing", "transitions", "compliance", "accounting"] as const;
const ROLES = ["admin", "super_admin"] as const;

const DEPT_LABELS: Record<typeof DEPARTMENTS[number], string> = {
  vpm: "VPM",
  wam: "WAM",
  marketing: "Marketing",
  transitions: "Transitions",
  compliance: "Compliance",
  accounting: "Accounting",
};

const ROLE_LABELS: Record<typeof ROLES[number], string> = {
  admin: "Admin",
  super_admin: "Super Admin",
};

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(200),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "At least 8 characters"),
  department: z.enum(DEPARTMENTS),
  platform_role: z.enum(ROLES),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function InviteStaffDialog({ open, onOpenChange }: Props) {
  const invite = useInviteInternalUser();
  const { toast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", department: undefined as any, platform_role: undefined as any },
  });

  const onSubmit = async (values: Values) => {
    try {
      await invite.mutateAsync({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        department: values.department,
        platform_role: values.platform_role,
      });
      toast({
        title: "Staff member invited",
        description: `${values.full_name} has been added.`,
      });
      form.reset();
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
            <FormField control={form.control} name="department" render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>{DEPT_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="platform_role" render={({ field }) => (
              <FormItem>
                <FormLabel>Platform Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={invite.isPending}>
              {invite.isPending ? "Provisioning..." : "Invite Staff Member"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
