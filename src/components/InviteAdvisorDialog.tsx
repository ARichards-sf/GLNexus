import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useInviteAdvisor } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(200),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(6, "At least 6 characters"),
  office_location: z.string().trim().max(200).optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function InviteAdvisorDialog({ open, onOpenChange }: Props) {
  const invite = useInviteAdvisor();
  const { toast } = useToast();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: "", email: "", password: "", office_location: "" },
  });

  const onSubmit = async (values: Values) => {
    try {
      await invite.mutateAsync({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        office_location: values.office_location,
      });
      toast({
        title: "Advisor provisioned",
        description: "Advisor profile created and provisioned.",
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
            <Button type="submit" className="w-full" disabled={invite.isPending}>
              {invite.isPending ? "Provisioning..." : "Add Advisor"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
