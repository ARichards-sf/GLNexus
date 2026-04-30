import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Mail, Loader2, RefreshCw, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

type OutlookConnection = {
  email: string;
  display_name: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  inbox_delta_link: string | null;
};

export default function OutlookSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);

  // One-time toast when Microsoft bounces the user back with ?outlook=connected.
  useEffect(() => {
    const status = searchParams.get("outlook");
    if (status === "connected") {
      toast.success("Outlook connected. Running first sync…");
      searchParams.delete("outlook");
      setSearchParams(searchParams, { replace: true });
      // Kick the first sync immediately so the user sees results quickly.
      qc.refetchQueries({ queryKey: ["outlook-connection"] });
      runSync();
    }
  }, []);

  const { data: conn, isLoading } = useQuery({
    queryKey: ["outlook-connection", user?.id],
    queryFn: async (): Promise<OutlookConnection | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("outlook_connections")
        .select("email, display_name, last_synced_at, last_sync_error, inbox_delta_link")
        .eq("advisor_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You need to be signed in to connect Outlook.");
        return;
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-oauth-start?redirect_to=/settings`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `OAuth start failed (${res.status})`);
      }
      const { authorizeUrl } = await res.json();
      window.location.href = authorizeUrl;
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to start OAuth");
      setConnecting(false);
    }
  };

  const runSync = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const t = toast.loading("Syncing Outlook…");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Sync failed (${res.status})`);
      toast.success(
        `Synced — inbox: ${body.inbox?.upserted ?? 0} new, sent: ${body.sent?.upserted ?? 0} new, ${body.ai_processed ?? 0} prioritized`,
        { id: t },
      );
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed", { id: t });
    }
  };

  const syncMutation = useMutation({ mutationFn: runSync });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("outlook_connections")
        .delete()
        .eq("advisor_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Outlook disconnected");
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to disconnect"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          Outlook
        </CardTitle>
        <CardDescription>
          Connect your Microsoft 365 mailbox so the AI can triage incoming client email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading…
          </div>
        ) : !conn ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Not connected. You'll be redirected to Microsoft to authorize access to Inbox + Sent Items.
            </p>
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Connect Outlook
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Connected</Badge>
              <span className="text-sm font-medium">{conn.email}</span>
              {conn.display_name && (
                <span className="text-sm text-muted-foreground">({conn.display_name})</span>
              )}
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                {conn.last_synced_at
                  ? `Last synced ${formatDistanceToNow(new Date(conn.last_synced_at))} ago`
                  : "Never synced yet"}
                {!conn.inbox_delta_link && conn.last_synced_at && (
                  <span className="ml-2 text-xs">(initial sync still running)</span>
                )}
              </div>
              {conn.last_sync_error && (
                <div className="text-destructive text-xs">
                  Last sync error: {conn.last_sync_error}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                Sync now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                <Unlink className="w-3.5 h-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
