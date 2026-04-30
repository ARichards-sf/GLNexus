import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, LogOut, Calendar as CalendarIcon, Plug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import BookingSettings from "@/components/settings/BookingSettings";
import OutlookSettings from "@/components/settings/OutlookSettings";
import { StickyTabsBar } from "@/components/ui/sticky-tabs-bar";
import { StickyPageHeader } from "@/components/ui/sticky-page-header";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!currentPassword) next.current = "Current password is required";
    if (newPassword.length < 8) next.next = "New password must be at least 8 characters";
    if (confirmPassword !== newPassword) next.confirm = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!user?.email) {
      toast.error("Unable to verify account.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setErrors({ current: "Current password is incorrect" });
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error(updateError.message || "Failed to update password");
        setSubmitting(false);
        return;
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 space-y-6 pb-8">
      <StickyPageHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your account preferences and security.</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </StickyPageHeader>

      <Tabs defaultValue="security" className="space-y-4">
        <StickyTabsBar>
          <TabsList>
            <TabsTrigger value="security">
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Security
            </TabsTrigger>
            <TabsTrigger value="booking">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
              Booking
            </TabsTrigger>
            <TabsTrigger value="integrations">
              <Plug className="w-3.5 h-3.5 mr-1.5" />
              Integrations
            </TabsTrigger>
          </TabsList>
        </StickyTabsBar>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Security
              </CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  {errors.current && <p className="text-xs text-destructive">{errors.current}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {errors.next && <p className="text-xs text-destructive">{errors.next}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking">
          <BookingSettings />
        </TabsContent>

        <TabsContent value="integrations">
          <OutlookSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
