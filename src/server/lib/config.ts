import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  security: {
    secret_key: string;
    session_timeout_minutes: number;
    allowed_ips: string[];
    force_https: boolean;
  };
  system: {
    app_name: string;
    version: string;
  };
}

export class ConfigService {
  public static get(): AppConfig {
    const allowedIpsStr = process.env.ALLOWED_IPS || '';
    const allowed_ips = allowedIpsStr
      ? allowedIpsStr.split(',').map((ip) => ip.trim()).filter(Boolean)
      : [];

    return {
      security: {
        secret_key: process.env.SECRET_KEY || (() => { throw new Error('FATAL: SECRET_KEY missing'); })(),
        session_timeout_minutes: Math.max(1, Math.min(480, Number(process.env.SESSION_TIMEOUT_MINUTES) || 15)),
        allowed_ips,
        force_https: process.env.FORCE_HTTPS === 'true',
      },
      system: {
        app_name: process.env.APP_NAME || 'Binary Alive',
        version: process.env.VERSION || '2.4.1',
      },
    };
  }

  public static save(_config: Partial<AppConfig>): void {
    // Configuration files are disabled. Configuration is managed securely via .env
  }
}
