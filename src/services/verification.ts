import crypto from "crypto";
import { config } from "../core/config";
import { db } from "../core/db";

const CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function hashCode(code: string): string {
  return crypto
    .createHmac("sha256", config.jwtSecret)
    .update(`email-verification:${code}`)
    .digest("hex");
}

export function generateVerificationCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export async function canSendCodeToEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const result = await db.query(
    `
    SELECT 1
    FROM email_verification_codes
    WHERE LOWER(email) = $1
      AND created_at > NOW() - INTERVAL '1 minute'
    LIMIT 1;
    `,
    [normalized]
  );

  return result.rows.length === 0;
}

export async function storeVerificationCode(
  email: string,
  code: string
): Promise<void> {
  const normalized = normalizeEmail(email);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.query(
    `
    UPDATE email_verification_codes
    SET used_at = NOW()
    WHERE LOWER(email) = $1
      AND used_at IS NULL;
    `,
    [normalized]
  );

  await db.query(
    `
    INSERT INTO email_verification_codes (email, code_hash, expires_at)
    VALUES ($1, $2, $3);
    `,
    [normalized, hashCode(code), expiresAt]
  );
}

export async function verifyCode(
  email: string,
  code: string
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const result = await db.query(
    `
    SELECT id, code_hash
    FROM email_verification_codes
    WHERE LOWER(email) = $1
      AND used_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    `,
    [normalized]
  );

  if (result.rows.length === 0) {
    return false;
  }

  const row = result.rows[0];
  const isValid = crypto.timingSafeEqual(
    Buffer.from(row.code_hash),
    Buffer.from(hashCode(code))
  );

  if (!isValid) {
    return false;
  }

  await db.query(
    `UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1;`,
    [row.id]
  );

  return true;
}

export { normalizeEmail };
