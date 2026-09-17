import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

const CONFIG_PATH = path.resolve(process.cwd(), 'config.json');

export class ConfigService {
  private static cachedConfig: AppConfig | null = null;

  public static get(): AppConfig {
    if (this.cachedConfig) return this.cachedConfig;

    if (fs.existsSync(CONFIG_PATH)) {
      try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        this.cachedConfig = JSON.parse(raw);
        return this.cachedConfig!;
      } catch (err) {
        console.error('[Config] Error reading config.json:', err);
      }
    }

    // Default configuration
    const defaultConfig: AppConfig = {
      security: {
        secret_key: crypto.randomBytes(32).toString('hex'),
        session_timeout_minutes: 15,
        allowed_ips: [],
        force_https: true,
      },
      system: {
        app_name: 'Binary Alive',
        version: '2.0.0',
      },
    };

    this.cachedConfig = defaultConfig;
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
    } catch (err) {
      console.error('[Config] Error writing default config.json:', err);
    }
    return defaultConfig;
  }

  public static save(config: Partial<AppConfig>): void {
    const current = this.get();
    const updated = {
      ...current,
      ...config,
      security: {
        ...current.security,
        ...(config.security || {}),
      },
      system: {
        ...current.system,
        ...(config.system || {}),
      },
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
    this.cachedConfig = updated;
  }
}
