import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAccount } from "@/hooks/useContacts";
import { toast } from "sonner";

const ACCOUNT_TYPES = [
  "401k", "IRA", "Roth IRA", "Brokerage", "Savings", "Checking", "529 Plan",
];

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
}

export default function AddAccountDialog({ open, onOpenChange, memberId }: AddAccountDialogProps) {
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState("");
  const [institution, setInstitution] = useState("");
  const createAccount = useCreateAccount();

  const reset = () => {
    setAccountName("");
    setAccountType("");
    setAccountNumber("");
    setBalance("");
    setInstitution("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim() || !accountType) return;

    createAccount.mutate(
      {
        member_id: memberId,
        account_name: accountName.trim(),
        account_type: accountType,
        account_number: accountNumber.trim() || null,
        balance: parseFloat(balance) || 0,
        institution: institution.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Account added successfully.");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to add account."),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Financial Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="acct-name">Account Name</Label>
            <Input id="acct-name" placeholder="e.g. Joint Brokerage" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType} required>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acct-balance">Balance ($)</Label>
              <Input id="acct-balance" type="number" step="0.01" min="0" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acct-num">Account # (last 4)</Label>
              <Input id="acct-num" maxLength={4} placeholder="1234" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="acct-inst">Institution</Label>
            <Input id="acct-inst" placeholder="e.g. Charles Schwab" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? "Adding..." : "Add Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
