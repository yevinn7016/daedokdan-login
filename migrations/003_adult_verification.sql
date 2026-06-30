-- 성인 본인인증 (휴대폰 인증) 지원
-- Supabase SQL Editor 등에서 실행하세요.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS adult_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS adult_verified_at TIMESTAMPTZ;
