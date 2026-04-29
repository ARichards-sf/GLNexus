-- Per-draft booking URL path. The edge function picks the meeting type
-- that fits the trigger (e.g. annual_review_due → the advisor's "Annual
-- Review" meeting type) and stores the deep-link path here. The frontend
-- prefixes the origin to render the button URL. Null = generic
-- /book/:slug fallback.

alter table public.pending_drafts
  add column if not exists booking_url_path text;
