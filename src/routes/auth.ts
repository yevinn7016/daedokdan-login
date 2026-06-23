// src/routes/auth.ts

import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../core/config";
import { db } from "../core/db";
import { createAccessToken } from "../core/jwt";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifyKakaoAccessToken } from "../services/kakao";

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
      RETURNING id, email, name, avatar_url;
    `,
      [googleSub, email, name, avatarUrl]
    );

    const user = result.rows[0];

    // --- 🔑 6. Access Token 발급 ------------------------
    const accessToken = createAccessToken(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
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
      RETURNING id, email, name, avatar_url;
    `,
      [kakaoSub, email, name, avatarUrl]
    );

    const user = result.rows[0];
    const jwt = createAccessToken(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
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
      "SELECT id, email, name, avatar_url FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
    });
  }
);

export default router;
