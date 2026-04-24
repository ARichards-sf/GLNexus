import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, User, Mail, Phone, Calendar, Briefcase, Building2,
  Edit, Wallet, Plus, HelpCircle, ChevronRight,
  Archive, ArrowRightLeft, MoreHorizontal, X, Wallet as WalletIcon, Check,
  MapPin, MessageSquare, Users, Shield,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useContact, useContactAccounts, useDeleteAccount } from "@/hooks/useContacts";
import { useArchiveContact } from "@/hooks/useHouseholds";
import { formatFullCurrency, formatCurrency } from "@/data/sampleData";
import EditContactSheet from "@/components/EditContactSheet";
import AddAccountDialog from "@/components/AddAccountDialog";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";
import ReparentContactDialog from "@/components/ReparentContactDialog";

export default function ContactProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const { data: accounts = [] } = useContactAccounts(id);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const [reparentOpen, setReparentOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [closeAccountId, setCloseAccountId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [archiveAccountId, setArchiveAccountId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    marital_status: "",
    employment_status: "",
    annual_income: "" as string | number,
    net_worth: "" as string | number,
    tax_bracket: "",
    filing_status: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "US",
    preferred_contact: "",
    has_will: false,
    has_trust: false,
    primary_goal: "",
    preferred_name: "",
    secondary_email: "",
    secondary_phone: "",
    mobile_phone: "",
    ssn_last_four: "",
    retirement_date: "",
    years_to_retirement: "" as string | number,
    estate_attorney: "",
    estate_attorney_phone: "",
    accountant: "",
    accountant_phone: "",
    beneficiary_review_date: "",
    has_poa: false,
    has_healthcare_directive: false,
    number_of_dependents: 0 as number | string,
    liquid_net_worth: "" as string | number,
  });
  const deleteAccount = useDeleteAccount();
  const archiveContact = useArchiveContact();

  // Sync form from contact when it loads or edit mode opens
  useEffect(() => {
    if (!contact) return;
    setProfileForm({
      marital_status: (contact as any).marital_status || "",
      employment_status: (contact as any).employment_status || "",
      annual_income: (contact as any).annual_income ?? "",
      net_worth: (contact as any).net_worth ?? "",
      tax_bracket: (contact as any).tax_bracket || "",
      filing_status: (contact as any).filing_status || "",
      address_line1: (contact as any).address_line1 || "",
      address_line2: (contact as any).address_line2 || "",
      city: (contact as any).city || "",
      state: (contact as any).state || "",
      zip_code: (contact as any).zip_code || "",
      country: (contact as any).country || "US",
      preferred_contact: (contact as any).preferred_contact || "",
      has_will: (contact as any).has_will || false,
      has_trust: (contact as any).has_trust || false,
      primary_goal: (contact as any).primary_goal || "",
      preferred_name: (contact as any).preferred_name || "",
      secondary_email: (contact as any).secondary_email || "",
      secondary_phone: (contact as any).secondary_phone || "",
      mobile_phone: (contact as any).mobile_phone || "",
      ssn_last_four: (contact as any).ssn_last_four || "",
      retirement_date: (contact as any).retirement_date || "",
      years_to_retirement: (contact as any).years_to_retirement ?? "",
      estate_attorney: (contact as any).estate_attorney || "",
      estate_attorney_phone: (contact as any).estate_attorney_phone || "",
      accountant: (contact as any).accountant || "",
      accountant_phone: (contact as any).accountant_phone || "",
      beneficiary_review_date: (contact as any).beneficiary_review_date || "",
      has_poa: (contact as any).has_poa || false,
      has_healthcare_directive: (contact as any).has_healthcare_directive || false,
      number_of_dependents: (contact as any).number_of_dependents ?? 0,
      liquid_net_worth: (contact as any).liquid_net_worth ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id, editingProfile]);

  const handleSaveProfile = async () => {
    if (!contact) return;
    try {
      await supabase
        .from("household_members")
        .update({
          marital_status: profileForm.marital_status || null,
          employment_status: profileForm.employment_status || null,
          annual_income: profileForm.annual_income !== "" ? Number(profileForm.annual_income) : null,
          net_worth: profileForm.net_worth !== "" ? Number(profileForm.net_worth) : null,
          tax_bracket: profileForm.tax_bracket || null,
          filing_status: profileForm.filing_status || null,
          address_line1: profileForm.address_line1 || null,
          address_line2: profileForm.address_line2 || null,
          city: profileForm.city || null,
          state: profileForm.state || null,
          zip_code: profileForm.zip_code || null,
          country: profileForm.country || "US",
          preferred_contact: profileForm.preferred_contact || null,
          has_will: profileForm.has_will,
          has_trust: profileForm.has_trust,
          primary_goal: profileForm.primary_goal || null,
          preferred_name: profileForm.preferred_name || null,
          secondary_email: profileForm.secondary_email || null,
          secondary_phone: profileForm.secondary_phone || null,
          mobile_phone: profileForm.mobile_phone || null,
          ssn_last_four: profileForm.ssn_last_four || null,
          retirement_date: profileForm.retirement_date || null,
          years_to_retirement:
            profileForm.years_to_retirement !== "" && profileForm.years_to_retirement !== null
              ? Number(profileForm.years_to_retirement)
              : null,
          estate_attorney: profileForm.estate_attorney || null,
          estate_attorney_phone: profileForm.estate_attorney_phone || null,
          accountant: profileForm.accountant || null,
          accountant_phone: profileForm.accountant_phone || null,
          beneficiary_review_date: profileForm.beneficiary_review_date || null,
          has_poa: profileForm.has_poa,
          has_healthcare_directive: profileForm.has_healthcare_directive,
          number_of_dependents: Number(profileForm.number_of_dependents) || 0,
          liquid_net_worth:
            profileForm.liquid_net_worth !== "" && profileForm.liquid_net_worth !== null
              ? Number(profileForm.liquid_net_worth)
              : null,
        })
        .eq("id", contact.id);

      queryClient.invalidateQueries({ queryKey: ["contact", contact.id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });

      setEditingProfile(false);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-secondary rounded w-64" />
          <div className="h-40 bg-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Contact not found.</p>
        <Link to="/" className="text-sm text-foreground underline mt-2 inline-block">Back to Dashboard</Link>
      </div>
    );
  }

  const age = contact.date_of_birth
    ? Math.floor((Date.now() - new Date(contact.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const householdName = (contact as any).households?.name;
  const totalAccountBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          to={`/household/${contact.household_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {householdName || "Household"}
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-semibold text-foreground">
              {contact.first_name[0]}{contact.last_name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {contact.first_name} {contact.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-medium">{contact.relationship}</Badge>
                {contact.company && (
                  <span className="text-sm text-muted-foreground">{contact.job_title ? `${contact.job_title} at ` : ""}{contact.company}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssistOpen(true)}>
              <HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Request GL Assistance
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Contact
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setReparentOpen(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Move to Another Household
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ROW 1 — Three column overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contact Info card */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                { icon: Mail, label: "Primary Email", value: contact.email },
                { icon: Mail, label: "Secondary Email", value: (contact as any).secondary_email },
                { icon: Phone, label: "Mobile", value: (contact as any).mobile_phone },
                { icon: Phone, label: "Phone", value: contact.phone },
                { icon: Phone, label: "Secondary Phone", value: (contact as any).secondary_phone },
                { icon: MessageSquare, label: "Preferred Contact", value: (contact as any).preferred_contact },
              ] as { icon: any; label: string; value: any }[])
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.label} className="flex items-start gap-2.5">
                    <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
                      <p className="text-sm text-foreground truncate">{f.value}</p>
                    </div>
                  </div>
                ))}
              {!contact.email && !contact.phone && (
                <p className="text-xs text-muted-foreground text-center py-2">No contact info yet</p>
              )}
            </CardContent>
          </Card>

          {/* Personal card */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([
                {
                  label: "Date of Birth",
                  value: contact.date_of_birth
                    ? `${new Date(contact.date_of_birth).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}${age !== null ? ` (age ${age})` : ""}`
                    : null,
                },
                { label: "Preferred Name", value: (contact as any).preferred_name },
                { label: "Marital Status", value: (contact as any).marital_status },
                {
                  label: "Dependents",
                  value:
                    (contact as any).number_of_dependents != null
                      ? `${(contact as any).number_of_dependents}`
                      : null,
                },
                { label: "Citizenship", value: (contact as any).citizenship },
                { label: "Primary Goal", value: (contact as any).primary_goal },
              ] as { label: string; value: any }[])
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm text-foreground">{f.value}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Employment card */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                Employment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.company || contact.job_title ? (
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    {contact.job_title && (
                      <p className="text-sm font-medium text-foreground">{contact.job_title}</p>
                    )}
                    {contact.company && (
                      <p className="text-xs text-muted-foreground">{contact.company}</p>
                    )}
                  </div>
                </div>
              ) : null}
              {([
                { label: "Status", value: (contact as any).employment_status },
                {
                  label: "Annual Income",
                  value: (contact as any).annual_income
                    ? formatCurrency(Number((contact as any).annual_income))
                    : null,
                },
                {
                  label: "Retirement",
                  value: (contact as any).retirement_date
                    ? new Date((contact as any).retirement_date).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : (contact as any).years_to_retirement
                    ? `${(contact as any).years_to_retirement} years away`
                    : null,
                },
              ] as { label: string; value: any }[])
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{f.label}</p>
                    <p className="text-sm text-foreground">{f.value}</p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        {/* ROW 2 — Financial snapshot */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Net Worth",
              value: (contact as any).net_worth ? formatCurrency(Number((contact as any).net_worth)) : "—",
              color: "text-emerald-600",
            },
            {
              label: "Liquid Net Worth",
              value: (contact as any).liquid_net_worth
                ? formatCurrency(Number((contact as any).liquid_net_worth))
                : "—",
              color: "text-emerald-600",
            },
            {
              label: "Tax Bracket",
              value: (contact as any).tax_bracket || "—",
              color: "text-foreground",
            },
            {
              label: "Filing Status",
              value: (contact as any).filing_status
                ? (contact as any).filing_status
                    .replace("Married Filing Jointly", "MFJ")
                    .replace("Married Filing Separately", "MFS")
                    .replace("Head of Household", "HOH")
                : "—",
              color: "text-foreground",
            },
          ].map((item) => (
            <Card key={item.label} className="border-border shadow-none">
              <CardContent className="pt-4 pb-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                <p className={`text-lg font-semibold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ROW 3 — Accounts (full width) */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                Financial Accounts
                {accounts.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">({accounts.length})</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-3">
                {accounts.length > 0 && (
                  <span className="text-sm font-semibold text-emerald-600">
                    {formatFullCurrency(totalAccountBalance)}
                  </span>
                )}
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setAddAccountOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Account
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Institution</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow
                        key={account.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => navigate(`/accounts/${account.id}`)}
                      >
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground">{account.account_name}</p>
                            {account.account_number && (
                              <p className="text-xs text-muted-foreground">••••{account.account_number.slice(-4)}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{account.account_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{account.institution || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-emerald-600">
                          {formatFullCurrency(Number(account.balance))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCloseAccountId(account.id);
                                    setCloseReason("");
                                  }}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Close Account
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setArchiveAccountId(account.id);
                                  }}
                                >
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No accounts linked yet. Click "Add Account" to get started.</p>
            )}
          </CardContent>
        </Card>

        {/* ROW 4 — Address + Estate + Professional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Address */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(contact as any).address_line1 ? (
                <div className="text-sm text-foreground leading-relaxed">
                  <p>{(contact as any).address_line1}</p>
                  {(contact as any).address_line2 && <p>{(contact as any).address_line2}</p>}
                  <p>
                    {[(contact as any).city, (contact as any).state, (contact as any).zip_code]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {(contact as any).country && (contact as any).country !== "US" && (
                    <p>{(contact as any).country}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No address on file</p>
              )}
            </CardContent>
          </Card>

          {/* Estate Planning */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                Estate Planning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { key: "has_will", label: "Last Will & Testament" },
                { key: "has_trust", label: "Trust" },
                { key: "has_poa", label: "Power of Attorney" },
                { key: "has_healthcare_directive", label: "Healthcare Directive" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                >
                  <span className="text-sm text-foreground">{label}</span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      (contact as any)[key]
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {(contact as any)[key] ? "✓ Yes" : "No"}
                  </span>
                </div>
              ))}
              {(contact as any).beneficiary_review_date && (
                <p className="text-xs text-muted-foreground pt-2">
                  Beneficiary review:{" "}
                  {new Date((contact as any).beneficiary_review_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Professional Contacts */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                Professional Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(contact as any).estate_attorney ? (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Estate Attorney</p>
                  <p className="text-sm text-foreground font-medium">{(contact as any).estate_attorney}</p>
                  {(contact as any).estate_attorney_phone && (
                    <p className="text-xs text-muted-foreground">{(contact as any).estate_attorney_phone}</p>
                  )}
                </div>
              ) : null}
              {(contact as any).accountant ? (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Accountant / CPA</p>
                  <p className="text-sm text-foreground font-medium">{(contact as any).accountant}</p>
                  {(contact as any).accountant_phone && (
                    <p className="text-xs text-muted-foreground">{(contact as any).accountant_phone}</p>
                  )}
                </div>
              ) : null}
              {!(contact as any).estate_attorney && !(contact as any).accountant && (
                <p className="text-xs text-muted-foreground">No professional contacts yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EditContactSheet open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} memberId={contact.id} />
      <RequestAssistanceDialog
        open={assistOpen}
        onOpenChange={setAssistOpen}
        context={{
          householdName: householdName,
          householdId: contact.household_id || undefined,
        }}
      />


      {/* Archive Contact Confirmation */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {contact.first_name} {contact.last_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This contact will be archived and hidden from your active view. Their history will be retained for compliance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await archiveContact.mutateAsync({ memberId: contact.id });
                  toast.success("Contact archived");
                  navigate(contact.household_id ? `/household/${contact.household_id}` : "/contacts");
                } catch (e: any) {
                  toast.error(e?.message || "Failed to archive contact");
                }
              }}
            >
              Archive Contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Account Confirmation */}
      <AlertDialog
        open={!!closeAccountId}
        onOpenChange={(o) => {
          if (!o) {
            setCloseAccountId(null);
            setCloseReason("");
          }
        }}
      >
        <AlertDialogContent>
          {(() => {
            const a = accounts.find((x) => x.id === closeAccountId);
            const name = a?.account_name || "this account";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This account will be marked as closed. The record will be retained for compliance.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                  <Textarea
                    placeholder="Optional: reason for closure"
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!closeAccountId) return;
                      try {
                        await deleteAccount.mutateAsync({
                          accountId: closeAccountId,
                          action: "close",
                          reason: closeReason || undefined,
                        });
                        toast.success(`${name} closed`);
                        setCloseAccountId(null);
                        setCloseReason("");
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to close account");
                      }
                    }}
                  >
                    Close Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Account Confirmation */}
      <AlertDialog open={!!archiveAccountId} onOpenChange={(o) => !o && setArchiveAccountId(null)}>
        <AlertDialogContent>
          {(() => {
            const a = accounts.find((x) => x.id === archiveAccountId);
            const name = a?.account_name || "this account";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This account will be archived and hidden from active views. Its history will be retained.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (!archiveAccountId) return;
                      try {
                        await deleteAccount.mutateAsync({
                          accountId: archiveAccountId,
                          action: "archive",
                        });
                        toast.success(`${name} archived`);
                        setArchiveAccountId(null);
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to archive account");
                      }
                    }}
                  >
                    Archive Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Reparent Dialog */}
      {reparentOpen && contact.household_id && (
        <ReparentContactDialog
          open={reparentOpen}
          onOpenChange={setReparentOpen}
          contact={{
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            household_id: contact.household_id,
            household_name: householdName || "Current Household",
          }}
          accounts={accounts}
          onComplete={() => {
            setReparentOpen(false);
            navigate(`/household/${contact.household_id}`);
          }}
        />
      )}
    </div>
  );
}
