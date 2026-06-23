-- 카카오 로그인 지원을 위한 users 테이블 변경
-- Supabase SQL Editor 등에서 실행하세요.

-- 카카오 전용 사용자는 google_sub가 없을 수 있음
ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL;

-- 카카오 고유 ID (카카오 회원번호)
ALTER TABLE users ADD COLUMN IF NOT EXISTS kakao_sub TEXT UNIQUE;
