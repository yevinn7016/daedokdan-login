import dotenv from "dotenv";
dotenv.config();

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
};

if (
  !config.googleWebClientId ||
  !config.googleAndroidClientId ||
  !config.jwtSecret ||
  !config.databaseUrl
) {
  throw new Error(
    "환경변수(GOOGLE_WEB_CLIENT_ID / GOOGLE_ANDROID_CLIENT_ID / JWT_SECRET / DATABASE_URL)가 없습니다."
  );
}
