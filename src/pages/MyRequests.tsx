import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TicketCheck, Search, Clock, Plus, MessageCircle } from "lucide-react";
import { useMyServiceRequests } from "@/hooks/useServiceRequests";
import { useUnreadRequests } from "@/hooks/useUnreadRequests";
import RequestAssistanceDialog from "@/components/RequestAssistanceDialog";

const statusStyles: Record<string, string> = {
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "in-progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function MyRequests() {
  const { data: requests = [], isLoading } = useMyServiceRequests();
  const [search, setSearch] = useState("");
  const [assistOpen, setAssistOpen] = useState(false);
  const navigate = useNavigate();
  const requestIds = requests.map((r) => r.id);
  const { data: unreadSet = new Set<string>() } = useUnreadRequests(requestIds);

  const filtered = requests.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.category.toLowerCase().includes(q) || r.description.toLowerCase().includes(q) || r.household_name?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My Support Requests</h1>
          <p className="text-muted-foreground mt-1">Track your GL Expert Assist tickets.</p>
        </div>
        <Button size="sm" onClick={() => setAssistOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> New Request
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search requests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border shadow-none">
          <CardContent className="py-12 text-center">
            <TicketCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{search ? "No requests match your search." : "No support requests yet."}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setAssistOpen(true)}>Submit your first request</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <Card key={req.id} className="border-border shadow-none cursor-pointer hover:bg-secondary/30 transition-colors" onClick={() => navigate(`/my-requests/${req.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
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
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">
                      {req.description}
                      {(req as { is_vpm?: boolean; ticket_number?: number | null }).is_vpm &&
                        (req as { is_vpm?: boolean; ticket_number?: number | null }).ticket_number && (
                        <span className="text-xs font-mono text-muted-foreground ml-2">
                          VPM-{(req as { is_vpm?: boolean; ticket_number?: number | null }).ticket_number}
                        </span>
                      )}
                    </p>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RequestAssistanceDialog open={assistOpen} onOpenChange={setAssistOpen} />
    </div>
  );
}
