import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,

  googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID as string,
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID as string,

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
