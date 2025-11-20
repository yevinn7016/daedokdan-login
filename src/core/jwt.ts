import jwt from "jsonwebtoken";
import { config } from "./config";

export interface JwtPayload {
  userId: string;
}

export function createAccessToken(userId: string): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: "1h" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
