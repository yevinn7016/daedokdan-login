import { Router, Request, Response } from "express";
import { db } from "../core/db";
import { internalAuthMiddleware } from "../middlewares/internalAuthMiddleware";

const router = Router();

router.use(internalAuthMiddleware);

// GET /api/internal/users/:userId/adult-status
router.get(
  "/users/:userId/adult-status",
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
      const result = await db.query(
        `
        SELECT id, adult_verified, adult_verified_at
        FROM users
        WHERE id = $1
        LIMIT 1;
        `,
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = result.rows[0];

      return res.json({
        userId: user.id,
        adultVerified: user.adult_verified ?? false,
        adultVerifiedAt: user.adult_verified_at ?? null,
      });
    } catch (err: any) {
      console.error("Internal adult-status error:", err?.message || err);

      return res.status(500).json({
        error: "Failed to fetch adult status",
        detail: err?.message,
      });
    }
  }
);

export default router;
