import { Request, Response, NextFunction } from "express";
import { config } from "../core/config";

export function internalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!config.internalApiKey) {
    return res.status(503).json({
      error: "INTERNAL_API_NOT_CONFIGURED",
      message: "Internal API key is not configured.",
    });
  }

  const apiKey = req.headers["x-internal-api-key"];

  if (typeof apiKey !== "string" || apiKey !== config.internalApiKey) {
    return res.status(401).json({ error: "Invalid internal API key" });
  }

  next();
}
