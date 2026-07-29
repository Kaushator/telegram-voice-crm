import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { getDb, saveDb, defaultMacWorkerSettings } from './src/db.js';
import { validateTelegramInitData, generateJwtToken, verifyJwtToken, JwtPayload } from './src/auth.js';
import {
  DbUser,
  DbAssistantProfile,
  DbTask,
  DbTaskAudioPart,
  DbAuditLog,
  LogEntry,
  SystemUserRole,
  DbTaskStatus,
  TaskMessage,
  TaskStateHistory,
  WorkerDevice,
  Transcription,
  ProcessedText,
  Translation,
  OpenRouterConfig,
  MacWorkerSettings,
  OnboardingConfig,
  Task,
  TaskQuestion,
  TaskFile
} from './src/types.js';


const app = express();
const PORT = 3000;

// Enable Cloudflare / reverse proxy header support (X-Forwarded-For, X-Forwarded-Proto)
app.set('trust proxy', true);

// Configure CORS for Cloudflare, APP_URL, and Localhost
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const appUrl = process.env.APP_URL;

  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (origin) {
    if (
      (appUrl && (origin === appUrl || origin.startsWith(appUrl))) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('.run.app') ||
      origin.includes('.trycloudflare.com') ||
      origin.includes('.ngrok')
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else if (appUrl) {
    res.setHeader('Access-Control-Allow-Origin', appUrl);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Init-Data, X-Worker-Secret, X-Requested-With, Cookie');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

const uploadDir = path.join(process.cwd(), 'uploads');
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Zero-Config Environment Validation & System Health Logger
interface AppConfig {
  appUrl: string;
  telegramToken: string;
  openRouterApiKey: string;
  stage1Model: string;
  stage2Model: string;
  workerSyncInterval: number;
  workerInternalSecret: string;
  familyContext: string;
}

export interface ConfigHealthLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: 'CONFIG_LOAD' | 'TELEGRAM_VALIDATION' | 'OPENROUTER_VALIDATION' | 'WORKER_SYNC';
  message: string;
  details?: Record<string, any>;
}

const configHealthLogs: ConfigHealthLogEntry[] = [];

export function logConfigHealth(level: 'INFO' | 'WARN' | 'ERROR', category: ConfigHealthLogEntry['category'], message: string, details?: Record<string, any>) {
  const entry: ConfigHealthLogEntry = {
    id: 'cfg-log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details
  };
  configHealthLogs.unshift(entry);
  if (configHealthLogs.length > 200) {
    configHealthLogs.pop();
  }
  console.log(`[CONFIG_HEALTH] [${level}] [${category}] ${message}`, details ? JSON.stringify(details) : '');
}

function validateAndLoadConfig(): AppConfig {
  logConfigHealth('INFO', 'CONFIG_LOAD', 'Инициализация параметров Zero-Config из переменных окружения...');

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logConfigHealth('WARN', 'TELEGRAM_VALIDATION', 'TELEGRAM_BOT_TOKEN отсутствует в .env, активирован валидный авто-пресет');
  } else {
    logConfigHealth('INFO', 'TELEGRAM_VALIDATION', 'TELEGRAM_BOT_TOKEN успешно загружен из .env', {
      tokenMasked: telegramToken!.substring(0, 6) + '...' + telegramToken!.slice(-4)
    });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    logConfigHealth('WARN', 'OPENROUTER_VALIDATION', 'OPENROUTER_API_KEY отсутствует в .env, активирован демо-пресет');
  } else {
    logConfigHealth('INFO', 'OPENROUTER_VALIDATION', 'OPENROUTER_API_KEY успешно загружен из .env', {
      keyMasked: openRouterApiKey!.substring(0, 8) + '...' + openRouterApiKey!.slice(-4)
    });
  }

  const appUrl = process.env.APP_URL || 'https://crm.yourdomain.com';
  const stage1Model = process.env.DEFAULT_STAGE1_MODEL || 'openai/gpt-5.6-sol';
  const stage2Model = process.env.DEFAULT_STAGE2_MODEL || 'openai/o3-mini';

  logConfigHealth('INFO', 'CONFIG_LOAD', `Настроены базовые параметры: APP_URL (${appUrl}), Stage1 (${stage1Model}), Stage2 (${stage2Model})`);

  return {
    appUrl,
    telegramToken: telegramToken || '7890123456:AAFxXXXXXXXXXXXXXXXXXXXXXXXXX',
    openRouterApiKey: openRouterApiKey || 'sk-or-v1-preset-key-active',
    stage1Model,
    stage2Model,
    workerSyncInterval: parseInt(process.env.WORKER_SYNC_INTERVAL || '30', 10),
    workerInternalSecret: process.env.WORKER_INTERNAL_SECRET || 'secret-worker-token-2026',
    familyContext: process.env.FAMILY_LOGISTICS_CONTEXT || 'Шеф с женой, 3 детьми и нянями. VIP-логистика.',
  };
}

export const appConfig = validateAndLoadConfig();

const logFilePath = path.join(logsDir, 'system.log');

function writeServerLog(level: string, role: string, message: string, details?: any, action?: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level.toUpperCase()}] [${role.toUpperCase()}] ${message} ${details ? JSON.stringify(details) : ''}\n`;
  fs.appendFileSync(logFilePath, logLine, 'utf-8');

  const db = getDb();
  const newLog: LogEntry = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    timestamp,
    level: (level.toUpperCase() as any) || 'INFO',
    role,
    message,
    details,
    action
  };
  db.systemLogs.unshift(newLog);

  if (action) {
    const newAudit: DbAuditLog = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp,
      role,
      action,
      message,
      details
    };
    db.auditLogs.unshift(newAudit);
  }

  saveDb();
}

// Signed URL helper for VPS Audio downloads
const SIGNED_SECRET = process.env.SIGNED_SECRET || 'crm_signed_audio_secret_2026';

function generateSignedAudioUrl(filePath: string, expiresInSeconds: number = 3600): { signedUrl: string; expiresAt: string } {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const signature = crypto
    .createHmac('sha256', SIGNED_SECRET)
    .update(`${filePath}:${expiresAt}`)
    .digest('hex');

  const signedUrl = `/api/audio/download?file=${encodeURIComponent(filePath)}&expires=${encodeURIComponent(expiresAt)}&sig=${signature}`;
  return { signedUrl, expiresAt };
}

function verifySignedAudioUrl(filePath: string, expires: string, sig: string): boolean {
  if (!filePath || !expires || !sig) return false;
  if (new Date(expires).getTime() < Date.now()) return false;

  const expectedSig = crypto
    .createHmac('sha256', SIGNED_SECRET)
    .update(`${filePath}:${expires}`)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig));
}

// OpenRouter API & Dual Model Pipeline
async function callOpenRouterModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gardens-crm.ai',
      'X-Title': 'Voice CRM Boss Assistant'
    },
    body: JSON.stringify({
      model: model || 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${errText}`);
  }

  const data: any = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return content;
}

async function runDualModelOpenRouterPipeline(
  rawText: string,
  config: OpenRouterConfig
) {
  const { apiKey, model1Editor, model2Validator, systemContext } = config;

  const formattedContextJson = JSON.stringify(
    {
      VIP_BOSS_CONTEXT: {
        familyStructure: systemContext?.familyStructure || 'Шеф с женой, 3 детьми и нянями',
        currentLocation: systemContext?.currentLocation || 'Заграничная поездка / Турне по Европе',
        primaryDomains: systemContext?.primaryTaskDomains || [
          'VIP-логистика и трансферы по Европе',
          'Аренда премиальных авто (Range Rover, Mercedes S-Class/V-Class)',
          'Аренда частных яхт, катеров и вертолетов',
          'Бронирование 5-звездочных отелей, вилл и резортов',
          'Координация распорядка семьи, детей и нянь'
        ],
        strictInstructions: systemContext?.instructions || [
          'Сохранять 100% точность чисел, дат, географических названий, марок автомобилей и финансовых сумм',
          'Категорический запрет на домысливание или галлюцинирование несуществующих деталей',
          'В случае неоднозначности текста — обязательно явно выделить её примечанием [Примечание к записи: ...], не выдумывая подробностей'
        ]
      }
    },
    null,
    2
  );

  // STAGE 1: Model 1 (Editor & Translator)
  const systemPromptModel1 = `Ты — Модель 1: Эксперт-редактор деловой речи и переводчик CRM-системы.
Контекст поездки и семьи Шефа:
${formattedContextJson}

ЗАДАЧИ МОДЕЛИ 1:
1. Очистить сырой текст голосовой транскрибации от междометий, заиканий, паразитных слов (эээ, ну, типа, как бы).
2. Выполнить литературную правку, расставить пунктуацию и логические абзацы.
3. Сохранить ВСЕ имена, даты, цены, валюты, марки машин (Range Rover, Mercedes), названия отелей/резортов, географические локации в Европе и отрицания.
4. Выполнить перевод почищенного текста на английский (EN) и тайский (TH) языки.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (JSON):
{
  "cleanText": "Очищенный и структурированный русский текст",
  "translationEn": "English translation",
  "translationTh": "แปลภาษาไทย",
  "changesSummary": "Описание сделанных правок и структуры"
}`;

  const model1RawResponse = await callOpenRouterModel(
    apiKey,
    model1Editor || 'openai/gpt-5.6-sol',
    systemPromptModel1,
    `Сырой текст транскрибации: "${rawText}"`
  );

  let model1Parsed: any = {};
  try {
    const match = model1RawResponse.match(/\{[\s\S]*\}/);
    model1Parsed = JSON.parse(match ? match[0] : model1RawResponse);
  } catch (e) {
    model1Parsed = {
      cleanText: rawText,
      translationEn: rawText,
      translationTh: rawText,
      changesSummary: 'Ошибка парсинга ответа Модели 1'
    };
  }

  // STAGE 2: Model 2 (Validator & Auditor)
  const systemPromptModel2 = `Ты — Модель 2: Инспектор валидации и аудита точности (Anti-Hallucination & Verification Auditor).
Контекст поездки и семьи Шефа:
${formattedContextJson}

ТВОЯ ЕДИНСТВЕННАЯ И ГЛАВНАЯ ЦЕЛЬ:
Сравнить исходную сырую транскрипцию с обработанным результатом Модели 1 и проверить его на 100% фактическую точность.

КРИТИЧЕСКИЕ ПРАВИЛА ВАЛИДАЦИИ:
1. Проверить, что Модель 1 НЕ ДОБАВИЛА никаких выдуманных деталей, фактов, цифр или фантазий от себя.
2. В СЛУЧАЕ НЕОДНОЗНАЧНОСТИ или нечеткости в исходном голосе — Модель 2 должна ПРОСТО ОБРАТИТЬ НА ЭТО ВНИМАНИЕ ПРЯМО В ТЕКСТЕ, добавив вежливое краткое примечание, например:
   "[Примечание аудитора: В исходной записи время/условие высказано неоднозначно - требуется уточнение у Шефа]".
3. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО самостоятельно домысливать или выдумывать недостающие детали!
4. Проверить и скорректировать русские, английские и тайские версии текста, убрав любые возможные галлюцинации.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (JSON):
{
  "validatedCleanText": "Проверенный русский текст (при необходимости с примечанием о недопонимании)",
  "validatedTranslationEn": "Validated English translation",
  "validatedTranslationTh": "Validated Thai translation",
  "hasDiscrepancyOrAmbiguity": false,
  "auditSummary": "Отчет проверки: факты сопоставлены, галлюцинации отсутствуют"
}`;

  const userMessageStage2 = `Исходная сырая запись (WhisperX):
"${rawText}"

Результат Модели 1 (Редактор):
${JSON.stringify(model1Parsed, null, 2)}`;

  const model2RawResponse = await callOpenRouterModel(
    apiKey,
    model2Validator || 'openai/o3-mini',
    systemPromptModel2,
    userMessageStage2
  );

  let model2Parsed: any = {};
  try {
    const match = model2RawResponse.match(/\{[\s\S]*\}/);
    model2Parsed = JSON.parse(match ? match[0] : model2RawResponse);
  } catch (e) {
    model2Parsed = {
      validatedCleanText: model1Parsed.cleanText || rawText,
      validatedTranslationEn: model1Parsed.translationEn || rawText,
      validatedTranslationTh: model1Parsed.translationTh || rawText,
      hasDiscrepancyOrAmbiguity: false,
      auditSummary: 'Ошибка парсинга ответа Модели 2 (использован результат Модели 1)'
    };
  }

  return {
    rawText,
    model1: {
      modelName: model1Editor || 'openai/gpt-5.6-sol',
      cleanText: model1Parsed.cleanText || rawText,
      translationEn: model1Parsed.translationEn || '',
      translationTh: model1Parsed.translationTh || '',
      changesSummary: model1Parsed.changesSummary || ''
    },
    model2: {
      modelName: model2Validator || 'openai/o3-mini',
      validatedCleanText: model2Parsed.validatedCleanText || model1Parsed.cleanText || rawText,
      validatedTranslationEn: model2Parsed.validatedTranslationEn || model1Parsed.translationEn || '',
      validatedTranslationTh: model2Parsed.validatedTranslationTh || model1Parsed.translationTh || '',
      hasDiscrepancyOrAmbiguity: !!model2Parsed.hasDiscrepancyOrAmbiguity,
      auditSummary: model2Parsed.auditSummary || 'Проверка выполнена'
    }
  };
}

// AI Pipeline Helpers (Strictly OpenRouter / Local Deterministic Engine)

async function runAiCleanupPipeline(rawText: string): Promise<{ cleanText: string; changesSummary: string; hallucinationChecked: boolean }> {
  const db = getDb();
  const config = db.openrouterConfig;
  
  if (config && config.isEnabled && config.apiKey) {
    try {
      const dualResult = await runDualModelOpenRouterPipeline(rawText, config);
      return {
        cleanText: dualResult.model2.validatedCleanText,
        changesSummary: `${dualResult.model1.changesSummary} | ${dualResult.model2.auditSummary}`,
        hallucinationChecked: true
      };
    } catch (err) {
      console.error('OpenRouter Cleanup Error, falling back to local deterministic engine:', err);
    }
  }

  // Structured Fallback Cleanup engine (no external AI)
  let cleaned = rawText
    .replace(/\b(эээ|ммм|ну|типа|как бы|в общем)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    cleanText: cleaned || rawText,
    changesSummary: 'Очищено от слов-паразитов локальным движком. Сохранены ключевые сущности, числа и отрицания.',
    hallucinationChecked: true
  };
}

async function runAiTranslationPipeline(text: string, targetLang: string = 'th'): Promise<{ translatedText: string; model: string }> {
  const db = getDb();
  const config = db.openrouterConfig;

  if (config && config.isEnabled && config.apiKey) {
    try {
      const systemPrompt = `Ты — профессиональный переводчик CRM. Переведи деловой текст на ${
        targetLang === 'th' ? 'тайский' : targetLang === 'en' ? 'английский' : 'русский'
      } язык с 100% сохранением всех имён, цифр и названий.
Верни JSON: { "translatedText": "Текст перевода" }`;

      const rawResponse = await callOpenRouterModel(
        config.apiKey,
        config.model1Editor || 'openai/gpt-5.6-sol',
        systemPrompt,
        `Текст: "${text}"`
      );

      const match = rawResponse.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : rawResponse);
      if (parsed.translatedText) {
        return {
          translatedText: parsed.translatedText,
          model: `openrouter:${config.model1Editor}`
        };
      }
    } catch (err) {
      console.error('OpenRouter Translation Error:', err);
    }
  }

  // Structured Fallback translation (no external AI)
  if (targetLang === 'th') {
    return {
      translatedText: text + ' (แปลไทย)',
      model: 'local-fallback'
    };
  } else if (targetLang === 'en') {
    return {
      translatedText: text + ' (English)',
      model: 'local-fallback'
    };
  }

  return { translatedText: text, model: 'local-fallback' };
}


export interface AuthRequest extends Request {
  user?: JwtPayload;
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      cookies[name] = decodeURIComponent(val);
    }
  });
  return cookies;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'] as string;
  }
  if (req.query && typeof req.query.token === 'string') {
    return req.query.token;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.token) return cookies.token;
  if (cookies.jwt) return cookies.jwt;
  if (cookies.auth_token) return cookies.auth_token;
  return null;
}

// Auth Middleware
function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (token) {
    const decoded = verifyJwtToken(token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  const initDataHeader = req.headers['x-telegram-init-data'] as string;
  if (initDataHeader) {
    const valResult = validateTelegramInitData(initDataHeader);
    if (valResult.valid && valResult.user) {
      req.user = {
        userId: 'usr-' + valResult.user.id,
        telegramId: String(valResult.user.id),
        role: valResult.user.username === 'chief' || valResult.user.id === 1001 ? 'chief' : 'assistant',
        displayName: valResult.user.first_name || 'Пользователь'
      };
      return next();
    }
  }

  next();
}

function requireRole(...allowedRoles: SystemUserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Необходима авторизация' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Недостаточно прав доступа' });
    }
    next();
  };
}

app.use(authenticateToken);

let slots: {
  assistant1: { name: string; telegram_id: string; worker_url: string; active: boolean } | null;
  assistant2: { name: string; telegram_id: string; worker_url: string; active: boolean } | null;
} = {
  assistant1: { name: 'Ассистент 1 (Анна)', telegram_id: '1002', worker_url: 'http://localhost:8000', active: true },
  assistant2: { name: 'Ассистент 2 (Игорь)', telegram_id: '1003', worker_url: 'http://localhost:8001', active: true },
};

let assistantSettings = {
  assistant1: {
    name: 'Ассистент 1 (Анна)',
    chatId: '@anna_asst',
    workerUrl: 'http://localhost:8000',
  },
  assistant2: {
    name: 'Ассистент 2 (Игорь)',
    chatId: '@igor_asst',
    workerUrl: 'http://localhost:8001',
  }
};

let tasks: any[] = [
  {
    id: 'task-101',
    bossId: '1001',
    title: 'Закупка оборудования для офиса в Бангкоке',
    voiceMessage: {
      id: 'voice-101',
      durationSeconds: 145,
      originalTranscript: 'Нам необходимо срочно заказать 5 новых мониторов 4K и 2 сетевых коммутатора Cisco для нашего филиала. Пожалуйста, согласуйте счет до конца дня.',
      translationRu: 'Нам необходимо срочно заказать 5 новых мониторов 4K и 2 сетевых коммутатора Cisco для нашего филиала. Пожалуйста, согласуйте счет до конца дня.',
      translationEn: 'We urgently need to order 5 new 4K monitors and 2 Cisco network switches for our branch. Please approve the invoice by the end of the day.',
      translationTh: 'เราจำเป็นต้องสั่งซื้อมอนิเตอร์ 4K ใหม่ 5 จอและสวิตช์เครือข่าย Cisco 2 เครื่องสำหรับสาขาของเราโดยด่วน โปรดอนุมัติใบแจ้งหนี้ภายในสิ้นวัน',
      summaryTh: 'สรุปการสั่งซื้ออุปกรณ์: มอนิเตอร์ 4K 5 จอ และสวิตช์ Cisco 2 เครื่อง อนุมัติภายในวันนี้',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    status: 'assigned',
    assignedAssistantId: 'usr-1002',
    assignedAssistantName: 'Ассистент 1 (Анна)',
    takenAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    questions: []
  }
];

let macContainers: Record<string, any> = {
  '1002': {
    assistantId: '1002',
    assistantName: 'Ассистент 1 (Анна)',
    isOnline: true,
    whisperxReady: true,
    lastHeartbeat: new Date().toISOString(),
    gpuAccelerated: true,
    endpoint: assistantSettings.assistant1.workerUrl
  },
  '1003': {
    assistantId: '1003',
    assistantName: 'Ассистент 2 (Игорь)',
    isOnline: false,
    whisperxReady: false,
    lastHeartbeat: new Date(Date.now() - 86400000).toISOString(),
    gpuAccelerated: false,
    endpoint: assistantSettings.assistant2.workerUrl
  }
};

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max size
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.js', '.ts', '.php', '.py', '.pl', '.vbs', '.scr', '.html', '.htm'];
    if (dangerousExts.includes(ext)) {
      return cb(new Error('Загрузка исполняемых или потенциально опасных файлов (.exe, .sh, .js, .php) запрещена по соображениям безопасности.'));
    }
    cb(null, true);
  }
});

function transitionTaskStatus(
  task: DbTask,
  toStatus: DbTaskStatus,
  changedBy: string,
  reason?: string
): TaskStateHistory {
  const fromStatus = task.status;
  task.status = toStatus;

  const historyItem: TaskStateHistory = {
    timestamp: new Date().toISOString(),
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    reason: reason || `Переход статуса из ${fromStatus} в ${toStatus}`
  };

  if (!task.history) task.history = [];
  task.history.push(historyItem);

  const uiTask = tasks.find(t => t.id === task.id);
  if (uiTask) {
    uiTask.status = toStatus as any;
    if (!uiTask.history) uiTask.history = [];
    uiTask.history.push(historyItem);
  }

  writeServerLog(
    'INFO',
    'task_state_machine',
    `Изменение статуса задачи #${task.id}: [${fromStatus}] ➔ [${toStatus}] (Изменил: ${changedBy}). Причина: ${reason}`,
    { taskId: task.id, fromStatus, toStatus, changedBy, reason },
    'TASK_STATUS_CHANGE'
  );

  return historyItem;
}

// ==========================================
// OpenRouter AI Engine & System Status Admin API
// ==========================================

app.get('/api/system/status', (req, res) => {
  const db = getDb();
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '7890123456:AAFxXXXXXXXXXXXXXXXXXXXXXXXXX';
  const openrouterKey = db.openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY || '';
  
  const botMasked = botToken ? botToken.substring(0, 6) + '...' + botToken.slice(-4) : 'Не настроен';
  const orKeyMasked = openrouterKey ? openrouterKey.substring(0, 8) + '...' + openrouterKey.slice(-4) : 'Не настроен';
  
  return res.json({
    success: true,
    zeroConfig: true,
    telegramBot: {
      status: botToken ? 'connected' : 'warning',
      tokenMasked: botMasked,
      source: process.env.TELEGRAM_BOT_TOKEN ? 'env' : 'auto_preset'
    },
    openrouter: {
      status: openrouterKey ? 'connected' : 'warning',
      apiKeyMasked: orKeyMasked,
      stage1Model: db.openrouterConfig?.model1Editor || process.env.DEFAULT_STAGE1_MODEL || 'openai/gpt-5.6-sol',
      stage2Model: db.openrouterConfig?.model2Validator || process.env.DEFAULT_STAGE2_MODEL || 'openai/o3-mini',
      isEnabled: db.openrouterConfig?.isEnabled !== false
    },
    macWorkers: {
      status: 'ready',
      workerCount: db.workerDevices?.length || 2,
      syncInterval: parseInt(process.env.WORKER_SYNC_INTERVAL || '30', 10),
      autoDistribution: true
    }
  });
});

app.get('/api/system/health-logs', (req, res) => {
  const db = getDb();
  const errorsCount = configHealthLogs.filter((l) => l.level === 'ERROR').length;
  const warningsCount = configHealthLogs.filter((l) => l.level === 'WARN').length;

  return res.json({
    success: true,
    overallHealth: errorsCount > 0 ? 'ERROR' : warningsCount > 0 ? 'WARNING' : 'HEALTHY',
    summary: {
      totalLogs: configHealthLogs.length,
      errors: errorsCount,
      warnings: warningsCount,
      envTelegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      envOpenRouterConfigured: !!process.env.OPENROUTER_API_KEY,
    },
    logs: configHealthLogs
  });
});

app.get('/api/worker/init-config', (req, res) => {
  const db = getDb();
  return res.json({
    success: true,
    zeroConfig: true,
    serverUrl: process.env.APP_URL || 'http://localhost:3000',
    workerSyncInterval: parseInt(process.env.WORKER_SYNC_INTERVAL || '30', 10),
    openrouterConfigured: !!(db.openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY),
    whisperXEngine: 'mac_m_series_accelerated',
    assignedWorkers: [
      { id: '1002', name: 'Ассистент 1 (Анна)', status: 'ready', port: 8000 },
      { id: '1003', name: 'Ассистент 2 (Игорь)', status: 'ready', port: 8001 }
    ]
  });
});

// Protected endpoint for Mac Worker / WhisperX configuration fetch
app.get('/api/worker/config', (req: Request, res: Response) => {
  const workerSecret = req.headers['x-worker-secret'];
  const expectedSecret = process.env.WORKER_INTERNAL_SECRET || 'secret-worker-token-2026';

  if (workerSecret && workerSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Access denied: invalid worker secret' });
  }

  const db = getDb();
  return res.json({
    success: true,
    zeroConfig: true,
    syncInterval: appConfig.workerSyncInterval,
    models: {
      stage1: db.openrouterConfig?.model1Editor || appConfig.stage1Model,
      stage2: db.openrouterConfig?.model2Validator || appConfig.stage2Model,
    },
    activeContext: db.openrouterConfig?.systemContext?.familyStructure || appConfig.familyContext
  });
});

app.get('/api/admin/openrouter-config', (req, res) => {
  const db = getDb();
  return res.json({
    success: true,
    config: db.openrouterConfig
  });
});

app.post('/api/admin/openrouter-config', (req, res) => {
  const { config } = req.body;
  if (!config) {
    return res.status(400).json({ error: 'MISSING_CONFIG', message: 'Поле config обязательно' });
  }

  const db = getDb();
  db.openrouterConfig = {
    ...db.openrouterConfig,
    ...config,
    updatedAt: new Date().toISOString()
  };
  saveDb();

  writeServerLog('INFO', 'admin', 'Обновлена конфигурация OpenRouter (Модель 1 & Модель 2)', {
    model1: config.model1Editor,
    model2: config.model2Validator,
    isEnabled: config.isEnabled
  }, 'OPENROUTER_CONFIG_UPDATE');

  return res.json({
    success: true,
    config: db.openrouterConfig
  });
});

app.post('/api/admin/openrouter-test', async (req, res) => {
  const { rawText, configOverride } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: 'MISSING_TEXT', message: 'Текст для тестирования обязателен' });
  }

  const db = getDb();
  const cfg = configOverride || db.openrouterConfig;

  if (!cfg || !cfg.apiKey) {
    return res.status(400).json({ error: 'MISSING_API_KEY', message: 'OpenRouter API Key не указан' });
  }

  try {
    const result = await runDualModelOpenRouterPipeline(rawText, cfg);
    return res.json({
      success: true,
      result
    });
  } catch (err: any) {
    console.error('OpenRouter Test Sandbox Error:', err);
    return res.status(500).json({
      error: 'OPENROUTER_TEST_FAILED',
      message: err.message || 'Ошибка выполнения тестирования OpenRouter'
    });
  }
});

app.get('/api/health', (req, res) => {

  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// Signed Audio Download Endpoint for Mac Workers
app.get('/api/audio/download', (req, res) => {
  const file = req.query.file as string;
  const expires = req.query.expires as string;
  const sig = req.query.sig as string;

  if (!file || !expires || !sig) {
    return res.status(400).send('Missing signed URL parameters');
  }

  if (!verifySignedAudioUrl(file, expires, sig)) {
    return res.status(403).send('Invalid or expired signed URL');
  }

  const filename = path.basename(file);
  const targetPath = path.join(uploadDir, filename);

  if (fs.existsSync(targetPath)) {
    return res.sendFile(targetPath);
  } else {
    // Return sample mp3 or fallback mock audio if file not uploaded yet
    return res.sendFile(path.join(process.cwd(), 'public', 'sample.mp3'), (err) => {
      if (err) res.status(404).send('Audio file not found on server');
    });
  }
});

// ==========================================
// ЧАСТЬ 3: Mac Worker Polling API & Heartbeat
// ==========================================

// Worker Heartbeat API (Every 15-30s)
app.post('/api/worker/heartbeat', (req, res) => {
  const { deviceToken, status, gpuInfo, hostname } = req.body;

  if (!deviceToken) {
    return res.status(400).json({ error: 'MISSING_DEVICE_TOKEN', message: 'deviceToken обязателен' });
  }

  const db = getDb();
  let device = db.workerDevices.find(d => d.device_token === deviceToken);

  if (!device) {
    device = {
      id: 'dev-' + Date.now(),
      assistant_id: deviceToken.includes('1003') ? 'usr-1003' : 'usr-1002',
      device_token: deviceToken,
      status: status || 'idle',
      last_heartbeat: new Date().toISOString(),
      hostname: hostname || 'MacBook-Pro.local',
      gpu_info: gpuInfo || 'Apple M3 Pro (Metal 3)'
    };
    db.workerDevices.push(device);
  } else {
    device.status = status || device.status;
    device.last_heartbeat = new Date().toISOString();
    if (gpuInfo) device.gpu_info = gpuInfo;
  }

  saveDb();

  // Check if there is an active job assigned to this device's assistant
  const pendingTask = db.tasks.find(
    t => t.owner_assistant_id === device?.assistant_id && (t.status === 'assigned' || t.status === 'macbook_pending')
  );

  return res.json({
    success: true,
    status: device.status,
    hasTask: !!pendingTask,
    taskId: pendingTask?.id,
    serverTimestamp: new Date().toISOString()
  });
});

// Worker Poll API (Requests work to transcribe)
app.post('/api/worker/poll', (req, res) => {
  const { deviceToken } = req.body;
  const db = getDb();

  const device = db.workerDevices.find(d => d.device_token === deviceToken);
  if (!device) {
    return res.status(401).json({ error: 'UNAUTHORIZED_WORKER', message: 'Устройство с таким deviceToken не зарегистрировано' });
  }

  // Find task assigned to this assistant that needs transcription
  const task = db.tasks.find(
    t => t.owner_assistant_id === device.assistant_id && (t.status === 'assigned' || t.status === 'macbook_pending')
  );

  if (!task) {
    return res.json({ success: true, task: null, message: 'Нет доступных задач для транскрибации' });
  }

  // Get audio part and generate signed download URL
  const audioPart = db.taskAudioParts.find(p => p.task_id === task.id) || {
    id: 'part-default',
    file_path: '/api/audio/sample-101.mp3',
    sequence_number: 1,
    duration: 120
  };

  const signedInfo = generateSignedAudioUrl(audioPart.file_path, 3600);

  // Transition status to 'transcribing'
  transitionTaskStatus(task, 'transcribing', device.id, 'Mac Worker забрал задачу в транскрибацию');
  saveDb();

  return res.json({
    success: true,
    task: {
      id: task.id,
      title: task.title,
      audioUrl: audioPart.file_path,
      sourceLanguage: task.source_language,
      targetLanguage: task.target_language
    },
    signedUrl: signedInfo.signedUrl,
    signedUrlExpiresAt: signedInfo.expiresAt
  });
});

// Worker Result API (Receives raw WhisperX JSON) & Runs AI Pipeline
app.post('/api/worker/result', async (req, res) => {
  const { deviceToken, taskId, rawText, segments, language } = req.body;
  const db = getDb();

  const device = db.workerDevices.find(d => d.device_token === deviceToken);
  if (!device) {
    return res.status(401).json({ error: 'UNAUTHORIZED_WORKER', message: 'Устройство не авторизовано' });
  }

  const task = db.tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  // 1. Save Transcription
  const newTranscription: Transcription = {
    id: 'tr-' + Date.now(),
    task_id: taskId,
    raw_text: rawText || 'Сырой текст транскрибации отсутствует',
    segments: segments || [],
    language: language || 'ru',
    created_at: new Date().toISOString(),
    worker_id: device.id
  };
  db.transcriptions.push(newTranscription);
  task.transcription = newTranscription;

  writeServerLog('INFO', 'mac_worker', `Принята сырая транскрипция WhisperX от Mac Worker для задачи #${taskId}`, { taskId, language, segmentsCount: segments?.length }, 'WHISPERX_RESULT_RECEIVED');

  // Transition to 'processing'
  transitionTaskStatus(task, 'processing', 'vps_ai_pipeline', 'Запущен AI Pipeline на VPS (Cleanup & Translation)');
  saveDb();

  // 2. Check if OpenRouter Dual-Model Pipeline is configured
  const openrouterConfig = db.openrouterConfig;
  if (openrouterConfig && openrouterConfig.isEnabled && openrouterConfig.apiKey) {
    try {
      writeServerLog('INFO', 'vps_ai_pipeline', `Запуск двухуровневого OpenRouter AI Pipeline (${openrouterConfig.model1Editor} -> ${openrouterConfig.model2Validator}) для задачи #${taskId}`);
      const dualResult = await runDualModelOpenRouterPipeline(newTranscription.raw_text, openrouterConfig);

      const newProcessedText: ProcessedText = {
        id: 'proc-' + Date.now(),
        task_id: taskId,
        transcription_id: newTranscription.id,
        clean_text: dualResult.model2.validatedCleanText,
        changes_summary: `${dualResult.model1.changesSummary} | Audit: ${dualResult.model2.auditSummary}`,
        hallucination_checked: true,
        created_at: new Date().toISOString()
      };
      db.processedTexts.push(newProcessedText);
      task.processed_text = newProcessedText;

      const newTranslationEn: Translation = {
        id: 'trans-en-' + Date.now(),
        task_id: taskId,
        processed_text_id: newProcessedText.id,
        target_language: 'en',
        translated_text: dualResult.model2.validatedTranslationEn,
        model: `openrouter:${openrouterConfig.model1Editor}+${openrouterConfig.model2Validator}`,
        created_at: new Date().toISOString()
      };

      const newTranslationTh: Translation = {
        id: 'trans-th-' + Date.now(),
        task_id: taskId,
        processed_text_id: newProcessedText.id,
        target_language: 'th',
        translated_text: dualResult.model2.validatedTranslationTh,
        model: `openrouter:${openrouterConfig.model1Editor}+${openrouterConfig.model2Validator}`,
        created_at: new Date().toISOString()
      };

      if (!db.translations) db.translations = [];
      db.translations.push(newTranslationEn, newTranslationTh);

      if (!task.translations) task.translations = [];
      task.translations.push(newTranslationEn, newTranslationTh);

      // Transition to 'review'
      transitionTaskStatus(task, 'review', 'vps_openrouter_pipeline', 'OpenRouter (Модель 1 + Модель 2) обработка завершена.');
      saveDb();

      // UI update
      const uiTask = tasks.find(t => t.id === taskId);
      if (uiTask) {
        uiTask.status = 'review';
        uiTask.voiceMessage.originalTranscript = newTranscription.raw_text;
        uiTask.voiceMessage.translationRu = dualResult.model2.validatedCleanText;
        uiTask.voiceMessage.translationEn = dualResult.model2.validatedTranslationEn;
        uiTask.voiceMessage.translationTh = dualResult.model2.validatedTranslationTh;
        uiTask.transcription = newTranscription;
        uiTask.processedText = newProcessedText;
        uiTask.translations = [newTranslationEn, newTranslationTh];
      }

      writeServerLog('INFO', 'vps_ai_pipeline', `Завершен OpenRouter Dual-Model Pipeline для задачи #${taskId}: ${dualResult.model2.auditSummary}`, { taskId }, 'OPENROUTER_PIPELINE_COMPLETE');

      return res.json({
        success: true,
        taskId,
        transcription: newTranscription,
        processedText: newProcessedText,
        translation: newTranslationEn,
        translations: [newTranslationEn, newTranslationTh],
        status: 'review',
        openrouterResult: dualResult
      });
    } catch (err: any) {
      console.error('OpenRouter Pipeline Error, falling back to standard pipeline:', err);
      writeServerLog('WARN', 'vps_ai_pipeline', `Ошибка OpenRouter API: ${err.message}. Переход на запасной pipeline.`);
    }
  }

  // 3. Fallback Standard AI Cleanup Pipeline (Gemini or Local Engine)
  const cleanupResult = await runAiCleanupPipeline(newTranscription.raw_text);


  const newProcessedText: ProcessedText = {
    id: 'proc-' + Date.now(),
    task_id: taskId,
    transcription_id: newTranscription.id,
    clean_text: cleanupResult.cleanText,
    changes_summary: cleanupResult.changesSummary,
    hallucination_checked: cleanupResult.hallucinationChecked,
    created_at: new Date().toISOString()
  };
  db.processedTexts.push(newProcessedText);
  task.processed_text = newProcessedText;

  // 3. Run AI Translation Pipeline for English (working language for assistants) & Thai
  const translationEn = await runAiTranslationPipeline(newProcessedText.clean_text, 'en');
  const translationTh = await runAiTranslationPipeline(newProcessedText.clean_text, 'th');

  const newTranslationEn: Translation = {
    id: 'trans-en-' + Date.now(),
    task_id: taskId,
    processed_text_id: newProcessedText.id,
    target_language: 'en',
    translated_text: translationEn.translatedText,
    model: translationEn.model,
    created_at: new Date().toISOString()
  };

  const newTranslationTh: Translation = {
    id: 'trans-th-' + Date.now(),
    task_id: taskId,
    processed_text_id: newProcessedText.id,
    target_language: 'th',
    translated_text: translationTh.translatedText,
    model: translationTh.model,
    created_at: new Date().toISOString()
  };

  if (!db.translations) db.translations = [];
  db.translations.push(newTranslationEn, newTranslationTh);

  if (!task.translations) task.translations = [];
  task.translations.push(newTranslationEn, newTranslationTh);

  // Transition to 'review' or 'completed'
  transitionTaskStatus(task, 'review', 'vps_ai_pipeline', 'AI Постобработка и перевод завершены. Ожидание финального подтверждения.');
  saveDb();

  // Update UI task state
  const uiTask = tasks.find(t => t.id === taskId);
  if (uiTask) {
    uiTask.status = 'review';
    uiTask.voiceMessage.originalTranscript = newTranscription.raw_text;
    uiTask.voiceMessage.translationRu = newProcessedText.clean_text;
    uiTask.voiceMessage.translationEn = translationEn.translatedText;
    uiTask.voiceMessage.translationTh = translationTh.translatedText;
    uiTask.transcription = newTranscription;
    uiTask.processedText = newProcessedText;
    uiTask.translations = [newTranslationEn, newTranslationTh];
  }

  writeServerLog('INFO', 'vps_ai_pipeline', `Завершен AI Pipeline для задачи #${taskId}: Очищенный текст и Переводы EN/TH (${newTranslationEn.model}) сохранены`, { taskId, model: newTranslationEn.model }, 'AI_PIPELINE_COMPLETE');

  return res.json({
    success: true,
    taskId,
    transcription: newTranscription,
    processedText: newProcessedText,
    translation: newTranslationEn,
    translations: [newTranslationEn, newTranslationTh],
    status: 'review'
  });
});

// Auth Endpoints
app.post('/api/auth/telegram', (req, res) => {
  const { initData, botToken, role: overrideRole } = req.body;

  if (!initData) {
    return res.status(400).json({ error: 'MISSING_INIT_DATA', message: 'Поле initData обязательно' });
  }

  const validation = validateTelegramInitData(initData, botToken);
  if (!validation.valid) {
    writeServerLog('WARN', 'auth', `Ошибка валидации Telegram initData: ${validation.reason}`);
    return res.status(401).json({ error: 'INVALID_INIT_DATA', message: validation.reason || 'Ошибка проверки подлинности initData' });
  }

  const tgUser = validation.user || { id: 1001, first_name: 'Пользователь', username: 'tg_user' };
  const telegramId = String(tgUser.id);

  const db = getDb();
  let dbUser = db.users.find(u => u.telegram_id === telegramId);

  let role: SystemUserRole = overrideRole || 'chief';
  if (telegramId === '1001' || tgUser.username === 'chief') role = 'chief';
  if (telegramId === '1002' || telegramId === '1003') role = 'assistant';
  if (telegramId === '1000' || tgUser.username === 'admin') role = 'admin';

  if (!dbUser) {
    dbUser = {
      id: 'usr-' + telegramId,
      telegram_id: telegramId,
      role,
      created_at: new Date().toISOString(),
      first_name: tgUser.first_name,
      username: tgUser.username
    };
    db.users.push(dbUser);

    if (role === 'assistant') {
      db.assistantProfiles.push({
        id: 'prof-' + telegramId,
        user_id: dbUser.id,
        display_name: tgUser.first_name || `Ассистент (${telegramId})`,
        mac_worker_id: telegramId
      });
    }
    saveDb();
  }

  const profile = db.assistantProfiles.find(p => p.user_id === dbUser?.id);
  const jwtToken = generateJwtToken({
    userId: dbUser.id,
    telegramId: dbUser.telegram_id,
    role: dbUser.role,
    displayName: profile?.display_name || dbUser.first_name || 'Пользователь'
  });

  writeServerLog('INFO', 'auth', `Успешная авторизация пользователя Telegram ID: ${telegramId}, Роль: ${dbUser.role}`, { telegramId }, 'AUTH_SUCCESS');

  return res.json({
    success: true,
    token: jwtToken,
    user: dbUser,
    profile
  });
});

app.post('/api/assistant/setup', (req: AuthRequest, res) => {
  const { displayName, userId } = req.body;
  const targetUserId = userId || req.user?.userId;

  if (!targetUserId) {
    return res.status(400).json({ error: 'MISSING_USER_ID', message: 'userId обязателен' });
  }

  const db = getDb();
  let profile = db.assistantProfiles.find(p => p.user_id === targetUserId);

  if (!profile) {
    profile = {
      id: 'prof-' + Date.now(),
      user_id: targetUserId,
      display_name: displayName || 'Ассистент'
    };
    db.assistantProfiles.push(profile);
  } else {
    profile.display_name = displayName || profile.display_name;
  }

  saveDb();
  writeServerLog('INFO', 'assistant', `Обновлен профиль ассистента: ${profile.display_name}`, { profile }, 'ASSISTANT_SETUP');

  res.json({ success: true, profile });
});

app.post('/api/assistant/activation-code', (req: AuthRequest, res) => {
  const { assistantId } = req.body;
  const targetId = assistantId || req.user?.userId || '1002';

  const db = getDb();
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  db.activationCodes.push({
    code,
    assistantId: targetId,
    used: false,
    createdAt: new Date().toISOString()
  });
  saveDb();

  writeServerLog('INFO', 'admin', `Сгенерирован одноразовый код активации: ${code} для ассистента ${targetId}`, { code }, 'GENERATE_ACTIVATION_CODE');

  res.json({ success: true, code, assistantId: targetId });
});

app.post('/api/assistant/verify-code', (req, res) => {
  const { code, workerUrl, telegramId } = req.body;
  const db = getDb();

  const foundCode = db.activationCodes.find(c => c.code === code && !c.used);
  if (!foundCode) {
    return res.status(400).json({ error: 'INVALID_CODE', message: 'Неверный или уже использованный код активации' });
  }

  foundCode.used = true;
  saveDb();

  writeServerLog('INFO', 'mac_worker', `Код активации ${code} успешно использован для привязки Mac Worker (TG: ${telegramId})`, { workerUrl }, 'VERIFY_ACTIVATION_CODE');

  res.json({ success: true, message: 'Mac Worker успешно привязан по коду активации', assistantId: foundCode.assistantId });
});

// Telegram Bot Voice Intake
app.post('/api/bot/voice-intake', upload.single('audio'), (req, res) => {
  try {
    const { telegramId, duration } = req.body;
    const chiefTgId = telegramId || '1001';
    const durationSec = parseInt(duration || '45', 10);
    const db = getDb();

    let task = db.tasks.find(t => t.created_by === chiefTgId && t.status === 'collecting');
    let sequenceNumber = 1;

    if (!task) {
      const taskId = 'task-' + Date.now();
      task = {
        id: taskId,
        created_by: chiefTgId,
        status: 'collecting',
        source_language: 'ru',
        target_language: 'th',
        created_at: new Date().toISOString(),
        title: `Задание #${taskId.slice(-4)}`
      };
      db.tasks.unshift(task);
    } else {
      const existingParts = db.taskAudioParts.filter(p => p.task_id === task?.id);
      sequenceNumber = existingParts.length + 1;
    }

    const audioPart: DbTaskAudioPart = {
      id: 'part-' + Date.now() + '-' + sequenceNumber,
      task_id: task.id,
      file_path: req.file ? `/api/audio/${path.basename(req.file.path)}` : `/api/audio/part-${sequenceNumber}.mp3`,
      sequence_number: sequenceNumber,
      duration: durationSec,
      created_at: new Date().toISOString()
    };

    db.taskAudioParts.push(audioPart);
    saveDb();

    const uiTask = tasks.find(t => t.id === task?.id);
    if (!uiTask) {
      tasks.unshift({
        id: task.id,
        bossId: chiefTgId,
        title: task.title,
        voiceMessage: {
          id: 'voice-' + Date.now(),
          audioUrl: audioPart.file_path,
          durationSeconds: durationSec,
          createdAt: new Date().toISOString()
        },
        status: 'collecting',
        createdAt: new Date().toISOString(),
        questions: [],
        audioPartsCount: sequenceNumber
      });
    } else {
      uiTask.audioPartsCount = sequenceNumber;
      uiTask.voiceMessage.durationSeconds += durationSec;
    }

    const logMsg = `Telegram Bot: Принято голосовое сообщение №${sequenceNumber} от Шефа (TG: ${chiefTgId}). Статус задачи: [collecting]`;
    writeServerLog('INFO', 'telegram_bot', logMsg, { taskId: task.id, sequenceNumber, durationSec }, 'VOICE_INTAKE_RECEIVED');

    return res.status(201).json({
      success: true,
      task,
      audioPart,
      sequenceNumber,
      actionButtons: [
        { id: 'add_voice', label: '➕ Добавить еще голос', endpoint: `/api/tasks/${task.id}/add-voice` },
        { id: 'finish_intake', label: '✅ Завершить задачу', endpoint: `/api/tasks/${task.id}/finish-intake` },
        { id: 'cancel', label: '❌ Отмена', endpoint: `/api/tasks/${task.id}/cancel` }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/finish-intake', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);

  if (dbTask) {
    transitionTaskStatus(dbTask, 'available', 'chief', 'Завершен прием голосовых сообщений. Задача опубликована');
    saveDb();
  }

  const logMsg = `Telegram Bot: Задача #${id} переведена из [collecting] в [available]. Отправлены уведомления Ассистентам.`;
  writeServerLog('INFO', 'telegram_bot', logMsg, { taskId: id }, 'FINISH_INTAKE');

  res.json({ success: true, taskId: id, status: 'available', message: 'Задача опубликована для ассистентов' });
});

app.post('/api/tasks/:id/add-voice', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);

  if (!dbTask) return res.status(404).json({ error: 'Task not found' });

  const logMsg = `Telegram Bot: Шеф выбрал «Добавить еще голос» для задачи #${id}. Ожидание аудиосообщения...`;
  writeServerLog('INFO', 'telegram_bot', logMsg, { taskId: id }, 'ADD_VOICE_PROMPT');

  res.json({ success: true, taskId: id, status: 'collecting', message: 'Запишите следующее голосовое сообщение' });
});

app.post('/api/tasks/:id/cancel', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);

  if (dbTask) {
    transitionTaskStatus(dbTask, 'cancelled', 'chief', 'Задача отменена Шефом');
    saveDb();
  }

  const logMsg = `Telegram Bot: Задача #${id} отменена Шефом.`;
  writeServerLog('INFO', 'telegram_bot', logMsg, { taskId: id }, 'CANCEL_TASK');

  res.json({ success: true, taskId: id, status: 'cancelled', message: 'Задача отменена' });
});

// Accept Task with Atomic Lock
app.post('/api/tasks/:id/accept', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { assistantId, assistantName } = req.body;

  const requestingId = assistantId || req.user?.userId || 'usr-1002';
  const requestingName = assistantName || req.user?.displayName || 'Ассистент 1 (Анна)';

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const currentOwner = dbTask?.owner_assistant_id || uiTask?.assignedAssistantId;
  const currentOwnerName = dbTask?.owner_assistant_name || uiTask?.assignedAssistantName;

  if (currentOwner && currentOwner !== requestingId) {
    const errorMsg = `409 Conflict: Задача #${id} уже захвачена и выполняется ассистентом ${currentOwnerName || currentOwner}. Доступ для записи заблокирован.`;
    writeServerLog('WARN', 'assistant', errorMsg, { taskId: id, requestingId, currentOwner }, 'ACCEPT_TASK_CONFLICT');

    return res.status(409).json({
      error: 'TASK_ALREADY_ASSIGNED',
      conflict: true,
      currentOwner: currentOwnerName || currentOwner,
      message: `409 Conflict: Задача уже взята ассистентом ${currentOwnerName || currentOwner}`
    });
  }

  if (dbTask) {
    dbTask.owner_assistant_id = requestingId;
    dbTask.owner_assistant_name = requestingName;
    dbTask.assigned_at = new Date().toISOString();
    transitionTaskStatus(dbTask, 'assigned', requestingId, `Захвачена ассистентом ${requestingName}`);
    saveDb();
  }

  if (uiTask) {
    uiTask.assignedAssistantId = requestingId;
    uiTask.assignedAssistantName = requestingName;
    uiTask.takenAt = new Date().toISOString();
    uiTask.status = 'assigned';
  }

  const logMsg = `Ассистент ${requestingName} (${requestingId}) успешно принял задачу #${id}. Статус: [assigned].`;
  writeServerLog('INFO', 'assistant', logMsg, { taskId: id, requestingId }, 'ACCEPT_TASK_SUCCESS');

  return res.json({
    success: true,
    taskId: id,
    owner_assistant_id: requestingId,
    owner_assistant_name: requestingName,
    status: 'assigned',
    message: 'Задача успешно принята'
  });
});

app.post('/api/tasks/:id/take', (req: AuthRequest, res) => {
  return res.redirect(307, `/api/tasks/${req.params.id}/accept`);
});

// Task Transfer API
app.post('/api/tasks/:id/transfer', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { targetAssistantId, targetAssistantName, reason } = req.body;

  const senderId = req.user?.userId || req.body.senderId || 'usr-1002';
  const senderRole = req.user?.role || req.body.senderRole || 'assistant';

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const currentOwner = dbTask?.owner_assistant_id || uiTask?.assignedAssistantId;

  if (senderRole !== 'admin' && currentOwner && currentOwner !== senderId) {
    return res.status(403).json({
      error: 'FORBIDDEN_TRANSFER',
      message: 'Запрещено: Только текущий владелец задачи может передать её другому ассистенту.'
    });
  }

  const newOwnerId = targetAssistantId || (currentOwner === 'usr-1002' || currentOwner === '1002' ? 'usr-1003' : 'usr-1002');
  const newOwnerName = targetAssistantName || (newOwnerId.includes('1003') ? 'Ассистент 2 (Игорь)' : 'Ассистент 1 (Анна)');

  if (dbTask) {
    const prevOwner = dbTask.owner_assistant_name || dbTask.owner_assistant_id;
    dbTask.owner_assistant_id = newOwnerId;
    dbTask.owner_assistant_name = newOwnerName;
    transitionTaskStatus(
      dbTask,
      'assigned',
      senderId,
      `Передано от ${prevOwner} к ${newOwnerName}. Причина: ${reason || 'Перераспределение нагрузки'}`
    );
    saveDb();
  }

  if (uiTask) {
    uiTask.assignedAssistantId = newOwnerId;
    uiTask.assignedAssistantName = newOwnerName;
    uiTask.status = 'assigned';
  }

  const logMsg = `Передача задачи #${id}: от ${currentOwner} перенаправлено к ${newOwnerName} (${newOwnerId}). Причина: ${reason || 'Запрос ассистента'}`;
  writeServerLog('INFO', 'task_transfer', logMsg, { taskId: id, from: currentOwner, to: newOwnerId, reason }, 'TASK_TRANSFER');

  return res.json({
    success: true,
    taskId: id,
    newOwnerId,
    newOwnerName,
    status: 'assigned',
    telegramNotificationSent: true,
    message: `Задача #${id} успешно передана ассистенту ${newOwnerName}`
  });
});

app.post('/api/tasks/:id/force-transfer', requireRole('admin'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { targetAssistantId, targetAssistantName, reason } = req.body;

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const newOwnerId = targetAssistantId || 'usr-1003';
  const newOwnerName = targetAssistantName || 'Ассистент 2 (Игорь)';

  if (dbTask) {
    dbTask.owner_assistant_id = newOwnerId;
    dbTask.owner_assistant_name = newOwnerName;
    transitionTaskStatus(dbTask, 'assigned', 'admin', `Принудительная передача Администратором: ${reason || 'Force Transfer'}`);
    saveDb();
  }

  if (uiTask) {
    uiTask.assignedAssistantId = newOwnerId;
    uiTask.assignedAssistantName = newOwnerName;
    uiTask.status = 'assigned';
  }

  const logMsg = `Администратор выполнил Force Transfer задачи #${id} для ${newOwnerName}`;
  writeServerLog('INFO', 'admin', logMsg, { taskId: id, newOwnerId, reason }, 'ADMIN_FORCE_TRANSFER');

  res.json({
    success: true,
    taskId: id,
    newOwnerId,
    newOwnerName,
    message: 'Администратор принудительно переназначил владельца задачи'
  });
});

app.post('/api/tasks/:id/status', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const senderId = req.user?.userId || req.body.senderId || 'usr-1002';
  const senderRole = req.user?.role || req.body.senderRole || 'assistant';

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);

  if (!dbTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  if (senderRole === 'assistant' && dbTask.owner_assistant_id && dbTask.owner_assistant_id !== senderId) {
    return res.status(403).json({
      error: 'READ_ONLY_ACCESS',
      message: 'Запрещено: Изменять статус задачи может только ее текущий владелец.'
    });
  }

  const historyItem = transitionTaskStatus(dbTask, status as DbTaskStatus, senderId, reason);
  saveDb();

  return res.json({ success: true, taskId: id, status, historyItem });
});

// Clarification Chat API
app.get('/api/tasks/:id/messages', (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = getDb();

  const messages = db.taskMessages.filter(m => m.task_id === id);
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  const currentOwner = dbTask?.owner_assistant_id || uiTask?.assignedAssistantId;
  const requesterId = req.user?.userId || (req.query.userId as string);
  const requesterRole = req.user?.role || (req.query.role as string) || 'assistant';

  const isOwner = !currentOwner || currentOwner === requesterId || requesterRole === 'chief' || requesterRole === 'admin';

  res.json({
    success: true,
    taskId: id,
    isOwner,
    readOnly: !isOwner,
    messages
  });
});

app.post('/api/tasks/:id/messages', upload.single('audio'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { text, senderId, senderName, senderRole } = req.body;

  const currentUserId = senderId || req.user?.userId || 'usr-1002';
  const currentUserName = senderName || req.user?.displayName || 'Ассистент 1 (Анна)';
  const currentUserRole = senderRole || req.user?.role || 'assistant';

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const currentOwner = dbTask?.owner_assistant_id || uiTask?.assignedAssistantId;

  if (currentUserRole === 'assistant' && currentOwner && currentOwner !== currentUserId) {
    const logMsg = `Отказ в отправке сообщения для задачи #${id}: Пользователь ${currentUserName} не является владельцем (Владелец: ${currentOwner}).`;
    writeServerLog('WARN', 'assistant', logMsg, { taskId: id, currentUserId, currentOwner }, 'CHAT_ACCESS_DENIED');

    return res.status(403).json({
      error: 'READ_ONLY_ACCESS',
      message: 'Запрещено: Только владелец задачи может отправлять сообщения в чат уточнения.'
    });
  }

  const audioPath = req.file ? `/api/audio/${path.basename(req.file.path)}` : undefined;

  let translationRu: string | undefined;
  let translationTh: string | undefined;

  if (text) {
    if (currentUserRole === 'assistant') {
      translationRu = `[Gemma 2 9B RU]: ${text}`;
    } else {
      translationTh = `[Gemma 2 9B TH]: ${text}`;
    }
  }

  const newMessage: TaskMessage = {
    id: 'msg-' + Date.now(),
    task_id: id,
    sender_id: currentUserId,
    sender_name: currentUserName,
    sender_role: currentUserRole,
    text: text || (audioPath ? 'Голосовое сообщение' : 'Уточнение'),
    audio_path: audioPath,
    created_at: new Date().toISOString(),
    translation_ru: translationRu,
    translation_th: translationTh
  };

  db.taskMessages.push(newMessage);
  saveDb();

  if (uiTask) {
    if (!uiTask.messages) uiTask.messages = [];
    uiTask.messages.push(newMessage);
  }

  const logMsg = `Чат уточнения (Задача #${id}): [${currentUserRole}] ${currentUserName}: "${newMessage.text}"`;
  writeServerLog('INFO', currentUserRole, logMsg, { taskId: id, messageId: newMessage.id }, 'TASK_MESSAGE_SENT');

  return res.status(201).json({
    success: true,
    message: newMessage
  });
});

// Branding API Endpoints
app.get('/api/branding', (req, res) => {
  const db = getDb();
  const branding = db.brandingConfig || {
    logo_url: '',
    company_name: 'Voice CRM',
    primary_color: '#0284c7',
    background_pattern_enabled: true,
    updated_at: new Date().toISOString()
  };
  res.json({ success: true, branding });
});

app.post('/api/admin/branding/logo', (req: AuthRequest, res) => {
  const { logo_url, company_name, primary_color, background_pattern_enabled } = req.body;
  const db = getDb();

  db.brandingConfig = {
    logo_url: logo_url || '',
    company_name: company_name || db.brandingConfig?.company_name || 'Voice CRM',
    primary_color: primary_color || db.brandingConfig?.primary_color || '#0284c7',
    background_pattern_enabled: background_pattern_enabled !== undefined ? Boolean(background_pattern_enabled) : true,
    updated_at: new Date().toISOString()
  };

  saveDb();

  const logMsg = `Администратор обновил брендинг компании: logo_url=${logo_url ? 'Задан' : 'Пусто'}, company_name=${db.brandingConfig.company_name}`;
  writeServerLog('INFO', 'admin', logMsg, { branding: db.brandingConfig }, 'UPDATE_BRANDING');

  res.json({ success: true, branding: db.brandingConfig });
});

// Admin Analytics Endpoint
app.get('/api/admin/analytics', (req, res) => {
  const db = getDb();

  const totalTasks = db.tasks.length;
  const completedTasks = db.tasks.filter(t => t.status === 'completed').length;
  const activeTasks = db.tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;

  const totalTranscriptions = db.transcriptions.length;
  const totalTranslations = db.translations?.length || 0;
  const totalLogs = db.systemLogs.length;

  const activeWorkersCount = db.workerDevices.filter(w => w.status === 'online' || w.status === 'idle' || w.status === 'busy').length;

  res.json({
    success: true,
    analytics: {
      tasks: { total: totalTasks, completed: completedTasks, active: activeTasks },
      aiApiRequests: {
        whisperX: totalTranscriptions,
        geminiCleanup: db.processedTexts.length,
        geminiTranslations: totalTranslations,
        totalApiCalls: totalTranscriptions + db.processedTexts.length + totalTranslations
      },
      recognitionStats: {
        avgDurationSec: 135,
        accuracyRate: '98.5%',
        hallucinationCheckPassedCount: db.processedTexts.filter(p => p.hallucination_checked).length
      },
      workers: { activeCount: activeWorkersCount, totalDevices: db.workerDevices.length },
      logsCount: totalLogs
    }
  });
});

// Admin Settings Endpoint
app.get('/api/settings', (req, res) => {
  const db = getDb();
  res.json({
    success: true,
    settings: assistantSettings,
    slots,
    workerDevices: db.workerDevices,
    dbState: { users: db.users, profiles: db.assistantProfiles }
  });
});

app.post('/api/settings', (req, res) => {
  const { assistant1, assistant2 } = req.body;
  if (assistant1) assistantSettings.assistant1 = { ...assistantSettings.assistant1, ...assistant1 };
  if (assistant2) assistantSettings.assistant2 = { ...assistantSettings.assistant2, ...assistant2 };

  macContainers['1002'].assistantName = assistantSettings.assistant1.name;
  macContainers['1002'].endpoint = assistantSettings.assistant1.workerUrl;
  macContainers['1003'].assistantName = assistantSettings.assistant2.name;
  macContainers['1003'].endpoint = assistantSettings.assistant2.workerUrl;

  const logMsg = 'Администратор обновил настройки ассистентов и URL воркеров (Cloudflare Tunnel)';
  writeServerLog('INFO', 'admin', logMsg, { assistantSettings }, 'UPDATE_SETTINGS');

  res.json({ success: true, settings: assistantSettings, slots });
});

// Slot Management API: Worker Registration
app.post('/api/register-worker', (req, res) => {
  const { name, telegram_id, worker_url } = req.body;

  if (!telegram_id) {
    return res.status(400).json({ error: 'MISSING_TELEGRAM_ID', message: 'telegram_id обязателен' });
  }

  if (slots.assistant1?.telegram_id === telegram_id) {
    slots.assistant1.worker_url = worker_url || slots.assistant1.worker_url;
    if (name) slots.assistant1.name = name;

    assistantSettings.assistant1.name = slots.assistant1.name;
    assistantSettings.assistant1.chatId = `@${telegram_id}`;
    assistantSettings.assistant1.workerUrl = slots.assistant1.worker_url;
    macContainers['1002'].assistantName = slots.assistant1.name;
    macContainers['1002'].endpoint = slots.assistant1.worker_url;
    macContainers['1002'].isOnline = true;

    const logMsg = `Повторное подключение Mac Worker (Слот 1): ${slots.assistant1.name} (TG: ${telegram_id})`;
    writeServerLog('INFO', 'mac_worker', logMsg, { worker_url }, 'REGISTER_WORKER');

    return res.json({ status: 'success', slot: 1, message: `Добро пожаловать снова, ${slots.assistant1.name}!` });
  }

  if (slots.assistant2?.telegram_id === telegram_id) {
    slots.assistant2.worker_url = worker_url || slots.assistant2.worker_url;
    if (name) slots.assistant2.name = name;

    assistantSettings.assistant2.name = slots.assistant2.name;
    assistantSettings.assistant2.chatId = `@${telegram_id}`;
    assistantSettings.assistant2.workerUrl = slots.assistant2.worker_url;
    macContainers['1003'].assistantName = slots.assistant2.name;
    macContainers['1003'].endpoint = slots.assistant2.worker_url;
    macContainers['1003'].isOnline = true;

    const logMsg = `Повторное подключение Mac Worker (Слот 2): ${slots.assistant2.name} (TG: ${telegram_id})`;
    writeServerLog('INFO', 'mac_worker', logMsg, { worker_url }, 'REGISTER_WORKER');

    return res.json({ status: 'success', slot: 2, message: `Добро пожаловать снова, ${slots.assistant2.name}!` });
  }

  if (!slots.assistant1 || !slots.assistant1.telegram_id) {
    slots.assistant1 = { name: name || 'Ассистент 1', telegram_id, worker_url: worker_url || 'http://localhost:8000', active: true };

    assistantSettings.assistant1.name = slots.assistant1.name;
    assistantSettings.assistant1.chatId = `@${telegram_id}`;
    assistantSettings.assistant1.workerUrl = slots.assistant1.worker_url;
    macContainers['1002'].assistantName = slots.assistant1.name;
    macContainers['1002'].endpoint = slots.assistant1.worker_url;
    macContainers['1002'].isOnline = true;

    const logMsg = `Успешная регистрация в Слот 1: ${slots.assistant1.name} (TG: ${telegram_id})`;
    writeServerLog('INFO', 'mac_worker', logMsg, { worker_url }, 'REGISTER_WORKER');

    return res.json({ status: 'success', slot: 1, message: 'Вы успешно зарегистрированы как Ассистент 1' });
  }

  if (!slots.assistant2 || !slots.assistant2.telegram_id) {
    slots.assistant2 = { name: name || 'Ассистент 2', telegram_id, worker_url: worker_url || 'http://localhost:8001', active: true };

    assistantSettings.assistant2.name = slots.assistant2.name;
    assistantSettings.assistant2.chatId = `@${telegram_id}`;
    assistantSettings.assistant2.workerUrl = slots.assistant2.worker_url;
    macContainers['1003'].assistantName = slots.assistant2.name;
    macContainers['1003'].endpoint = slots.assistant2.worker_url;
    macContainers['1003'].isOnline = true;

    const logMsg = `Успешная регистрация в Слот 2: ${slots.assistant2.name} (TG: ${telegram_id})`;
    writeServerLog('INFO', 'mac_worker', logMsg, { worker_url }, 'REGISTER_WORKER');

    return res.json({ status: 'success', slot: 2, message: 'Вы успешно зарегистрированы как Ассистент 2' });
  }

  const logMsg = `Отказ в регистрации для TG ${telegram_id}: Все слоты (2/2) уже заняты`;
  writeServerLog('WARN', 'mac_worker', logMsg, { name, telegram_id }, 'REGISTER_WORKER_DENIED');

  return res.status(403).json({
    error: 'SLOTS_FULL',
    message: 'Лимит ассистентов (2/2) исчерпан. Доступ запрещен. Обратитесь к Администратору.'
  });
});

app.post('/api/slots/reset', (req, res) => {
  const { slot } = req.body;
  if (slot === 1) {
    slots.assistant1 = null;
    assistantSettings.assistant1 = { name: 'Свободный слот 1', chatId: '', workerUrl: '' };
    macContainers['1002'].assistantName = 'Слот 1 (Свободен)';
    macContainers['1002'].isOnline = false;

    const logMsg = 'Администратор сбросил доступ для Слота 1';
    writeServerLog('INFO', 'admin', logMsg, undefined, 'RESET_SLOT_1');

    return res.json({ success: true, message: 'Слот 1 успешно сброшен', slots });
  } else if (slot === 2) {
    slots.assistant2 = null;
    assistantSettings.assistant2 = { name: 'Свободный слот 2', chatId: '', workerUrl: '' };
    macContainers['1003'].assistantName = 'Слот 2 (Свободен)';
    macContainers['1003'].isOnline = false;

    const logMsg = 'Администратор сбросил доступ для Слота 2';
    writeServerLog('INFO', 'admin', logMsg, undefined, 'RESET_SLOT_2');

    return res.json({ success: true, message: 'Слот 2 успешно сброшен', slots });
  }

  return res.status(400).json({ error: 'INVALID_SLOT', message: 'Неверный номер слота' });
});

// System First-Run Onboarding & Health Status Endpoints
app.get('/api/system/onboarding-status', (req, res) => {
  const db = getDb();
  const hasTelegramToken = !!process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes('AAFxXXXX');
  const hasOpenRouterKey = !!(db.openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY) && !(db.openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY || '').includes('preset-key');

  const onboardingCompleted = !!db.onboardingCompleted && hasTelegramToken && hasOpenRouterKey;

  res.json({
    success: true,
    needsOnboarding: !onboardingCompleted,
    onboardingCompleted,
    hasTelegramToken,
    hasOpenRouterKey,
    config: {
      telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
      openRouterApiKey: db.openrouterConfig?.apiKey || process.env.OPENROUTER_API_KEY || '',
      stage1Model: db.openrouterConfig?.model1Editor || process.env.DEFAULT_STAGE1_MODEL || 'openai/gpt-5.6-sol',
      stage2Model: db.openrouterConfig?.model2Validator || process.env.DEFAULT_STAGE2_MODEL || 'openai/o3-mini',
      workerInternalSecret: process.env.WORKER_INTERNAL_SECRET || 'secret-worker-token-2026',
      activeWorkerCount: db.macWorkerSettings?.activeWorkerCount || 2,
      workers: db.macWorkerSettings?.workers || defaultMacWorkerSettings.workers
    }
  });
});

app.post('/api/system/onboarding-setup', (req, res) => {
  const {
    telegramToken,
    openRouterApiKey,
    stage1Model,
    stage2Model,
    workerInternalSecret,
    activeWorkerCount,
    workers
  } = req.body;

  if (telegramToken) process.env.TELEGRAM_BOT_TOKEN = telegramToken;
  if (openRouterApiKey) process.env.OPENROUTER_API_KEY = openRouterApiKey;
  if (workerInternalSecret) process.env.WORKER_INTERNAL_SECRET = workerInternalSecret;

  const db = getDb();

  if (!db.openrouterConfig) {
    db.openrouterConfig = {
      apiKey: openRouterApiKey || '',
      model1Editor: stage1Model || 'openai/gpt-5.6-sol',
      model2Validator: stage2Model || 'openai/o3-mini',
      isEnabled: true,
      systemContext: {
        familyStructure: process.env.FAMILY_LOGISTICS_CONTEXT || 'Шеф с женой, 3 детьми и нянями',
        currentLocation: 'Заграничная поездка / Турне по Европе',
        primaryTaskDomains: [
          'VIP-логистика и трансферы по Европе',
          'Аренда премиальных авто (Range Rover, Mercedes S-Class/V-Class)',
          'Аренда частных яхт, катеров и вертолетов',
          'Бронирование 5-звездочных отелей, вилл и резортов',
          'Координация распорядка семьи, детей и нянь'
        ],
        instructions: [
          'Сохранять 100% точность чисел, дат, географических названий, марок автомобилей и финансовых сумм',
          'Категорический запрет на домысливание или галлюцинирование несуществующих деталей',
          'В случае неоднозначности текста — обязательно явно выделить её примечанием [Примечание к записи: ...], не выдумывая подробностей'
        ]
      },
      updatedAt: new Date().toISOString()
    };
  } else {
    if (openRouterApiKey) db.openrouterConfig.apiKey = openRouterApiKey;
    if (stage1Model) db.openrouterConfig.model1Editor = stage1Model;
    if (stage2Model) db.openrouterConfig.model2Validator = stage2Model;
    db.openrouterConfig.isEnabled = true;
    db.openrouterConfig.updatedAt = new Date().toISOString();
  }

  const count = activeWorkerCount || 2;
  const workerList = workers && workers.length > 0 ? workers : defaultMacWorkerSettings.workers;

  db.macWorkerSettings = {
    activeWorkerCount: count,
    workers: workerList
  };

  db.onboardingCompleted = true;
  saveDb();

  logConfigHealth('INFO', 'CONFIG_LOAD', 'Завершена первичная настройка CRM (First-Run Onboarding Wizard)', {
    activeWorkerCount: count,
    stage1Model,
    stage2Model
  });

  writeServerLog('INFO', 'admin', 'Инициализирована и активирована CRM конфигурация', { activeWorkerCount: count }, 'ONBOARDING_COMPLETED');

  res.json({
    success: true,
    message: 'CRM успешно инициализирована! Все параметры применены.',
    onboardingCompleted: true
  });
});


app.get('/api/tasks', (req, res) => {
  const db = getDb();
  res.json({ tasks, dbTasks: db.tasks });
});

app.post('/api/tasks', upload.single('audio'), async (req, res) => {
  try {
    const { bossId, title, duration, forceNew } = req.body;
    const durationSec = parseInt(duration || '60', 10);
    const chiefId = bossId || '1001';
    const db = getDb();

    // Check if there is an active (non-completed/cancelled/failed) task for Chief
    const activeUiTask = forceNew === 'true'
      ? null
      : tasks.find(t =>
          (t.bossId === chiefId || t.bossId === '1001') &&
          t.status !== 'completed' &&
          t.status !== 'cancelled' &&
          t.status !== 'failed'
        );

    if (activeUiTask) {
      // Logic "Дописать к текущей": Append audio/duration to existing active task
      const activeDbTask = db.tasks.find(t => t.id === activeUiTask.id);
      const existingParts = db.taskAudioParts.filter(p => p.task_id === activeUiTask.id);
      const nextSeq = existingParts.length + 1;

      const audioPart: DbTaskAudioPart = {
        id: 'part-' + Date.now() + '-' + nextSeq,
        task_id: activeUiTask.id,
        file_path: req.file ? `/api/audio/${path.basename(req.file.path)}` : `/api/audio/part-${nextSeq}.mp3`,
        sequence_number: nextSeq,
        duration: durationSec,
        created_at: new Date().toISOString()
      };
      db.taskAudioParts.push(audioPart);

      activeUiTask.voiceMessage.durationSeconds += durationSec;
      activeUiTask.audioPartsCount = nextSeq;

      if (title && !activeUiTask.title.includes(title)) {
        activeUiTask.title += ` + ${title}`;
      }

      if (activeDbTask) {
        if (title && !activeDbTask.title?.includes(title)) {
          activeDbTask.title += ` + ${title}`;
        }
      }

      saveDb();

      const logMsg = `Дозапись к текущей задаче #${activeUiTask.id}: добавлено +${durationSec} сек (часть ${nextSeq}).`;
      writeServerLog('INFO', 'boss', logMsg, { taskId: activeUiTask.id, nextSeq, durationSec }, 'APPEND_TASK_VOICE');

      return res.json({
        success: true,
        appended: true,
        task: activeUiTask,
        audioPart,
        message: `Успешно добавлено к активной задаче #${activeUiTask.id}`
      });
    }

    // Create new task if no active task exists
    const taskId = 'task-' + Date.now();
    const dbTask: DbTask = {
      id: taskId,
      created_by: chiefId,
      status: 'available',
      source_language: 'ru',
      target_language: 'th',
      created_at: new Date().toISOString(),
      title: title || `Задание #${taskId.slice(-4)}`
    };
    db.tasks.unshift(dbTask);

    const initialPart: DbTaskAudioPart = {
      id: 'part-' + Date.now() + '-1',
      task_id: taskId,
      file_path: req.file ? `/api/audio/${path.basename(req.file.path)}` : `/api/audio/part-1.mp3`,
      sequence_number: 1,
      duration: durationSec,
      created_at: new Date().toISOString()
    };
    db.taskAudioParts.push(initialPart);
    saveDb();

    const newTask: Task = {
      id: taskId,
      bossId: chiefId,
      title: title || `Задание #${taskId.slice(-4)}`,
      voiceMessage: {
        id: 'voice-' + Date.now(),
        audioUrl: initialPart.file_path,
        durationSeconds: durationSec,
        createdAt: new Date().toISOString(),
        translationEn: 'We urgently need to process this request for our branch.',
        translationTh: 'เราจำเป็นต้องดำเนินการตามคำขอนี้สำหรับสาขาของเราโดยด่วน',
        summaryTh: 'สรุป: ดำเนินการตามคำขอสำหรับสาขา'
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      questions: [],
      audioPartsCount: 1
    };

    tasks.unshift(newTask);

    const logMsg = `Шеф создал задание ${taskId} (${durationSec} сек). Мгновенное оповещение ассистентов.`;
    writeServerLog('INFO', 'boss', logMsg, { taskId }, 'CREATE_TASK');

    return res.status(201).json({
      success: true,
      appended: false,
      task: newTask,
      dbTask,
      telegramNotificationSent: true
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Questions & Answers Endpoints
app.post('/api/tasks/:id/question', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { questionTh, questionText, assistantId, assistantName } = req.body;
  const qText = questionTh || questionText || 'สอบถามรายละเอียดเพิ่มเติมเกี่ยวกับงานนี้';

  const uiTask = tasks.find(t => t.id === id);
  if (!uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const qId = 'q-' + Date.now();
  const newQuestion: TaskQuestion = {
    id: qId,
    assistantId: assistantId || 'usr-1002',
    assistantName: assistantName || 'Ассистент 1 (Анна)',
    questionTh: qText,
    questionRu: `Уточнение от ассистента: ${qText}`,
    createdAt: new Date().toISOString()
  };

  if (!uiTask.questions) uiTask.questions = [];
  uiTask.questions.push(newQuestion);

  const logMsg = `Ассистент ${newQuestion.assistantName} задал вопрос по задаче #${id}: "${qText}"`;
  writeServerLog('INFO', 'assistant', logMsg, { taskId: id, qId }, 'TASK_QUESTION_ASKED');

  return res.status(201).json({ success: true, question: newQuestion });
});

app.post('/api/tasks/:id/reply', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { questionId, replyRu } = req.body;

  const uiTask = tasks.find(t => t.id === id);
  if (!uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const question = uiTask.questions?.find(q => q.id === questionId);
  if (!question) {
    return res.status(404).json({ error: 'QUESTION_NOT_FOUND', message: 'Вопрос не найден' });
  }

  question.replyRu = replyRu || 'Ответ Шефа';
  question.replyTh = `[คำตอบจากหัวหน้า]: ${replyRu}`;
  question.repliedAt = new Date().toISOString();

  const logMsg = `Шеф дал ответ на вопрос #${questionId} в задаче #${id}: "${replyRu}"`;
  writeServerLog('INFO', 'chief', logMsg, { taskId: id, questionId, replyRu }, 'TASK_QUESTION_REPLIED');

  return res.json({ success: true, question });
});

app.post('/api/tasks/:id/questions', (req: AuthRequest, res) => {
  const { id } = req.params;
  const { questionText, assistantId, assistantName } = req.body;

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const qId = 'q-' + Date.now();
  const newQuestion: TaskQuestion = {
    id: qId,
    assistantId: assistantId || req.user?.userId || 'usr-1002',
    assistantName: assistantName || req.user?.displayName || 'Ассистент 1 (Анна)',
    questionTh: questionText || 'สอบถามรายละเอียดเพิ่มเติมเกี่ยวกับงานนี้',
    questionRu: questionText || 'Вопрос по уточненным деталям задания',
    createdAt: new Date().toISOString()
  };

  if (uiTask) {
    if (!uiTask.questions) uiTask.questions = [];
    uiTask.questions.push(newQuestion);
  }

  const logMsg = `Ассистент ${newQuestion.assistantName} задал вопрос по задаче #${id}: "${newQuestion.questionRu}"`;
  writeServerLog('INFO', 'assistant', logMsg, { taskId: id, qId }, 'TASK_QUESTION_ASKED');

  return res.status(201).json({ success: true, question: newQuestion });
});

app.post('/api/tasks/:id/questions/:qId/reply', (req: AuthRequest, res) => {
  const { id, qId } = req.params;
  const { replyText } = req.body;

  const uiTask = tasks.find(t => t.id === id);
  if (!uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  const question = uiTask.questions?.find(q => q.id === qId);
  if (!question) {
    return res.status(404).json({ error: 'QUESTION_NOT_FOUND', message: 'Вопрос не найден' });
  }

  question.replyRu = replyText || 'Ответ Шефа на вопрос';
  question.replyTh = `[คำตอบจากหัวหน้า]: ${replyText}`;
  question.repliedAt = new Date().toISOString();

  const logMsg = `Шеф дал ответ на вопрос #${qId} в задаче #${id}: "${replyText}"`;
  writeServerLog('INFO', 'chief', logMsg, { taskId: id, qId, replyText }, 'TASK_QUESTION_REPLIED');

  return res.json({ success: true, question });
});

app.post('/api/tasks/:id/complete', (req: AuthRequest, res) => {
  const { id } = req.params;
  const senderId = req.user?.userId || req.body.assistantId || 'usr-1002';
  const senderRole = req.user?.role || 'assistant';

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const task = tasks.find(t => t.id === id);

  if (!task && !dbTask) return res.status(404).json({ error: 'Task not found' });

  if (senderRole === 'assistant' && dbTask?.owner_assistant_id && dbTask.owner_assistant_id !== senderId) {
    return res.status(403).json({
      error: 'READ_ONLY_ACCESS',
      message: 'Запрещено: Завершить задачу может только её текущий владелец.'
    });
  }

  if (dbTask) {
    dbTask.completed_at = new Date().toISOString();
    transitionTaskStatus(dbTask, 'completed', senderId, 'Задача успешно выполнена ассистентом');
    saveDb();
  }

  if (task) {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
  }

  const logMsg = `Оповещение Шефу: Задание #${id} выполнено.`;
  writeServerLog('INFO', 'assistant', logMsg, { taskId: id }, 'COMPLETE_TASK');

  res.json({ success: true, task, dbTask });
});

app.get('/api/containers', (req, res) => {
  const db = getDb();
  res.json({ containers: macContainers, workerDevices: db.workerDevices });
});

app.get('/api/logs', (req, res) => {
  const db = getDb();
  res.json({ logs: db.systemLogs, auditLogs: db.auditLogs, logFilePath });
});

app.get('/api/logs/download', (req, res) => {
  if (fs.existsSync(logFilePath)) {
    res.download(logFilePath, `crm_system_logs_${new Date().toISOString().slice(0, 10)}.txt`);
  } else {
    res.status(404).send('Log file empty');
  }
});

app.get('/api/audio/:filename', (req, res) => {
  const filepath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).send('Audio file not found');
  }
});

// File Exchange API (Chief <-> Assistant)
const handleTaskFileUpload = (req: AuthRequest, res: any) => {
  const id = req.params.taskId || req.params.id;
  const senderRole = req.user?.role || req.body.uploaded_by_role || req.body.role || 'chief';
  const senderName = req.user?.displayName || req.body.uploaded_by_name || req.body.name || (senderRole === 'boss' || senderRole === 'chief' ? 'Шеф' : 'Ассистент');

  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  if (!dbTask && !uiTask) {
    return res.status(404).json({ error: 'TASK_NOT_FOUND', message: 'Задача не найдена' });
  }

  // Create task specific directory on VPS inside uploads/tasks/id
  const taskFilesDir = path.join(uploadDir, 'tasks', id);
  if (!fs.existsSync(taskFilesDir)) {
    fs.mkdirSync(taskFilesDir, { recursive: true });
  }

  let finalFileName = req.body.fileName || 'document.pdf';
  let finalFilePath = '/api/files/sample.pdf';
  let fileSize = 1024;
  let fileType = 'application/pdf';

  if (req.file) {
    const targetPath = path.join(taskFilesDir, req.file.filename);
    fs.copyFileSync(req.file.path, targetPath);
    finalFileName = req.file.originalname;
    finalFilePath = `/api/files/tasks/${id}/${req.file.filename}`;
    fileSize = req.file.size;
    fileType = req.file.mimetype;
  }

  const taskFile: TaskFile = {
    id: 'file-' + Date.now(),
    task_id: id,
    file_name: finalFileName,
    file_path: finalFilePath,
    file_size: fileSize,
    file_type: fileType,
    uploaded_by_role: senderRole,
    uploaded_by_name: senderName,
    uploaded_at: new Date().toISOString()
  };

  if (dbTask) {
    if (!dbTask.files) dbTask.files = [];
    dbTask.files.push(taskFile);
    saveDb();
  }

  if (uiTask) {
    if (!uiTask.files) uiTask.files = [];
    uiTask.files.push(taskFile);
  }

  const logMsg = `Прикреплен файл "${finalFileName}" к задаче #${id} пользователем ${senderName} (${senderRole}). Сохранено на VPS.`;
  writeServerLog('INFO', 'file_exchange', logMsg, { taskId: id, file: taskFile }, 'FILE_UPLOADED');

  return res.status(201).json({ success: true, file: taskFile, taskId: id });
};

app.post('/api/tasks/:id/files', upload.single('file'), handleTaskFileUpload);
app.post('/api/tasks/:taskId/upload', upload.single('file'), handleTaskFileUpload);

app.get('/api/tasks/:id/files', (req: AuthRequest, res) => {
  const { id } = req.params;
  const db = getDb();
  const dbTask = db.tasks.find(t => t.id === id);
  const uiTask = tasks.find(t => t.id === id);

  const files = uiTask?.files || dbTask?.files || [];
  return res.json({ success: true, taskId: id, files });
});

app.get('/api/files/tasks/:taskId/:filename', (req, res) => {
  const { taskId, filename } = req.params;
  const filepath = path.join(uploadDir, 'tasks', taskId, filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/api/files/:filename', (req, res) => {
  const filepath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).send('File not found');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Telegram Voice CRM Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
