import { AlertCircle, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  REQUEST_TYPE_LABELS,
  STATUS_STYLES,
  TIMELINE_LABELS,
  TIMELINE_STYLES,
  type VpmRequestRow,
} from "@/components/vpm/vpmRequestMeta";

interface VpmRequestCardProps {
  request: VpmRequestRow;
  onClick: () => void;
}

export default function VpmRequestCard({ request: r, onClick }: VpmRequestCardProps) {
  return (
    <div
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {r.priority === "urgent" && (
            <Badge className="bg-red-100 text-red-700 text-[10px]">
              <AlertCircle className="w-3 h-3 mr-1" />
              Urgent
            </Badge>
          )}
          <Badge
            className={
              TIMELINE_STYLES[r.vpm_timeline || ""] || "bg-secondary text-muted-foreground"
            }
          >
            {TIMELINE_LABELS[r.vpm_timeline || ""] || "No timeline"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {REQUEST_TYPE_LABELS[r.vpm_request_type || ""] || r.category}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {r.advisor_billing_type === "prime_partner" && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
              ⭐ Prime
            </span>
          )}
          <Badge className={STATUS_STYLES[r.status] || ""}>{r.status}</Badge>
        </div>
      </div>

      <p className="text-sm font-semibold text-foreground mb-1 line-clamp-1">
        {r.description?.split("\n")[0] || "VPM Support Request"}
      </p>

      <div className="flex items-center justify-between mt-2 gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {r.advisor_name || "Unknown"}
          </span>
          {r.household_name && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {r.household_name}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {new Date(r.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
