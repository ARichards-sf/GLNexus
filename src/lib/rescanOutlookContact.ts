import { supabase } from "@/integrations/supabase/client";

/**
 * Fire a one-shot historical rescan of Outlook mail for a newly-added
 * contact or prospect. Stored rows are flagged `is_historical = true` so
 * the AI prioritizer skips them — historical mail is for timeline
 * context only, not "act on this now."
 *
 * Failures are deliberately swallowed: if the advisor hasn't connected
 * Outlook, the call returns an error and we just don't backfill — adding
 * a contact must never fail because of a missing integration.
 */
export async function rescanOutlookContact(args: {
  email: string | null | undefined;
  /** Pick exactly one of these — for a household_member, pass contact_id +
   *  household_id; for a prospect, pass prospect_id. */
  contact_id?: string;
  household_id?: string;
  prospect_id?: string;
  lookback_days?: number;
}): Promise<void> {
  const email = (args.email ?? "").trim();
  if (!email) return;
  if (!args.contact_id && !args.prospect_id) return;

  try {
    await supabase.functions.invoke("outlook-sync", {
      body: {
        action: "rescan_contact",
        email,
        contact_id: args.contact_id,
        household_id: args.household_id,
        prospect_id: args.prospect_id,
        lookback_days: args.lookback_days ?? 90,
      },
    });
  } catch (e) {
    // Outlook not connected, network blip, etc. — non-fatal.
    console.warn("Outlook rescan skipped:", e);
  }
}
