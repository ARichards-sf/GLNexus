import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useInviteAdvisor } from "@/hooks/useAdmin";
import { useFirms } from "@/hooks/useFirms";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(200),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
  office_location: z.string().trim().max(200).optional(),
  firm_id: z.string().min(1, "Please select a firm"),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFirmId?: string;
}

export default function InviteAdvisorDialog({ open, onOpenChange, defaultFirmId }: Props) {
  const invite = useInviteAdvisor();
  const { data: firms = [] } = useFirms();
  const { toast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      office_location: "",
      firm_id: defaultFirmId ?? "",
    },
    values: defaultFirmId
      ? { full_name: "", email: "", password: "", office_location: "", firm_id: defaultFirmId }
      : undefined,
  });

  const lockedFirm = defaultFirmId ? firms.find((f) => f.id === defaultFirmId) : undefined;

  const onSubmit = async (values: Values) => {
    try {
      await invite.mutateAsync({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        office_location: values.office_location,
        firm_id: values.firm_id,
      });
      toast({
        title: "Advisor provisioned",
        description: "Advisor profile created and provisioned.",
      });
      form.reset({
        full_name: "",
        email: "",
        password: "",
        office_location: "",
        firm_id: defaultFirmId ?? "",
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Advisor</DialogTitle>
          <DialogDescription>Provision a new advisor account. They will receive an email to set their password.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="jane@firm.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min 6 characters" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="office_location" render={({ field }) => (
              <FormItem><FormLabel>Office Location</FormLabel><FormControl><Input placeholder="New York, NY" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            {defaultFirmId ? (
              <FormItem>
                <FormLabel>Firm *</FormLabel>
                <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground">
                  {lockedFirm?.name ?? "Selected firm"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Advisor will be assigned to this firm
                </p>
              </FormItem>
            ) : (
              <FormField
                control={form.control}
                name="firm_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Firm *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a firm" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {firms
                          .filter((f) => !f.is_gl_internal)
                          .map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full" disabled={invite.isPending}>
              {invite.isPending ? "Provisioning..." : "Add Advisor"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
