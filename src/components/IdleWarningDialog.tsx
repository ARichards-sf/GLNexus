import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  onStayLoggedIn: () => void;
  onLogOut: () => void;
}

export default function IdleWarningDialog({
  open,
  onStayLoggedIn,
  onLogOut,
}: Props) {
  const [countdown, setCountdown] = useState(120);

  useEffect(() => {
    if (!open) {
      setCountdown(120);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You've been inactive for 28 minutes. For the security of your
                client data, your session will automatically end in:
              </p>
              <p className="text-center text-3xl font-mono font-semibold tabular-nums text-foreground">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </p>
              <p className="text-sm text-muted-foreground">
                Any unsaved changes will be preserved. You'll need to sign in
                again to continue.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogOut}>Sign Out Now</AlertDialogCancel>
          <AlertDialogAction onClick={onStayLoggedIn}>
            Stay Logged In
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
