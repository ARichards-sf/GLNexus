import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Lock, Edit } from "lucide-react";
import { useAccount } from "@/hooks/useContacts";
import { formatFullCurrency } from "@/data/sampleData";
import EditAccountSheet from "@/components/EditAccountSheet";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function LockedField({ label, value, isEmpty }: { label: string; value: React.ReactNode; isEmpty: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm text-foreground">
        {isEmpty ? <span className="text-muted-foreground">—</span> : value}
      </p>
      {isEmpty && (
        <p className="text-[11px] text-muted-foreground italic">Will be populated on next LPL sync</p>
      )}
    </div>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const { data: account, isLoading } = useAccount(id);
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

  if (!account) {
    return (
      <div className="p-10">
        <p className="text-muted-foreground">Account not found.</p>
        <Link to="/contacts" className="text-sm text-foreground underline mt-2 inline-block">Back to Contacts</Link>
      </div>
    );
  }

  const owner = account.household_members;
  const ownerName = owner ? `${owner.first_name} ${owner.last_name}` : "Owner";
  const maskedNumber = account.account_number ? `••••${account.account_number.slice(-4)}` : null;
  const isLpl = account.data_source === "lpl";

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        {owner && (
          <Link
            to={`/contacts/${owner.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {ownerName}
          </Link>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
              <Wallet className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {account.account_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-medium">{account.account_type}</Badge>
                <span className="text-sm font-semibold text-emerald-600">
                  {formatFullCurrency(Number(account.balance))}
                </span>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Account
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Account Details */}
        <Card className="border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Account Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <Field label="Financial Account Name" value={account.account_name} />
              <Field label="Account Number" value={maskedNumber} />
              <Field label="Account Type" value={account.account_type} />
              <Field label="Institution" value={account.institution} />
              <Field label="Account Registration" value={account.account_registration} />
              <Field label="Account Class" value={account.account_class} />
              <Field label="Objective" value={account.objective} />
              <Field label="B&R Suitability" value={account.br_suitability} />
              <Field label="Tier Schedule" value={account.tier_schedule} />
              <div className="sm:col-span-2">
                <Field label="Description" value={account.description} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LPL Data */}
        <Card className="border-border shadow-none bg-muted/30">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold text-muted-foreground">LPL Data</CardTitle>
              </div>
              <Badge
                variant="secondary"
                className={
                  isLpl
                    ? "text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-xs"
                }
              >
                {isLpl ? "LPL" : "Manual"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <LockedField
                label="Linking Status"
                value={account.lpl_linking_status}
                isEmpty={!account.lpl_linking_status}
              />
              <LockedField
                label="Type"
                value={account.lpl_type}
                isEmpty={!account.lpl_type}
              />
              <LockedField
                label="Net Revenues"
                value={
                  account.lpl_net_revenues !== null
                    ? formatFullCurrency(Number(account.lpl_net_revenues))
                    : null
                }
                isEmpty={account.lpl_net_revenues === null}
              />
              <LockedField
                label="Last Updated From LPL"
                value={
                  account.lpl_last_updated
                    ? new Date(account.lpl_last_updated).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : null
                }
                isEmpty={!account.lpl_last_updated}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <EditAccountSheet open={editOpen} onOpenChange={setEditOpen} account={account} />
    </div>
  );
}
