import { Request, Response, NextFunction } from "express";
import { db } from "../core/db";

export async function requireAdultVerified(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    return res.status(401).json({ error: "UNAUTHENTICATED" });
  }

  try {
    const result = await db.query(
      "SELECT adult_verified FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!result.rows[0].adult_verified) {
      return res.status(403).json({
        error: "ADULT_VERIFICATION_REQUIRED",
        message: "성인 인증이 필요합니다.",
      });
    }

    next();
  } catch (err) {
    console.error("requireAdultVerified error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
