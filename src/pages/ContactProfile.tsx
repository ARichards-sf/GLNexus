import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, User, Mail, Phone, Calendar, Briefcase, Building2,
  DollarSign, Edit, Wallet,
} from "lucide-react";
import { useContact, useContactAccounts } from "@/hooks/useContacts";
import { formatFullCurrency } from "@/data/sampleData";
import EditContactSheet from "@/components/EditContactSheet";

export default function ContactProfile() {
  const { id } = useParams();
  const { data: contact, isLoading } = useContact(id);
  const { data: accounts = [] } = useContactAccounts(id);
  const [editOpen, setEditOpen] = useState(false);

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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Contact
          </Button>
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

          {/* Individual Accounts */}
          <Card className="border-border shadow-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base font-semibold">Individual Accounts</CardTitle>
                </div>
                {accounts.length > 0 && (
                  <span className="text-sm font-semibold text-foreground">{formatFullCurrency(totalAccountBalance)}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/40">
                      <div>
                        <p className="text-sm font-medium text-foreground">{account.account_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{account.account_type}</Badge>
                          {account.institution && <span className="text-xs text-muted-foreground">{account.institution}</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatFullCurrency(Number(account.balance))}</p>
                        {account.account_number && (
                          <p className="text-xs text-muted-foreground">••••{account.account_number.slice(-4)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">No individual accounts linked yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EditContactSheet open={editOpen} onOpenChange={setEditOpen} contact={contact} />
    </div>
  );
}
