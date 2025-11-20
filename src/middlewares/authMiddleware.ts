import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../core/jwt";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No Authorization header" });
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ error: "Invalid Authorization header format" });
  }

  try {
    const payload = verifyAccessToken(token);
    (req as any).userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
