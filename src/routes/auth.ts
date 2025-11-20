import { Router, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { config } from "../core/config";
import { db } from "../core/db";
import { createAccessToken } from "../core/jwt";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();
const googleClient = new OAuth2Client();

// POST /api/auth/google
router.post("/google", async (req: Request, res: Response) => {
  const { idToken, platform } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: "idToken is required" });
  }

  if (!platform) {
    return res
      .status(400)
      .json({ error: "platform(web|android)이 필요합니다." });
  }

  try {
    const audience =
      platform === "android"
        ? config.googleAndroidClientId
        : config.googleWebClientId;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Google payload 없음");

    const googleSub = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const avatarUrl = payload.picture;

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
  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(401).json({ error: "Invalid Google idToken" });
  }
});

// GET /api/auth/me
router.get(
  "/me",
  authMiddleware, // ⚠️ 여기 괄호 X, 그냥 함수 이름만!
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
