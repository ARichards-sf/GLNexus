-- When Microsoft Graph returns `invalid_grant` on a refresh attempt
-- (consent revoked, password change, 90-day idle window, account
-- disabled), the existing token will never recover via retry. Flip this
-- flag so the UI can prompt for re-authorization instead of silently
-- piling up cron retries every 5 minutes forever.
--
-- Reset to false on the OAuth callback's successful upsert.

alter table public.outlook_connections
  add column if not exists needs_reauth boolean not null default false;
