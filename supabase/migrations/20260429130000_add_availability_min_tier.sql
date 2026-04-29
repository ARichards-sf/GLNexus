-- Tier-aware availability for the public booking page.
--
-- Each window can require a minimum wealth tier; the public-booking edge
-- function resolves the booker's email to a household and filters slots
-- accordingly.
--
-- Tier ordering: prospect/unknown < silver < gold < platinum.
-- A window with `min_tier = 'gold'` is bookable by gold and platinum.
-- A window with `min_tier IS NULL` is open to everyone (including
-- prospects whose email doesn't resolve to a household).

alter table public.advisor_availability_windows
  add column if not exists min_tier text;

alter table public.advisor_availability_windows
  drop constraint if exists advisor_availability_windows_min_tier_check;

alter table public.advisor_availability_windows
  add constraint advisor_availability_windows_min_tier_check
    check (min_tier is null or min_tier in ('silver', 'gold', 'platinum'));

create index if not exists availability_windows_min_tier_idx
  on public.advisor_availability_windows (advisor_id, min_tier);
