// src/routes/auth.ts

import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../core/config";
import { db } from "../core/db";
import { createAccessToken } from "../core/jwt";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifyKakaoAccessToken } from "../services/kakao";
import { sendVerificationEmail } from "../services/email";
import {
  canSendCodeToEmail,
  generateVerificationCode,
  isValidEmail,
  normalizeEmail,
  storeVerificationCode,
  verifyCode,
} from "../services/verification";
import { emailSendIpRateLimit } from "../middlewares/emailSendRateLimit";
import { formatUser, USER_PUBLIC_FIELDS } from "../services/user";
import {
  AdultVerificationError,
  isAdult,
  resolveVerifiedBirthDate,
} from "../services/adultVerification";

const router = Router();

// Google OAuth 클라이언트
const googleClient = new OAuth2Client();

// 허용 가능한 client_id 목록 (웹 + 안드)
const allowedAudiences = [
  config.googleWebClientId,
  config.googleAndroidClientId, // 권장: 추후 iOS도 추가 가능
];

// POST /api/auth/google
router.post("/google", async (req: Request, res: Response) => {
  const { idToken, platform } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: "idToken is required" });
  }

  if (!platform) {
    return res.status(400).json({ error: "platform(web|android)이 필요합니다." });
  }

  try {
    // --- 🔐 1. Google idToken 검증 ---------------------
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: allowedAudiences, // ★ 웹/앱 둘 다 지원하는 핵심 부분!
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Google payload 없음");

    // 기본 필드 추출
    const googleSub = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const avatarUrl = payload.picture;

    // --- 🔐 2. Issuer 확인 (보안 강화) ------------------
    const validIss = ["https://accounts.google.com", "accounts.google.com"];
    if (!payload.iss || !validIss.includes(payload.iss)) {
      throw new Error(`Invalid issuer: ${payload.iss}`);
    }

    // --- 🔐 3. Audience 정보 확인 -----------------------
    if (!allowedAudiences.includes(payload.aud!)) {
      throw new Error(`Unmatched audience: ${payload.aud}`);
    }

    // --- 🔐 4. Android 앱 검증 (선택: azp 체크) --------
    if (platform === "android") {
      if (payload.azp !== config.googleAndroidClientId) {
        console.warn("Android app azp mismatch:", payload.azp);
      }
    }

    // --- 🗄️ 5. 사용자 정보 DB에 upsert --------------------
    const result = await db.query(
      `
      INSERT INTO users (google_sub, email, name, avatar_url, last_login_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (google_sub)
      DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = EXCLUDED.last_login_at
      RETURNING ${USER_PUBLIC_FIELDS};
    `,
      [googleSub, email, name, avatarUrl]
    );

    const user = result.rows[0];

    // --- 🔑 6. Access Token 발급 ------------------------
    const accessToken = createAccessToken(user.id);

    return res.json({
      user: formatUser(user),
      accessToken,
      expiresIn: 3600,
    });
  } catch (err: any) {
    console.error("❌ Google Login Error:", err?.message || err);

    return res.status(401).json({
      error: "Invalid Google idToken",
      detail: err?.message,
    });
  }
});

// POST /api/auth/kakao
router.post("/kakao", async (req: Request, res: Response) => {
  const { accessToken, platform } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: "accessToken is required" });
  }

  if (!platform) {
    return res
      .status(400)
      .json({ error: "platform(web|android|ios)이 필요합니다." });
  }

  try {
    const { kakaoSub, email, name, avatarUrl } =
      await verifyKakaoAccessToken(accessToken);

    const result = await db.query(
      `
      INSERT INTO users (kakao_sub, email, name, avatar_url, last_login_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (kakao_sub)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        last_login_at = EXCLUDED.last_login_at
      RETURNING ${USER_PUBLIC_FIELDS};
    `,
      [kakaoSub, email, name, avatarUrl]
    );

    const user = result.rows[0];
    const jwt = createAccessToken(user.id);

    return res.json({
      user: formatUser(user),
      accessToken: jwt,
      expiresIn: 3600,
    });
  } catch (err: any) {
    console.error("❌ Kakao Login Error:", err?.message || err);

    return res.status(401).json({
      error: "Invalid Kakao accessToken",
      detail: err?.message,
    });
  }
});

// POST /api/auth/email/send-code
router.post(
  "/email/send-code",
  emailSendIpRateLimit,
  async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "유효하지 않은 이메일 형식입니다." });
    }

    const normalizedEmail = normalizeEmail(email);

    try {
      const allowed = await canSendCodeToEmail(normalizedEmail);
      if (!allowed) {
        return res.status(429).json({
          error: "Too many requests",
          detail: "이메일당 1분에 1회만 인증 코드를 요청할 수 있습니다.",
        });
      }

      const code = generateVerificationCode();
      await storeVerificationCode(normalizedEmail, code);
      await sendVerificationEmail(normalizedEmail, code);

      return res.json({
        message: "인증 코드가 발송되었습니다.",
        expiresIn: 300,
      });
    } catch (err: any) {
      console.error("❌ Email Send Code Error:", err?.message || err);

      return res.status(500).json({
        error: "Failed to send verification code",
        detail: err?.message,
      });
    }
  }
);

// POST /api/auth/email/verify
router.post("/email/verify", async (req: Request, res: Response) => {
  const { email, code, name } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email is required" });
  }

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "code is required" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "유효하지 않은 이메일 형식입니다." });
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = code.trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return res.status(400).json({ error: "인증 코드는 6자리 숫자여야 합니다." });
  }

  try {
    const isValid = await verifyCode(normalizedEmail, normalizedCode);
    if (!isValid) {
      return res.status(401).json({
        error: "Invalid verification code",
        detail: "인증 코드가 올바르지 않거나 만료되었습니다.",
      });
    }

    const existing = await db.query(
      `
      SELECT ${USER_PUBLIC_FIELDS}
      FROM users
      WHERE LOWER(email) = $1
      LIMIT 1;
      `,
      [normalizedEmail]
    );

    let user;

    if (existing.rows.length > 0) {
      const result = await db.query(
        `
        UPDATE users
        SET email_verified = true,
            last_login_at = NOW()
        WHERE id = $1
        RETURNING ${USER_PUBLIC_FIELDS};
        `,
        [existing.rows[0].id]
      );
      user = result.rows[0];
    } else {
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          error: "name is required",
          detail: "신규 회원은 이름(name)이 필요합니다.",
        });
      }

      const result = await db.query(
        `
        INSERT INTO users (email, name, email_verified, last_login_at)
        VALUES ($1, $2, true, NOW())
        RETURNING ${USER_PUBLIC_FIELDS};
        `,
        [normalizedEmail, name.trim()]
      );
      user = result.rows[0];
    }

    const accessToken = createAccessToken(user.id);

    return res.json({
      user: formatUser(user),
      accessToken,
      expiresIn: 3600,
    });
  } catch (err: any) {
    console.error("❌ Email Verify Error:", err?.message || err);

    return res.status(500).json({
      error: "Failed to verify email",
      detail: err?.message,
    });
  }
});

// GET /api/auth/me
router.get(
  "/me",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthenticated" });
    }

    const result = await db.query(
      `SELECT ${USER_PUBLIC_FIELDS} FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(formatUser(result.rows[0]));
  }
);

// POST /api/auth/adult/confirm
router.post(
  "/adult/confirm",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = (req as any).userId as string;
    const { impUid, birthDate } = req.body ?? {};

    try {
      const existing = await db.query(
        `SELECT adult_verified, adult_verified_at FROM users WHERE id = $1`,
        [userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      if (existing.rows[0].adult_verified) {
        return res.json({
          adultVerified: true,
          adultVerifiedAt: existing.rows[0].adult_verified_at,
          message: "이미 성인 인증이 완료된 사용자입니다.",
        });
      }

      const verifiedBirthDate = await resolveVerifiedBirthDate({
        impUid: typeof impUid === "string" ? impUid.trim() : undefined,
        birthDate: typeof birthDate === "string" ? birthDate.trim() : undefined,
      });

      if (!isAdult(verifiedBirthDate)) {
        return res.status(403).json({
          error: "UNDERAGE",
          message: "만 19세 미만은 성인 인증을 완료할 수 없습니다.",
        });
      }

      const result = await db.query(
        `
        UPDATE users
        SET adult_verified = true,
            adult_verified_at = NOW()
        WHERE id = $1
        RETURNING adult_verified, adult_verified_at;
        `,
        [userId]
      );

      return res.json({
        adultVerified: result.rows[0].adult_verified,
        adultVerifiedAt: result.rows[0].adult_verified_at,
        message: "성인 인증이 완료되었습니다.",
      });
    } catch (err: any) {
      if (err instanceof AdultVerificationError) {
        const status =
          err.code === "PROVIDER_NOT_CONFIGURED"
            ? 503
            : err.code === "INVALID_REQUEST" || err.code === "INVALID_BIRTH_DATE"
              ? 400
              : 401;

        return res.status(status).json({
          error: err.code,
          message: err.message,
        });
      }

      console.error("❌ Adult Confirm Error:", err?.message || err);

      return res.status(500).json({
        error: "Failed to confirm adult verification",
        detail: err?.message,
      });
    }
  }
);

export default router;
