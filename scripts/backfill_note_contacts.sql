-- =========================================================================
-- BACKFILL — tag existing compliance notes with their household contacts
-- =========================================================================
--
-- The original seed (seed_test_data.sql) inserted compliance_notes with
-- household_id but no rows in compliance_note_contacts. After moving to a
-- contact-first model (every note must be tagged to ≥1 contact, see
-- AddComplianceNoteDialog), those untagged seed notes don't show up on
-- contact profiles even though they belong to a household.
--
-- This script tags every existing untagged note with the household's
-- Primary contact AND Spouse (when present). Most seeded notes describe
-- joint reviews ("met with James and Margaret", "annual review with
-- Michael and Sarah", etc.), so tagging both matches their content.
--
-- Idempotent — uses ON CONFLICT DO NOTHING against the
-- (compliance_note_id, contact_id) UNIQUE constraint, so re-running just
-- skips already-tagged links.
--
-- HOW TO USE:
--   1. Paste your advisor user_id below.
--   2. Run in Supabase Dashboard → SQL Editor.
-- =========================================================================

do $$
declare
  -- ── EDIT THIS LINE ─────────────────────────────────────────────────────
  v_advisor_id uuid := '2f069cbb-f634-4279-8946-123a33faa9c2';
  -- ───────────────────────────────────────────────────────────────────────

  v_linked int;
begin
  -- Tag each note with the household's primary + spouse (if present).
  -- Single-member households (e.g., Henderson, Nakamura, Adler) just get
  -- the primary linked — no spouse to tag.
  insert into public.compliance_note_contacts (compliance_note_id, contact_id)
  select cn.id, hm.id
  from public.compliance_notes cn
  join public.household_members hm
    on hm.household_id = cn.household_id
    and hm.advisor_id  = cn.advisor_id
    and hm.relationship in ('Primary', 'Spouse')
    and hm.archived_at is null
  where cn.advisor_id = v_advisor_id
  on conflict (compliance_note_id, contact_id) do nothing;

  get diagnostics v_linked = row_count;

  raise notice 'Linked % new (note, contact) pairs for advisor %.', v_linked, v_advisor_id;
end $$;

-- =========================================================================
-- VERIFY — every note has at least one tagged contact, and the per-note
-- count is 1 (single-member households) or 2 (couples):
--
--   select hh.name,
--          cn.type,
--          cn.date,
--          count(cnc.contact_id) as tagged_contacts,
--          string_agg(hm.first_name, ', ' order by hm.relationship) as contacts
--   from compliance_notes cn
--   join households hh on hh.id = cn.household_id
--   left join compliance_note_contacts cnc on cnc.compliance_note_id = cn.id
--   left join household_members hm on hm.id = cnc.contact_id
--   where cn.advisor_id = '<your_id>'
--   group by hh.name, cn.id, cn.type, cn.date
--   order by hh.name, cn.date;
--
-- Notes with `tagged_contacts = 0` after this script means the household
-- has no Primary/Spouse member — investigate (likely a seed data issue).
-- =========================================================================
