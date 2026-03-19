-- ============================================================
-- 043: Email preference for new balances
-- ============================================================

ALTER TABLE email_preferences
ADD COLUMN IF NOT EXISTS balance_nuevo BOOLEAN NOT NULL DEFAULT TRUE;
