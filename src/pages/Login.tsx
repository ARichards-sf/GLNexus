import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { resetDemoTour } from "@/lib/demoMode";
import glLogo from "@/assets/nexus_logo.png";

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
const DEMO_ENABLED = !!(DEMO_EMAIL && DEMO_PASSWORD);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartDemo = async () => {
    if (!DEMO_ENABLED) return;
    setDemoLoading(true);
    try {
      // Force the guided tour to auto-open on first render of the
      // landing page, even for visitors who previously dismissed it.
      resetDemoTour();
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL!,
        password: DEMO_PASSWORD!,
      });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Demo unavailable",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-6 pt-16">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-4">
          <img src={glLogo} alt="Nexus AI" className="h-64 w-auto" />
        </div>

        {/* Primary CTA — separated from the login card so it's the obvious entry point */}
        {DEMO_ENABLED && (
          <div className="mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-950 dark:border-amber-500 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-100"
              onClick={handleStartDemo}
              disabled={demoLoading || loading}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {demoLoading ? "Loading demo..." : "Start Demo"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Skip the login — explore Nexus AI with a synthetic advisor book.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Or sign in
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <Card className="border-border shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-center">
              Welcome back
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="advisor@firm.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : "Sign In"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Contact your administrator for account access.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
