-- Allow `contact_documents` rows to represent household-scope documents
-- (wills, trusts, joint POAs, family insurance) by making contact_id
-- nullable. When contact_id IS NULL the row is treated as household-level;
-- when set it remains contact-scoped. household_id stays NOT NULL so every
-- doc belongs to a household either way.

alter table public.contact_documents
  alter column contact_id drop not null;

-- Sanity guard: every doc must point at a household at minimum. This is
-- already implied by household_id being NOT NULL, but the explicit check
-- documents the contract for the dual-scope model.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contact_documents_target_check'
      and conrelid = 'public.contact_documents'::regclass
  ) then
    alter table public.contact_documents
      add constraint contact_documents_target_check
      check (household_id is not null);
  end if;
end $$;

-- Speeds up the household-scope query path used by the new household
-- Documents tab and the "From the household" subsection on contact tabs.
create index if not exists contact_documents_household_scope_idx
  on public.contact_documents (household_id)
  where contact_id is null;
