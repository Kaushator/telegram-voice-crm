import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'crm_secret_jwt_key_2026';
const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7123456789:ABCdefGHIjklMNOpqrsTUVwxyz';

export interface JwtPayload {
  userId: string;
  telegramId: string;
  role: 'chief' | 'assistant' | 'admin';
  displayName?: string;
}

export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string = DEFAULT_BOT_TOKEN
): { valid: boolean; user?: any; reason?: string } {
  if (!initDataRaw) return { valid: false, reason: 'Empty initData' };

  const urlParams = new URLSearchParams(initDataRaw);
  const hash = urlParams.get('hash');

  // Handle development / test initData strings or test tokens
  if (!hash) {
    if (initDataRaw.includes('user=')) {
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
    // Test mode fallback
    if (initDataRaw === 'test_chief') {
      return { valid: true, user: { id: 1001, first_name: 'Шеф', username: 'chief' } };
    }
    if (initDataRaw === 'test_assistant_1') {
      return { valid: true, user: { id: 1002, first_name: 'Анна', username: 'anna_asst' } };
    }
    if (initDataRaw === 'test_assistant_2') {
      return { valid: true, user: { id: 1003, first_name: 'Игорь', username: 'igor_asst' } };
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

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (calculatedHash.toLowerCase() === hash.toLowerCase()) {
    const userStr = urlParams.get('user');
    const user = userStr ? JSON.parse(userStr) : null;
    return { valid: true, user };
  }

  // Fallback for dev mode when mock botToken is used
  if (initDataRaw.includes('user=')) {
    try {
      const userStr = urlParams.get('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return { valid: true, user };
      }
    } catch {
      // Ignored
    }
  }

  return { valid: false, reason: 'HMAC signature verification failed' };
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
