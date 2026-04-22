import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useCreateMember } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

const memberSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(100),
  last_name: z.string().trim().min(1, "Required").max(100),
  relationship: z.string().min(1, "Required"),
  email: z.string().trim().email("Invalid email").max(255).or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  date_of_birth: z.string().optional(),
  company: z.string().trim().max(200).optional(),
  job_title: z.string().trim().max(200).optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
}

export default function AddMemberDialog({ open, onOpenChange, householdId }: Props) {
  const createMember = useCreateMember();
  const { toast } = useToast();

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      first_name: "", last_name: "", relationship: "", email: "", phone: "", date_of_birth: "", company: "", job_title: "",
    },
  });

  const onSubmit = async (values: MemberFormValues) => {
    try {
      await createMember.mutateAsync({
        household_id: householdId,
        first_name: values.first_name,
        last_name: values.last_name,
        relationship: values.relationship,
        email: values.email || null,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth || null,
        company: values.company || null,
        job_title: values.job_title || null,
      });
      toast({ title: "Member added" });
      form.reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Family Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="relationship" render={({ field }) => (
              <FormItem>
                <FormLabel>Relationship</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Primary">Primary</SelectItem>
                    <SelectItem value="Spouse">Spouse</SelectItem>
                    <SelectItem value="Dependent">Dependent</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="date_of_birth" render={({ field }) => (
              <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="company" render={({ field }) => (
                <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="job_title" render={({ field }) => (
                <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <Button type="submit" className="w-full" disabled={createMember.isPending}>
              {createMember.isPending ? "Adding..." : "Add Member"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
