import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Wallet, Lock, Edit, Archive, X, MoreHorizontal } from "lucide-react";
import { useAccount, useDeleteAccount } from "@/hooks/useContacts";
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
  const [closeOpen, setCloseOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const deleteAccount = useDeleteAccount();
  const navigate = useNavigate();

  const isNewAccount = useMemo(() => {
    if (!account?.created_at) return false;
    const created = new Date(account.created_at);
    const hoursSince = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    return hoursSince < 24;
  }, [account?.created_at]);

  const goBackToContact = () => {
    if (account) navigate(`/contacts/${account.member_id}`);
  };

  const handleClose = async () => {
    if (!id || !account) return;
    try {
      await deleteAccount.mutateAsync({
        accountId: id,
        action: "close",
        reason: closeReason || undefined,
      });
      toast.success("Account closed");
      setCloseOpen(false);
      setCloseReason("");
      goBackToContact();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close account");
    }
  };

  const handleArchive = async () => {
    if (!id || !account) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id, action: "archive" });
      toast.success("Account archived");
      setArchiveOpen(false);
      goBackToContact();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive account");
    }
  };

  const handleDelete = async () => {
    if (!id || !account) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id, action: "delete" });
      toast.success("Account deleted");
      setDeleteOpen(false);
      goBackToContact();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
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
                {account.status !== "active" && (
                  <Badge
                    variant="secondary"
                    className={
                      account.status === "closed"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-xs font-medium"
                        : "bg-secondary text-muted-foreground text-xs font-medium"
                    }
                  >
                    {account.status === "closed" ? "Closed" : "Archived"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Account
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCloseOpen(true)}>
                  <X className="w-4 h-4 mr-2" />
                  Close Account
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Account
                </DropdownMenuItem>
                {isNewAccount && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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

      {/* Close Account */}
      <AlertDialog
        open={closeOpen}
        onOpenChange={(o) => {
          setCloseOpen(o);
          if (!o) setCloseReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {account.account_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be marked as closed. The record will be retained.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for closing (optional)"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose}>Close Account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Account */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {account.account_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be hidden from active views but retained for compliance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive Account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account (recently created only) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {account.account_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this account. Only available for recently created accounts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
