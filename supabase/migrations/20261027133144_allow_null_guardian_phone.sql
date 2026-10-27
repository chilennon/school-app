-- Allow families to be created without a phone number (for zero-cost migration)
ALTER TABLE public.families ALTER COLUMN guardian_phone DROP NOT NULL;