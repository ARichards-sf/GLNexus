import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { User, Phone, Briefcase, DollarSign, Shield, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
}

const TABS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "contact", label: "Contact", icon: Phone },
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "financial", label: "Financial", icon: DollarSign },
  { id: "estate", label: "Estate", icon: Shield },
  { id: "professionals", label: "Professionals", icon: Users },
];

export default function EditContactSheet({ open, onOpenChange, contact }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    // Personal
    first_name: "",
    last_name: "",
    preferred_name: "",
    middle_name: "",
    date_of_birth: "",
    relationship: "",
    marital_status: "",
    number_of_dependents: "",
    citizenship: "",
    primary_goal: "",
    ssn_last_four: "",
    // Contact
    email: "",
    secondary_email: "",
    phone: "",
    mobile_phone: "",
    secondary_phone: "",
    preferred_contact: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    // Employment
    company: "",
    job_title: "",
    employment_status: "",
    annual_income: "",
    retirement_date: "",
    years_to_retirement: "",
    // Financial
    net_worth: "",
    liquid_net_worth: "",
    tax_bracket: "",
    filing_status: "",
    // Estate
    has_will: false,
    has_trust: false,
    has_poa: false,
    has_healthcare_directive: false,
    beneficiary_review_date: "",
    // Professionals
    estate_attorney: "",
    estate_attorney_phone: "",
    accountant: "",
    accountant_phone: "",
  });

  useEffect(() => {
    if (!contact || !open) return;
    setForm({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      preferred_name: contact.preferred_name || "",
      middle_name: contact.middle_name || "",
      date_of_birth: contact.date_of_birth || "",
      relationship: contact.relationship || "",
      marital_status: contact.marital_status || "",
      number_of_dependents:
        contact.number_of_dependents != null ? String(contact.number_of_dependents) : "",
      citizenship: contact.citizenship || "",
      primary_goal: contact.primary_goal || "",
      ssn_last_four: contact.ssn_last_four || "",
      email: contact.email || "",
      secondary_email: contact.secondary_email || "",
      phone: contact.phone || "",
      mobile_phone: contact.mobile_phone || "",
      secondary_phone: contact.secondary_phone || "",
      preferred_contact: contact.preferred_contact || "",
      address_line1: contact.address_line1 || "",
      address_line2: contact.address_line2 || "",
      city: contact.city || "",
      state: contact.state || "",
      zip_code: contact.zip_code || "",
      country: contact.country || "US",
      company: contact.company || "",
      job_title: contact.job_title || "",
      employment_status: contact.employment_status || "",
      annual_income: contact.annual_income ? String(contact.annual_income) : "",
      retirement_date: contact.retirement_date || "",
      years_to_retirement: contact.years_to_retirement
        ? String(contact.years_to_retirement)
        : "",
      net_worth: contact.net_worth ? String(contact.net_worth) : "",
      liquid_net_worth: contact.liquid_net_worth ? String(contact.liquid_net_worth) : "",
      tax_bracket: contact.tax_bracket || "",
      filing_status: contact.filing_status || "",
      has_will: contact.has_will || false,
      has_trust: contact.has_trust || false,
      has_poa: contact.has_poa || false,
      has_healthcare_directive: contact.has_healthcare_directive || false,
      beneficiary_review_date: contact.beneficiary_review_date || "",
      estate_attorney: contact.estate_attorney || "",
      estate_attorney_phone: contact.estate_attorney_phone || "",
      accountant: contact.accountant || "",
      accountant_phone: contact.accountant_phone || "",
    });
    setActiveTab("personal");
  }, [contact?.id, open]);

  const set = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!user || !contact) return;
    setSaving(true);
    try {
      await supabase
        .from("household_members")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          preferred_name: form.preferred_name || null,
          middle_name: form.middle_name || null,
          date_of_birth: form.date_of_birth || null,
          relationship: form.relationship,
          marital_status: form.marital_status || null,
          number_of_dependents: form.number_of_dependents
            ? Number(form.number_of_dependents)
            : 0,
          citizenship: form.citizenship || null,
          primary_goal: form.primary_goal || null,
          ssn_last_four: form.ssn_last_four || null,
          email: form.email || null,
          secondary_email: form.secondary_email || null,
          phone: form.phone || null,
          mobile_phone: form.mobile_phone || null,
          secondary_phone: form.secondary_phone || null,
          preferred_contact: form.preferred_contact || null,
          address_line1: form.address_line1 || null,
          address_line2: form.address_line2 || null,
          city: form.city || null,
          state: form.state || null,
          zip_code: form.zip_code || null,
          country: form.country || "US",
          company: form.company || null,
          job_title: form.job_title || null,
          employment_status: form.employment_status || null,
          annual_income: form.annual_income ? Number(form.annual_income) : null,
          retirement_date: form.retirement_date || null,
          years_to_retirement: form.years_to_retirement
            ? Number(form.years_to_retirement)
            : null,
          net_worth: form.net_worth ? Number(form.net_worth) : null,
          liquid_net_worth: form.liquid_net_worth ? Number(form.liquid_net_worth) : null,
          tax_bracket: form.tax_bracket || null,
          filing_status: form.filing_status || null,
          has_will: form.has_will,
          has_trust: form.has_trust,
          has_poa: form.has_poa,
          has_healthcare_directive: form.has_healthcare_directive,
          beneficiary_review_date: form.beneficiary_review_date || null,
          estate_attorney: form.estate_attorney || null,
          estate_attorney_phone: form.estate_attorney_phone || null,
          accountant: form.accountant || null,
          accountant_phone: form.accountant_phone || null,
        } as any)
        .eq("id", contact.id);

      queryClient.invalidateQueries({ queryKey: ["contact", contact.id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({
        queryKey: ["household-members", contact.household_id],
      });

      toast.success("Contact updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: string, label: string, placeholder = "", type = "text") => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input
        type={type}
        value={(form as any)[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );

  const selectField = (
    key: string,
    label: string,
    options: string[],
    placeholder = "Select",
  ) => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Select value={(form as any)[key]} onValueChange={(v) => set(key, v)}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const checkField = (key: string, label: string) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
      <Label className="text-sm text-foreground">{label}</Label>
      <Switch
        checked={(form as any)[key]}
        onCheckedChange={(v) => set(key, v)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            Edit Contact — {contact?.first_name} {contact?.last_name}
          </DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "personal" && (
            <div className="grid grid-cols-2 gap-4">
              {field("first_name", "First Name *", "First")}
              {field("last_name", "Last Name *", "Last")}
              {field("preferred_name", "Preferred Name", "Nickname")}
              {field("middle_name", "Middle Name", "Middle")}
              {field("date_of_birth", "Date of Birth", "", "date")}
              {selectField("relationship", "Relationship", [
                "Primary",
                "Spouse",
                "Dependent",
                "Other",
              ])}
              {selectField("marital_status", "Marital Status", [
                "Single",
                "Married",
                "Divorced",
                "Widowed",
                "Domestic Partner",
              ])}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Dependents
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.number_of_dependents}
                  onChange={(e) => set("number_of_dependents", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {selectField("citizenship", "Citizenship", [
                "US",
                "Non-US",
                "Dual Citizen",
                "Permanent Resident",
              ])}
              {selectField("primary_goal", "Primary Goal", [
                "Retirement Planning",
                "Wealth Accumulation",
                "Wealth Preservation",
                "Income Generation",
                "Education Funding",
                "Estate Planning",
                "Business Succession",
                "Tax Minimization",
              ])}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  SSN (Last 4 digits)
                </Label>
                <Input
                  value={form.ssn_last_four}
                  onChange={(e) =>
                    set("ssn_last_four", e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="####"
                  maxLength={4}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === "contact" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Email
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field("email", "Primary Email", "email@example.com")}
                  {field("secondary_email", "Secondary Email", "alt@example.com")}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Phone
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field("mobile_phone", "Mobile", "(555) 000-0000")}
                  {field("phone", "Home / Work", "(555) 000-0000")}
                  {field("secondary_phone", "Secondary", "(555) 000-0000")}
                  {selectField("preferred_contact", "Preferred Method", [
                    "Email",
                    "Phone",
                    "Text",
                    "Mail",
                  ])}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Address
                </p>
                <div className="space-y-3">
                  {field("address_line1", "Street Address", "123 Main St")}
                  {field("address_line2", "Apt / Suite", "Unit 4B")}
                  <div className="grid grid-cols-3 gap-3">
                    {field("city", "City", "City")}
                    {field("state", "State", "FL")}
                    {field("zip_code", "ZIP", "32701")}
                  </div>
                  {selectField("country", "Country", ["US", "Canada", "Other"])}
                </div>
              </div>
            </div>
          )}

          {activeTab === "employment" && (
            <div className="grid grid-cols-2 gap-4">
              {field("company", "Company / Employer", "Company name")}
              {field("job_title", "Job Title", "Title")}
              {selectField("employment_status", "Employment Status", [
                "Employed",
                "Self-Employed",
                "Retired",
                "Unemployed",
                "Student",
                "Homemaker",
              ])}
              {field("annual_income", "Annual Income", "0", "number")}
              {field("retirement_date", "Retirement Date", "", "date")}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Years to Retirement
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.years_to_retirement}
                  onChange={(e) => set("years_to_retirement", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {activeTab === "financial" && (
            <div className="grid grid-cols-2 gap-4">
              {field("net_worth", "Net Worth", "0", "number")}
              {field("liquid_net_worth", "Liquid Net Worth", "0", "number")}
              {selectField("tax_bracket", "Tax Bracket", [
                "10%",
                "12%",
                "22%",
                "24%",
                "32%",
                "35%",
                "37%",
              ])}
              {selectField("filing_status", "Filing Status", [
                "Single",
                "Married Filing Jointly",
                "Married Filing Separately",
                "Head of Household",
                "Qualifying Widow(er)",
              ])}
            </div>
          )}

          {activeTab === "estate" && (
            <div className="space-y-3">
              {checkField("has_will", "Last Will & Testament")}
              {checkField("has_trust", "Trust")}
              {checkField("has_poa", "Power of Attorney")}
              {checkField("has_healthcare_directive", "Healthcare Directive")}
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Beneficiary Review Date
                </Label>
                <Input
                  type="date"
                  value={form.beneficiary_review_date}
                  onChange={(e) => set("beneficiary_review_date", e.target.value)}
                  className="h-8 text-sm max-w-xs"
                />
              </div>
            </div>
          )}

          {activeTab === "professionals" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Estate Attorney
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field("estate_attorney", "Name", "Attorney name")}
                  {field("estate_attorney_phone", "Phone", "(555) 000-0000")}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Accountant / CPA
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {field("accountant", "Name", "Accountant name")}
                  {field("accountant_phone", "Phone", "(555) 000-0000")}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
