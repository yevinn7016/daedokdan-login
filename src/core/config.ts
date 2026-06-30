import dotenv from "dotenv";
import path from "path";

// 실행 cwd와 무관하게 프로젝트 루트 .env 로드
dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  override: true,
});

function envTruthy(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

const emailFromName = process.env.EMAIL_FROM_NAME || "대독단";
const emailFromAddress =
  process.env.EMAIL_FROM_ADDRESS ||
  process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ||
  process.env.EMAIL_FROM;

export const config = {
  port: process.env.PORT || 4000,

  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID as string,
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID as string,

  // 카카오 개발자 콘솔 > 앱 설정 > 요약 정보 > 앱 ID (선택: 토큰 app_id 검증용)
  kakaoAppId: process.env.KAKAO_APP_ID
    ? Number(process.env.KAKAO_APP_ID)
    : undefined,

  jwtSecret: process.env.JWT_SECRET as string,
  databaseUrl: process.env.DATABASE_URL as string,

  resendApiKey: process.env.RESEND_API_KEY as string,
  emailFrom: `${emailFromName} <${emailFromAddress}>`,

  // PortOne(아임포트) 본인인증 — imp_uid 검증용
  portoneApiKey: process.env.PORTONE_API_KEY,
  portoneApiSecret: process.env.PORTONE_API_SECRET,

  // feature 서비스 → auth 내부 API 호출용
  internalApiKey: process.env.INTERNAL_API_KEY,

  // true면 birthDate로 로컬 개발용 성인인증 가능 (운영에서는 false)
  adultVerificationDev: envTruthy(process.env.ADULT_VERIFICATION_DEV),
};

if (
  !config.googleWebClientId ||
  !config.googleAndroidClientId ||
  !config.jwtSecret ||
  !config.databaseUrl ||
  !config.resendApiKey ||
  !emailFromAddress
) {
  throw new Error(
    "환경변수(GOOGLE_WEB_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID / JWT_SECRET / DATABASE_URL / RESEND_API_KEY / EMAIL_FROM_ADDRESS)가 없습니다."
  );
}
