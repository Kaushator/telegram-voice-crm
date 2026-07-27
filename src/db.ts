import fs from 'fs';
import path from 'path';
import {
  DbUser,
  DbAssistantProfile,
  DbTask,
  DbTaskAudioPart,
  DbAuditLog,
  LogEntry,
  TaskMessage,
  WorkerDevice,
  Transcription,
  ProcessedText,
  Translation,
  BrandingConfig,
  OpenRouterConfig
} from './types.js';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'db.json');

export interface DatabaseState {
  users: DbUser[];
  assistantProfiles: DbAssistantProfile[];
  tasks: DbTask[];
  taskAudioParts: DbTaskAudioPart[];
  taskMessages: TaskMessage[];
  workerDevices: WorkerDevice[];
  transcriptions: Transcription[];
  processedTexts: ProcessedText[];
  translations: Translation[];
  systemLogs: LogEntry[];
  auditLogs: DbAuditLog[];
  activationCodes: { code: string; assistantId: string; used: boolean; createdAt: string }[];
  brandingConfig?: BrandingConfig;
  openrouterConfig?: OpenRouterConfig;
}

const defaultOpenRouterConfig: OpenRouterConfig = {
  apiKey: '',
  model1Editor: 'openai/gpt-5.6-sol',
  model2Validator: 'openai/o3-mini',
  isEnabled: true,
  systemContext: {
    familyStructure: 'Шеф с женой, 3 детьми и нянями',
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

const defaultDbState: DatabaseState = {

  users: [
    { id: 'usr-1001', telegram_id: '1001', role: 'chief', created_at: new Date(Date.now() - 86400000).toISOString(), first_name: 'Шеф' },
    { id: 'usr-1002', telegram_id: '1002', role: 'assistant', created_at: new Date(Date.now() - 86400000).toISOString(), first_name: 'Анна' },
    { id: 'usr-1003', telegram_id: '1003', role: 'assistant', created_at: new Date(Date.now() - 86400000).toISOString(), first_name: 'Игорь' },
    { id: 'usr-admin', telegram_id: '1000', role: 'admin', created_at: new Date(Date.now() - 86400000).toISOString(), first_name: 'Администратор' }
  ],
  assistantProfiles: [
    { id: 'prof-1002', user_id: 'usr-1002', display_name: 'Ассистент 1 (Анна)', mac_worker_id: '1002' },
    { id: 'prof-1003', user_id: 'usr-1003', display_name: 'Ассистент 2 (Игорь)', mac_worker_id: '1003' }
  ],
  workerDevices: [
    {
      id: 'dev-1002',
      assistant_id: 'usr-1002',
      device_token: 'tok-mac-m3-pro-1002',
      status: 'online',
      last_heartbeat: new Date().toISOString(),
      mac_address: 'A0:36:BC:88:12:01',
      hostname: 'Annas-MacBook-Pro-M3.local',
      gpu_info: 'Apple M3 Pro (Metal 3, 18-core GPU)'
    },
    {
      id: 'dev-1003',
      assistant_id: 'usr-1003',
      device_token: 'tok-mac-m2-1003',
      status: 'idle',
      last_heartbeat: new Date(Date.now() - 300000).toISOString(),
      mac_address: 'A0:36:BC:88:99:02',
      hostname: 'Igors-MacBook-Air.local',
      gpu_info: 'Apple M2 (Metal 3, 10-core GPU)'
    }
  ],
  tasks: [
    {
      id: 'task-101',
      created_by: '1001',
      owner_assistant_id: 'usr-1002',
      owner_assistant_name: 'Ассистент 1 (Анна)',
      status: 'assigned',
      source_language: 'ru',
      target_language: 'th',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      assigned_at: new Date(Date.now() - 1800000).toISOString(),
      title: 'Закупка оборудования для офиса в Бангкоке',
      history: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          from_status: 'collecting',
          to_status: 'available',
          changed_by: '1001',
          reason: 'Голос записан и опубликован'
        },
        {
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          from_status: 'available',
          to_status: 'assigned',
          changed_by: 'usr-1002',
          reason: 'Принято ассистентом Анна'
        }
      ]
    }
  ],
  taskAudioParts: [
    {
      id: 'part-101-1',
      task_id: 'task-101',
      file_path: '/api/audio/sample-101.mp3',
      sequence_number: 1,
      duration: 145,
      created_at: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  transcriptions: [],
  processedTexts: [],
  translations: [],
  taskMessages: [
    {
      id: 'msg-1',
      task_id: 'task-101',
      sender_id: 'usr-1002',
      sender_name: 'Ассистент 1 (Анна)',
      sender_role: 'assistant',
      text: 'ต้องการข้อมูลเพิ่มเติมเกี่ยวกับกำหนดเวลาชำระเงิน',
      translation_ru: 'Каковы приоритеты по срокам оплаты?',
      created_at: new Date(Date.now() - 900000).toISOString()
    },
    {
      id: 'msg-2',
      task_id: 'task-101',
      sender_id: 'usr-1001',
      sender_name: 'Шеф',
      sender_role: 'chief',
      text: 'Оплата после согласования счета до конца дня',
      translation_th: 'ชำระเงินหลังจากอนุมัติใบแจ้งหนี้ภายในสิ้นวัน',
      created_at: new Date(Date.now() - 300000).toISOString()
    }
  ],
  systemLogs: [],
  auditLogs: [],
  activationCodes: []
};

let memoryDb: DatabaseState = { ...defaultDbState };

export function loadDb(): DatabaseState {
  try {
    if (fs.existsSync(dbFilePath)) {
      const fileContent = fs.readFileSync(dbFilePath, 'utf-8');
      memoryDb = JSON.parse(fileContent);
      if (!memoryDb.taskMessages) memoryDb.taskMessages = [];
      if (!memoryDb.workerDevices) memoryDb.workerDevices = defaultDbState.workerDevices;
      if (!memoryDb.transcriptions) memoryDb.transcriptions = [];
      if (!memoryDb.processedTexts) memoryDb.processedTexts = [];
      if (!memoryDb.translations) memoryDb.translations = [];
      if (!memoryDb.openrouterConfig) {
        memoryDb.openrouterConfig = defaultOpenRouterConfig;
      }
      if (!memoryDb.brandingConfig) {

        memoryDb.brandingConfig = {
          logo_url: '',
          company_name: 'Voice CRM',
          primary_color: '#0284c7',
          background_pattern_enabled: true,
          updated_at: new Date().toISOString()
        };
      }
    } else {
      saveDb(defaultDbState);
    }
  } catch (err) {
    console.error('Failed to load DB file, using memory DB', err);
  }
  return memoryDb;
}

export function saveDb(state?: DatabaseState): void {
  try {
    if (state) memoryDb = state;
    fs.writeFileSync(dbFilePath, JSON.stringify(memoryDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save DB file', err);
  }
}

export function getDb(): DatabaseState {
  return memoryDb;
}

loadDb();
