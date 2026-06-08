ALTER TABLE competition_rules
  ADD COLUMN IF NOT EXISTS target_rounds integer[] DEFAULT NULL;
