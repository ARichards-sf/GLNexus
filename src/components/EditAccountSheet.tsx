import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useUpdateAccount, type AccountRow } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

const ACCOUNT_TYPES = ["401k", "IRA", "Roth IRA", "Brokerage", "Savings", "Checking", "529 Plan"];

const schema = z.object({
  account_name: z.string().trim().min(1, "Required").max(200),
  account_type: z.string().min(1, "Required"),
  account_number: z.string().trim().max(30).optional(),
  balance: z.coerce.number().min(0).optional(),
  institution: z.string().trim().max(200).optional(),
  account_registration: z.string().trim().max(200).optional(),
  account_class: z.string().trim().max(200).optional(),
  objective: z.string().trim().max(200).optional(),
  br_suitability: z.string().trim().max(200).optional(),
  tier_schedule: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountRow;
}

export default function EditAccountSheet({ open, onOpenChange, account }: Props) {
  const updateAccount = useUpdateAccount();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_name: account.account_name,
      account_type: account.account_type,
      account_number: account.account_number || "",
      balance: Number(account.balance) || 0,
      institution: account.institution || "",
      account_registration: account.account_registration || "",
      account_class: account.account_class || "",
      objective: account.objective || "",
      br_suitability: account.br_suitability || "",
      tier_schedule: account.tier_schedule || "",
      description: account.description || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        account_name: account.account_name,
        account_type: account.account_type,
        account_number: account.account_number || "",
        balance: Number(account.balance) || 0,
        institution: account.institution || "",
        account_registration: account.account_registration || "",
        account_class: account.account_class || "",
        objective: account.objective || "",
        br_suitability: account.br_suitability || "",
        tier_schedule: account.tier_schedule || "",
        description: account.description || "",
      });
    }
  }, [open, account]);

  const onSubmit = async (values: FormValues) => {
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        data: {
          ...values,
          balance: values.balance ?? 0,
          account_number: values.account_number || null,
          institution: values.institution || null,
          account_registration: values.account_registration || null,
          account_class: values.account_class || null,
          objective: values.objective || null,
          br_suitability: values.br_suitability || null,
          tier_schedule: values.tier_schedule || null,
          description: values.description || null,
        },
      });
      toast({ title: "Account updated" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit Account</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField control={form.control} name="account_name" render={({ field }) => (
              <FormItem><FormLabel>Financial Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="account_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="account_number" render={({ field }) => (
                <FormItem><FormLabel>Account # (last 4)</FormLabel><FormControl><Input maxLength={4} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="balance" render={({ field }) => (
                <FormItem><FormLabel>Balance</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="institution" render={({ field }) => (
                <FormItem><FormLabel>Institution</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="account_registration" render={({ field }) => (
              <FormItem><FormLabel>Account Registration</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="account_class" render={({ field }) => (
                <FormItem><FormLabel>Account Class</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="objective" render={({ field }) => (
                <FormItem><FormLabel>Objective</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="br_suitability" render={({ field }) => (
                <FormItem><FormLabel>B&R Suitability</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tier_schedule" render={({ field }) => (
                <FormItem><FormLabel>Tier Schedule</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={updateAccount.isPending}>
              {updateAccount.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
