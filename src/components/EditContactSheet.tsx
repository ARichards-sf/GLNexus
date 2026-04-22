import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUpdateContact, type MemberRow } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const contactSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(100),
  last_name: z.string().trim().min(1, "Required").max(100),
  relationship: z.string().min(1, "Required"),
  email: z.string().trim().email("Invalid email").max(255).or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
  date_of_birth: z.string().optional(),
  company: z.string().trim().max(200).optional(),
  job_title: z.string().trim().max(200).optional(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: MemberRow;
}

export default function EditContactSheet({ open, onOpenChange, contact }: Props) {
  const updateContact = useUpdateContact();
  const { toast } = useToast();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      relationship: contact.relationship,
      email: contact.email || "",
      phone: contact.phone || "",
      date_of_birth: contact.date_of_birth || "",
      company: contact.company || "",
      job_title: contact.job_title || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        first_name: contact.first_name,
        last_name: contact.last_name,
        relationship: contact.relationship,
        email: contact.email || "",
        phone: contact.phone || "",
        date_of_birth: contact.date_of_birth || "",
        company: contact.company || "",
        job_title: contact.job_title || "",
      });
    }
  }, [open, contact]);

  const onSubmit = async (values: ContactFormValues) => {
    try {
      await updateContact.mutateAsync({
        id: contact.id,
        data: {
          ...values,
          email: values.email || null,
          phone: values.phone || null,
          date_of_birth: values.date_of_birth || null,
          company: values.company || null,
          job_title: values.job_title || null,
        },
      });
      toast({ title: "Contact updated" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Contact</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
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
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
            <FormField control={form.control} name="company" render={({ field }) => (
              <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="job_title" render={({ field }) => (
              <FormItem><FormLabel>Job Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={updateContact.isPending}>
              {updateContact.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
