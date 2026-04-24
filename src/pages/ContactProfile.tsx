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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Personal Info */}
        <Card className="lg:col-span-2 border-border shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Personal Info</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{contact.email}</p>
                </div>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm text-foreground">{contact.phone}</p>
                </div>
              </div>
            )}
            {contact.date_of_birth && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Date of Birth</p>
                  <p className="text-sm text-foreground">
                    {new Date(contact.date_of_birth).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {age !== null && <span className="text-muted-foreground"> (age {age})</span>}
                  </p>
                </div>
              </div>
            )}
            {!contact.email && !contact.phone && !contact.date_of_birth && (
              <p className="text-sm text-muted-foreground text-center py-2">No personal info added yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Employment & Accounts */}
        <div className="lg:col-span-3 space-y-6">
          {/* Employment */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Employment</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {contact.company || contact.job_title ? (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    {contact.job_title && <p className="text-sm font-medium text-foreground">{contact.job_title}</p>}
                    {contact.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No employment info added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Financial Accounts */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Financial Accounts</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  {accounts.length > 0 && (
                    <span className="text-sm font-semibold text-emerald-600">{formatFullCurrency(totalAccountBalance)}</span>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => setAddAccountOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Account
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
        </div>
      </div>

      {/* Financial Profile */}
      <Card className="mt-6 border-border shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <WalletIcon className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">Financial Profile</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (editingProfile) {
                  handleSaveProfile();
                } else {
                  setEditingProfile(true);
                }
              }}
              className="h-7 text-xs gap-1.5"
            >
              {editingProfile ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Save
                </>
              ) : (
                <>
                  <Edit className="w-3.5 h-3.5" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Personal</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preferred Name</p>
                {editingProfile ? (
                  <Input
                    value={profileForm.preferred_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, preferred_name: e.target.value }))}
                    placeholder="Nickname or preferred"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).preferred_name || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Dependents</p>
                {editingProfile ? (
                  <Input
                    type="number"
                    min="0"
                    value={profileForm.number_of_dependents}
                    onChange={(e) => setProfileForm((p) => ({ ...p, number_of_dependents: e.target.value }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).number_of_dependents ?? "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Marital Status</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.marital_status}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, marital_status: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Single", "Married", "Divorced", "Widowed", "Domestic Partner"].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).marital_status || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preferred Contact</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.preferred_contact}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, preferred_contact: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Email", "Phone", "Text"].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).preferred_contact || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Primary Goal</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.primary_goal}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, primary_goal: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {[
                        "Retirement Planning", "Wealth Accumulation", "Wealth Preservation",
                        "Income Generation", "Education Funding", "Estate Planning",
                        "Business Succession", "Debt Reduction", "Insurance Planning", "Tax Minimization",
                      ].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).primary_goal || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Methods */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contact Methods</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mobile Phone</p>
                {editingProfile ? (
                  <Input
                    value={profileForm.mobile_phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, mobile_phone: e.target.value }))}
                    placeholder="Mobile number"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).mobile_phone || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Secondary Phone</p>
                {editingProfile ? (
                  <Input
                    value={profileForm.secondary_phone}
                    onChange={(e) => setProfileForm((p) => ({ ...p, secondary_phone: e.target.value }))}
                    placeholder="Home or work"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).secondary_phone || "—"}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Secondary Email</p>
                {editingProfile ? (
                  <Input
                    value={profileForm.secondary_email}
                    onChange={(e) => setProfileForm((p) => ({ ...p, secondary_email: e.target.value }))}
                    placeholder="Alternative email"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).secondary_email || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Employment & Income */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Employment & Income</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Employment Status</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.employment_status}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, employment_status: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["Employed", "Self-Employed", "Retired", "Unemployed", "Student", "Homemaker"].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).employment_status || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Annual Income</p>
                {editingProfile ? (
                  <Input
                    type="number"
                    value={profileForm.annual_income}
                    onChange={(e) => setProfileForm((p) => ({ ...p, annual_income: e.target.value }))}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">
                    {(contact as any).annual_income ? formatCurrency(Number((contact as any).annual_income)) : "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Retirement Date</p>
                {editingProfile ? (
                  <Input
                    type="date"
                    value={profileForm.retirement_date}
                    onChange={(e) => setProfileForm((p) => ({ ...p, retirement_date: e.target.value }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">
                    {(contact as any).retirement_date
                      ? new Date((contact as any).retirement_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Years to Retirement</p>
                {editingProfile ? (
                  <Input
                    type="number"
                    min="0"
                    value={profileForm.years_to_retirement}
                    onChange={(e) => setProfileForm((p) => ({ ...p, years_to_retirement: e.target.value }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">
                    {(contact as any).years_to_retirement
                      ? `${(contact as any).years_to_retirement} years`
                      : "—"}
                  </p>
                )}
              </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Financial</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Net Worth</p>
                {editingProfile ? (
                  <Input
                    type="number"
                    value={profileForm.net_worth}
                    onChange={(e) => setProfileForm((p) => ({ ...p, net_worth: e.target.value }))}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">
                    {(contact as any).net_worth ? formatCurrency(Number((contact as any).net_worth)) : "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tax Bracket</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.tax_bracket}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, tax_bracket: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {["10%", "12%", "22%", "24%", "32%", "35%", "37%"].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).tax_bracket || "—"}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Filing Status</p>
                {editingProfile ? (
                  <Select
                    value={profileForm.filing_status}
                    onValueChange={(v) => setProfileForm((p) => ({ ...p, filing_status: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {[
                        "Single", "Married Filing Jointly", "Married Filing Separately",
                        "Head of Household", "Qualifying Widow(er)",
                      ].map((o) => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-foreground">{(contact as any).filing_status || "—"}</p>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Address</h4>
            {editingProfile ? (
              <div className="space-y-2">
                <Input
                  value={profileForm.address_line1}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address_line1: e.target.value }))}
                  placeholder="Street address"
                  className="h-8 text-sm"
                />
                <Input
                  value={profileForm.address_line2}
                  onChange={(e) => setProfileForm((p) => ({ ...p, address_line2: e.target.value }))}
                  placeholder="Apt, suite, unit (optional)"
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={profileForm.city}
                    onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="City"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={profileForm.state}
                    onChange={(e) => setProfileForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="State"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={profileForm.zip_code}
                    onChange={(e) => setProfileForm((p) => ({ ...p, zip_code: e.target.value }))}
                    placeholder="ZIP"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-line">
                {[
                  (contact as any).address_line1,
                  (contact as any).address_line2,
                  [(contact as any).city, (contact as any).state, (contact as any).zip_code]
                    .filter(Boolean).join(", "),
                ].filter(Boolean).join("\n") || "—"}
              </p>
            )}
          </div>

          {/* Estate */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Estate Planning</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "has_will" as const, label: "Has Will" },
                { key: "has_trust" as const, label: "Has Trust" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <p className="text-sm text-foreground">{label}</p>
                  {editingProfile ? (
                    <Switch
                      checked={profileForm[key]}
                      onCheckedChange={(v) => setProfileForm((p) => ({ ...p, [key]: v }))}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {(contact as any)[key] ? "Yes" : "No"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
