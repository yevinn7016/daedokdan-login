import { config } from "../core/config";

const KAKAO_API_BASE = "https://kapi.kakao.com";

interface KakaoTokenInfo {
  app_id: number;
  expires_in: number;
  id: number;
}

interface KakaoUserResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
}

export interface KakaoUserProfile {
  kakaoSub: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

async function kakaoFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${KAKAO_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kakao API error (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function verifyKakaoAccessToken(
  accessToken: string
): Promise<KakaoUserProfile> {
  const tokenInfo = await kakaoFetch<KakaoTokenInfo>(
    "/v1/user/access_token_info",
    accessToken
  );

  if (config.kakaoAppId && tokenInfo.app_id !== config.kakaoAppId) {
    throw new Error(`Unmatched Kakao app_id: ${tokenInfo.app_id}`);
  }

  const user = await kakaoFetch<KakaoUserResponse>("/v2/user/me", accessToken);
  const profile = user.kakao_account?.profile;

  return {
    kakaoSub: String(user.id),
    email: user.kakao_account?.email ?? null,
    name: profile?.nickname ?? null,
    avatarUrl:
      profile?.profile_image_url ?? profile?.thumbnail_image_url ?? null,
  };
}
