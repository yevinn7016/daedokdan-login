import { config } from "../core/config";

export class AdultVerificationError extends Error {
  constructor(
    message: string,
    readonly code: string = "VERIFICATION_FAILED"
  ) {
    super(message);
    this.name = "AdultVerificationError";
  }
}

export function isAdult(birthDate: Date, referenceDate = new Date()): boolean {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 19;
}

export function parseBirthDateString(birthDate: string): Date {
  const normalized = birthDate.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AdultVerificationError(
      "birthDate는 YYYY-MM-DD 형식이어야 합니다.",
      "INVALID_BIRTH_DATE"
    );
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new AdultVerificationError(
      "유효하지 않은 생년월일입니다.",
      "INVALID_BIRTH_DATE"
    );
  }

  return parsed;
}

function parseBirthFromYYMMDD(raw: string | number): Date {
  const digits = String(raw).padStart(6, "0");

  if (!/^\d{6}$/.test(digits)) {
    throw new AdultVerificationError(
      "본인인증 생년월일 형식이 올바르지 않습니다.",
      "INVALID_BIRTH_DATE"
    );
  }

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const currentYear = new Date().getFullYear();
  const century = yy <= currentYear % 100 ? 2000 : 1900;
  const parsed = new Date(century + yy, mm - 1, dd);

  if (parsed.getMonth() !== mm - 1 || parsed.getDate() !== dd) {
    throw new AdultVerificationError(
      "본인인증 생년월일 형식이 올바르지 않습니다.",
      "INVALID_BIRTH_DATE"
    );
  }

  return parsed;
}

interface PortOneTokenResponse {
  code: number;
  message?: string;
  response?: {
    access_token: string;
  };
}

interface PortOneCertificationResponse {
  code: number;
  message?: string;
  response?: {
    certified?: boolean;
    birthday?: string;
    birth?: string | number;
  };
}

async function getPortOneAccessToken(): Promise<string> {
  if (!config.portoneApiKey || !config.portoneApiSecret) {
    throw new AdultVerificationError(
      "PortOne API 설정이 없습니다.",
      "PROVIDER_NOT_CONFIGURED"
    );
  }

  const res = await fetch("https://api.iamport.kr/users/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imp_key: config.portoneApiKey,
      imp_secret: config.portoneApiSecret,
    }),
  });

  if (!res.ok) {
    throw new AdultVerificationError(
      "PortOne 토큰 발급에 실패했습니다.",
      "PROVIDER_ERROR"
    );
  }

  const data = (await res.json()) as PortOneTokenResponse;

  if (data.code !== 0 || !data.response?.access_token) {
    throw new AdultVerificationError(
      data.message || "PortOne 토큰 발급에 실패했습니다.",
      "PROVIDER_ERROR"
    );
  }

  return data.response.access_token;
}

async function verifyPortOneCertification(impUid: string): Promise<Date> {
  const accessToken = await getPortOneAccessToken();

  const res = await fetch(
    `https://api.iamport.kr/certifications/${encodeURIComponent(impUid)}`,
    {
      headers: {
        Authorization: accessToken,
      },
    }
  );

  if (!res.ok) {
    throw new AdultVerificationError(
      "본인인증 결과 조회에 실패했습니다.",
      "PROVIDER_ERROR"
    );
  }

  const data = (await res.json()) as PortOneCertificationResponse;

  if (data.code !== 0 || !data.response) {
    throw new AdultVerificationError(
      data.message || "본인인증 결과가 유효하지 않습니다.",
      "VERIFICATION_FAILED"
    );
  }

  if (!data.response.certified) {
    throw new AdultVerificationError(
      "본인인증이 완료되지 않았습니다.",
      "NOT_CERTIFIED"
    );
  }

  if (data.response.birthday) {
    return parseBirthDateString(data.response.birthday);
  }

  if (data.response.birth !== undefined && data.response.birth !== null) {
    return parseBirthFromYYMMDD(data.response.birth);
  }

  throw new AdultVerificationError(
    "본인인증 결과에 생년월일이 없습니다.",
    "INVALID_BIRTH_DATE"
  );
}

export async function resolveVerifiedBirthDate(input: {
  impUid?: string;
  birthDate?: string;
}): Promise<Date> {
  const { impUid, birthDate } = input;

  if (impUid) {
    return verifyPortOneCertification(impUid);
  }

  if (birthDate && config.adultVerificationDev) {
    return parseBirthDateString(birthDate);
  }

  if (birthDate && !config.adultVerificationDev) {
    throw new AdultVerificationError(
      "개발 모드가 아니면 birthDate를 직접 전달할 수 없습니다.",
      "INVALID_REQUEST"
    );
  }

  if (!config.portoneApiKey && config.adultVerificationDev) {
    throw new AdultVerificationError(
      "impUid 또는 birthDate(dev)가 필요합니다.",
      "INVALID_REQUEST"
    );
  }

  throw new AdultVerificationError(
    "impUid가 필요합니다. PortOne 본인인증 후 imp_uid를 전달하세요.",
    "INVALID_REQUEST"
  );
}
