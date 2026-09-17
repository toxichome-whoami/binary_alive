import { authenticator } from 'otplib';

export class TotpService {
  public static generateSecret(): string {
    return authenticator.generateSecret();
  }

  public static verifyCode(secret: string, code: string): boolean {
    try {
      return authenticator.verify({ token: code, secret });
    } catch {
      return false;
    }
  }

  public static getOtpAuthUrl(username: string, secret: string, issuer = 'BinaryAlive'): string {
    return authenticator.keyuri(username, issuer, secret);
  }
}
