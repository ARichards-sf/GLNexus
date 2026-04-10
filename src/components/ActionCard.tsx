import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { ParsedToolCall, getActionDescription } from "@/hooks/useAiActions";

interface Props {
  toolCall: ParsedToolCall;
  onConfirm: (tc: ParsedToolCall) => void;
  onReject: (tc: ParsedToolCall) => void;
}

export default function ActionCard({ toolCall, onConfirm, onReject }: Props) {
  const description = getActionDescription(toolCall.name, toolCall.args);
  const isPending = toolCall.status === "pending";
  const isExecuting = toolCall.status === "confirmed";

  return (
    <div className="bg-accent/50 border border-border rounded-lg p-3 space-y-2 max-w-[85%]">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Proposed Action
      </div>
      <div className="text-sm whitespace-pre-wrap">
        {description.split("**").map((part, i) =>
          i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
        )}
      </div>
      {isPending && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => onConfirm(toolCall)}>
            <Check className="h-3 w-3 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onReject(toolCall)}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
      )}
      {isExecuting && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Executing…
        </div>
      )}
      {toolCall.status === "executed" && (
        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          ✓ {toolCall.result || "Done"}
        </div>
      )}
      {toolCall.status === "error" && (
        <div className="text-xs text-destructive font-medium">
          ✗ {toolCall.result || "Failed"}
        </div>
      )}
      {toolCall.status === "rejected" && (
        <div className="text-xs text-muted-foreground">Action cancelled.</div>
      )}
    </div>
  );
}
