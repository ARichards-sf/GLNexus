import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAllContacts } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, UserPlus, Search } from "lucide-react";
import { embedRecord } from "@/lib/embedRecord";

const step1Schema = z.object({
  name: z.string().trim().min(1, "Required").max(200),
  risk_tolerance: z.string().min(1, "Required"),
  wealth_tier: z.string().min(1, "Required"),
  investment_objective: z.string().trim().max(500).optional(),
});

const newMemberSchema = z.object({
  first_name: z.string().trim().min(1, "Required").max(100),
  last_name: z.string().trim().min(1, "Required").max(100),
  email: z.string().trim().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().trim().max(30).optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type NewMemberValues = z.infer<typeof newMemberSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateHouseholdDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allContacts = [] } = useAllContacts();
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [memberMode, setMemberMode] = useState<"select" | "create">("select");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const unassignedContacts = allContacts.filter((c) => !c.household_id);
  const filteredContacts = unassignedContacts.filter((c) =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", risk_tolerance: "", wealth_tier: "", investment_objective: "" },
  });

  const newMemberForm = useForm<NewMemberValues>({
    resolver: zodResolver(newMemberSchema),
    defaultValues: { first_name: "", last_name: "", email: "", phone: "" },
  });

  const handleStep1 = (values: Step1Values) => {
    setStep1Data(values);
    setStep(2);
  };

  const resetDialog = () => {
    setStep(1);
    setStep1Data(null);
    setMemberMode("select");
    setSelectedContactId(null);
    setSearchTerm("");
    step1Form.reset();
    newMemberForm.reset();
  };

  const handleSubmit = async (newMember?: NewMemberValues) => {
    if (!step1Data || !user) return;
    setSubmitting(true);
    try {
      const { data: household, error: hhError } = await supabase
        .from("households")
        .insert({
          name: step1Data.name,
          risk_tolerance: step1Data.risk_tolerance,
          wealth_tier: step1Data.wealth_tier,
          investment_objective: step1Data.investment_objective || null,
          advisor_id: user.id,
        })
        .select()
        .single();
      if (hhError) throw hhError;

      if (household && user) {
        embedRecord("households", household, user.id);
      }

      if (selectedContactId) {
        await supabase
          .from("household_members")
          .update({ household_id: household.id, relationship: "Head of Household" })
          .eq("id", selectedContactId);
      } else if (newMember) {
        await supabase.from("household_members").insert({
          household_id: household.id,
          first_name: newMember.first_name,
          last_name: newMember.last_name,
          email: newMember.email || null,
          phone: newMember.phone || null,
          relationship: "Head of Household",
          advisor_id: user.id,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["households"] });
      queryClient.invalidateQueries({ queryKey: ["all_contacts"] });
      toast({ title: "Household created" });
      resetDialog();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 1 ? "Create Household" : "Add Head of Household"}</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Enter the core household information." : "Assign or create the primary contact."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-1.5 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-secondary"}`} />
          <div className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-secondary"}`} />
        </div>

        {step === 1 && (
          <Form {...step1Form}>
            <form onSubmit={step1Form.handleSubmit(handleStep1)} className="space-y-4">
              <FormField control={step1Form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Household Name</FormLabel><FormControl><Input placeholder="The Richards Family" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={step1Form.control} name="risk_tolerance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Tolerance</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Conservative">Conservative</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Moderate-Aggressive">Moderate-Aggressive</SelectItem>
                      <SelectItem value="Aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={step1Form.control} name="wealth_tier" render={({ field }) => (
                <FormItem>
                  <FormLabel>Wealth Tier</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Mass Affluent">Mass Affluent</SelectItem>
                      <SelectItem value="HNW">High Net Worth</SelectItem>
                      <SelectItem value="UHNW">Ultra High Net Worth</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={step1Form.control} name="investment_objective" render={({ field }) => (
                <FormItem><FormLabel>Investment Objective</FormLabel><FormControl><Input placeholder="Long-term Growth with Income" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full">
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          </Form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={memberMode === "select" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMemberMode("select"); setSelectedContactId(null); }}
              >
                Assign Existing
              </Button>
              <Button
                variant={memberMode === "create" ? "default" : "outline"}
                size="sm"
                onClick={() => { setMemberMode("create"); setSelectedContactId(null); }}
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Create New
              </Button>
            </div>

            {memberMode === "select" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search unassigned contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-1">
                  {filteredContacts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No unassigned contacts found</p>
                  )}
                  {filteredContacts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContactId(c.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedContactId === c.id
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-secondary/60 text-muted-foreground"
                      }`}
                    >
                      <span className="font-medium">{c.first_name} {c.last_name}</span>
                      {selectedContactId === c.id && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={() => handleSubmit()}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "Creating..." : selectedContactId ? "Create Household" : "Skip & Create"}
                  </Button>
                </div>
              </div>
            )}

            {memberMode === "create" && (
              <Form {...newMemberForm}>
                <form onSubmit={newMemberForm.handleSubmit((v) => handleSubmit(v))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={newMemberForm.control} name="first_name" render={({ field }) => (
                      <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={newMemberForm.control} name="last_name" render={({ field }) => (
                      <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={newMemberForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={newMemberForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button type="submit" disabled={submitting} className="flex-1">
                      {submitting ? "Creating..." : "Create Household"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
