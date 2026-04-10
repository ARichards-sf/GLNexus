import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketCheck, Search, Clock, MessageCircle } from "lucide-react";
import { useAllServiceRequests } from "@/hooks/useServiceRequests";
import { useUnreadRequests } from "@/hooks/useUnreadRequests";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const STATUSES = ["open", "in-progress", "resolved"] as const;

export default function AdminRequests() {
  const { data: requests = [], isLoading } = useAllServiceRequests();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const requestIds = requests.map((r) => r.id);
  const { data: unreadSet = new Set<string>() } = useUnreadRequests(requestIds);

  const filtered = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.category.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.household_name?.toLowerCase().includes(q);
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("service_requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Failed to update status.");
    } else {
      toast.success(`Request marked as ${status}.`);
      queryClient.invalidateQueries({ queryKey: ["service_requests"] });
    }
  };

  const counts = {
    all: requests.length,
    open: requests.filter((r) => r.status === "open").length,
    "in-progress": requests.filter((r) => r.status === "in-progress").length,
    resolved: requests.filter((r) => r.status === "resolved").length,
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">All Support Requests</h1>
        <p className="text-muted-foreground mt-1">Monitor and manage GL Expert Assist tickets across all advisors.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(["all", "open", "in-progress", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`rounded-lg border p-3 text-left transition-all ${
              filterStatus === s ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-secondary/40"
            }`}
          >
            <p className="text-2xl font-semibold text-foreground">{counts[s]}</p>
            <p className="text-xs text-muted-foreground capitalize">{s === "all" ? "Total" : s}</p>
          </button>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 text-center">
            <TicketCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No requests match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <Card key={req.id} className="border-border shadow-none cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => navigate(`/admin/requests/${req.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground">{req.advisor_name || "Unknown Advisor"}</span>
                      {req.advisor_email && <span className="text-[11px] text-muted-foreground">({req.advisor_email})</span>}
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium">{req.category}</Badge>
                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 font-medium ${statusStyles[req.status] || ""}`}>
                        {req.status}
                      </Badge>
                      {unreadSet.has(req.id) && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                          <MessageCircle className="w-3 h-3" /> New message
                        </span>
                      )}
                      {req.household_name && (
                        <span className="text-xs text-muted-foreground">• {req.household_name}</span>
                      )}
                      {req.account_type && (
                        <span className="text-xs text-muted-foreground">• {req.account_type}{req.account_institution ? ` @ ${req.account_institution}` : ""}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{req.description}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                      {req.file_paths.length > 0 && (
                        <span className="text-[11px] text-muted-foreground ml-2">📎 {req.file_paths.length} file{req.file_paths.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <Select value={req.status} onValueChange={(v) => updateStatus(req.id, v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
