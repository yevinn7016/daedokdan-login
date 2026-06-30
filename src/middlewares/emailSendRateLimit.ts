import rateLimit from "express-rate-limit";

export const emailSendIpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    detail: "IP당 시간당 10회까지만 인증 코드를 요청할 수 있습니다.",
  },
});
