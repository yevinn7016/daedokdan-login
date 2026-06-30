import { Resend } from "resend";
import { config } from "../core/config";

const resend = new Resend(config.resendApiKey);

export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: config.emailFrom,
    to,
    subject: "[대독단] 이메일 인증 코드",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>대독단 이메일 인증</h2>
        <p>아래 인증 코드를 입력해 주세요.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px;">
          ${code}
        </p>
        <p style="color: #666; font-size: 14px;">이 코드는 5분간 유효합니다.</p>
        <p style="color: #999; font-size: 12px;">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
}
