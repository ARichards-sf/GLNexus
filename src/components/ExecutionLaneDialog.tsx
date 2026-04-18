import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  prospectName: string;
  onLaneSelected: () => void;
}

/**
 * Placeholder Execution Lane dialog.
 * Real lane-picker UI will be implemented in a follow-up step.
 */
export default function ExecutionLaneDialog({
  open,
  onOpenChange,
  prospectName,
  onLaneSelected,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How did the meeting go with {prospectName}?</DialogTitle>
          <DialogDescription>
            Pick the next execution lane for this prospect. We&apos;ll wire this up next.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <Button onClick={onLaneSelected}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
