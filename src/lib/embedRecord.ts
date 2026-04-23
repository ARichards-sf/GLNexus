import { supabase } from 
  "@/integrations/supabase/client"

export async function embedRecord(
  tableName: string,
  record: Record<string, any>,
  advisorId: string
): Promise<void> {
  try {
    const { data: { session } } = 
      await supabase.auth.getSession()
    
    if (!session?.access_token) return

    await fetch(
      `${import.meta.env
        .VITE_SUPABASE_URL}/functions/v1/embed-record`,
      {
        method: "POST",
        headers: {
          "Authorization": 
            `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "apikey": import.meta.env
            .VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          table_name: tableName,
          record,
          advisor_id: advisorId,
        }),
      }
    )
    // Fire and forget — don't await
    // Don't block the UI for embeddings
  } catch {
    // Silently fail — embedding is
    // background intelligence
    // not critical path
  }
}