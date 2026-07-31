import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'crm_secret_jwt_key_2026';
const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7123456789:ABCdefGHIjklMNOpqrsTUVwxyz';

export interface JwtPayload {
  userId: string;
  telegramId: string;
  role: import('./types.js').SystemUserRole;
  displayName?: string;
}

export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN
): { valid: boolean; user?: any; reason?: string } {
  if (!initDataRaw) return { valid: false, reason: 'Empty initData' };

  const isProd = process.env.NODE_ENV === 'production';

  try {
    const urlParams = new URLSearchParams(initDataRaw);
    const hash = urlParams.get('hash');

    if (!hash) {
      if (!isProd) {
        // Test mode fallback ONLY for development and local testing
        if (initDataRaw === 'test_chief') {
          return { valid: true, user: { id: 1001, first_name: 'Шеф', username: 'boss' } };
        }
        if (initDataRaw === 'test_assistant_1') {
          return { valid: true, user: { id: 1002, first_name: 'Анна', username: 'anna_asst' } };
        }
        if (initDataRaw === 'test_assistant_2') {
          return { valid: true, user: { id: 1003, first_name: 'Игорь', username: 'igor_asst' } };
        }
      }
      return { valid: false, reason: 'Missing hash parameter in initData' };
    }

    urlParams.delete('hash');
    const params: [string, string][] = [];
    for (const [key, value] of urlParams.entries()) {
      params.push([key, value]);
    }
    params.sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = params.map(([k, v]) => `${k}=${v}`).join('\n');

    // HMAC-SHA256 signature verification according to Telegram WebApp specification
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');

    const isValid =
      calculatedBuffer.length === hashBuffer.length &&
      crypto.timingSafeEqual(calculatedBuffer, hashBuffer);

    if (isValid) {
      const userStr = urlParams.get('user');
      const user = userStr ? JSON.parse(userStr) : null;
      return { valid: true, user };
    }

    // Dev mode fallback when user parameter is present (ONLY in development)
    if (!isProd && initDataRaw.includes('user=')) {
      try {
        const userStr = urlParams.get('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          return { valid: true, user };
        }
      } catch {
        // Fallback below
      }
    }

    return { valid: false, reason: 'HMAC signature verification failed' };
  } catch (err: any) {
    return { valid: false, reason: err.message || 'Error processing initData' };
  }
}

export function generateJwtToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function telegramAuthMiddleware(req: any, res: any, next: any) {
  const initData =
    (req.headers['x-telegram-init-data'] as string) ||
    (req.headers['telegram-init-data'] as string) ||
    req.body?.initData ||
    req.query?.initData;

  if (!initData) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Отсутствует параметр initData от Telegram WebApp'
    });
  }

  const result = validateTelegramInitData(initData);
  if (!result.valid) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: `Ошибка проверки подписи initData: ${result.reason}`
    });
  }

  req.telegramUser = result.user;
  if (result.user) {
    const chiefTgId = process.env.CHIEF_TELEGRAM_ID || '1001';
    const telegramId = String(result.user.id);
    req.user = {
      userId: 'usr-' + telegramId,
      telegramId,
      role: telegramId === chiefTgId ? 'boss' : 'pending',
      displayName: result.user.first_name || 'Пользователь'
    };
  }

  next();
}
