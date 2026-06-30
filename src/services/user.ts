export interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  adult_verified?: boolean;
  adult_verified_at?: Date | string | null;
}

export const USER_PUBLIC_FIELDS =
  "id, email, name, avatar_url, adult_verified, adult_verified_at";

export function formatUser(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    adultVerified: user.adult_verified ?? false,
    adultVerifiedAt: user.adult_verified_at ?? null,
  };
}
