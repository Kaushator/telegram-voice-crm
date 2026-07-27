export interface BrandingConfig {
  logo_url: string;
  company_name: string;
  primary_color: string;
  background_pattern_enabled: boolean;
  updated_at: string;
}

export type UserRole = 'boss' | 'assistant_1' | 'assistant_2' | 'admin' | 'chief' | 'assistant';

export type SystemUserRole = 'chief' | 'assistant' | 'admin';

export interface DbUser {
  id: string;
  telegram_id: string;
  role: SystemUserRole;
  created_at: string;
  first_name?: string;
  username?: string;
}

export interface DbAssistantProfile {
  id: string;
  user_id: string;
  display_name: string;
  mac_worker_id?: string;
  activation_code?: string;
  activation_code_used?: boolean;
}

export type WorkerStatus = 'online' | 'idle' | 'busy' | 'offline' | 'error';

export interface WorkerDevice {
  id: string;
  assistant_id: string;
  device_token: string;
  status: WorkerStatus;
  last_heartbeat: string;
  mac_address?: string;
  hostname?: string;
  gpu_info?: string;
}

export type DbTaskStatus =
  | 'collecting'
  | 'available'
  | 'assigned'
  | 'transcribing'
  | 'processing'
  | 'review'
  | 'macbook_pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface DbTaskAudioPart {
  id: string;
  task_id: string;
  file_path: string;
  sequence_number: number;
  duration: number;
  created_at: string;
  signed_url?: string;
  signed_url_expires?: string;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface Transcription {
  id: string;
  task_id: string;
  raw_text: string;
  segments: TranscriptionSegment[];
  language: string;
  created_at: string;
  worker_id?: string;
}

export interface ProcessedText {
  id: string;
  task_id: string;
  transcription_id: string;
  clean_text: string;
  changes_summary?: string;
  hallucination_checked: boolean;
  created_at: string;
}

export interface Translation {
  id: string;
  task_id: string;
  processed_text_id: string;
  target_language: string;
  translated_text: string;
  model: string;
  created_at: string;
}

export interface TaskStateHistory {
  timestamp: string;
  from_status: DbTaskStatus;
  to_status: DbTaskStatus;
  changed_by: string;
  reason?: string;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: 'chief' | 'assistant' | 'admin';
  text?: string;
  audio_path?: string;
  created_at: string;
  translation_ru?: string;
  translation_th?: string;
}

export interface DbTask {
  id: string;
  created_by: string;
  owner_assistant_id?: string;
  owner_assistant_name?: string;
  status: DbTaskStatus;
  source_language: string;
  target_language: string;
  created_at: string;
  assigned_at?: string;
  completed_at?: string;
  title?: string;
  audio_parts?: DbTaskAudioPart[];
  history?: TaskStateHistory[];
  transcription?: Transcription;
  processed_text?: ProcessedText;
  translations?: Translation[];
}

export interface DbAuditLog {
  id: string;
  timestamp: string;
  user_id?: string;
  role: string;
  action: string;
  message: string;
  details?: Record<string, any>;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  language: 'ru' | 'en' | 'th';
  telegramId: string;
}

export type TaskStatus =
  | 'pending'
  | 'collecting'
  | 'available'
  | 'assigned'
  | 'transcribing'
  | 'processing'
  | 'review'
  | 'macbook_pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface VoiceMessage {
  id: string;
  audioUrl?: string;
  durationSeconds: number;
  originalTranscript?: string;
  translationRu?: string;
  translationEn?: string;
  translationTh?: string;
  summaryTh?: string;
  createdAt: string;
  parts?: DbTaskAudioPart[];
}

export interface TaskQuestion {
  id: string;
  assistantId: string;
  assistantName: string;
  questionTh: string;
  questionRu: string;
  replyRu?: string;
  replyTh?: string;
  createdAt: string;
  repliedAt?: string;
}

export interface Task {
  id: string;
  bossId: string;
  title: string;
  voiceMessage: VoiceMessage;
  status: TaskStatus;
  assignedAssistantId?: string;
  assignedAssistantName?: string;
  takenAt?: string;
  completedAt?: string;
  createdAt: string;
  questions?: TaskQuestion[];
  audioPartsCount?: number;
  history?: TaskStateHistory[];
  messages?: TaskMessage[];
  transcription?: Transcription;
  processedText?: ProcessedText;
  translations?: Translation[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'TASK' | 'AUDIO' | 'AUDIT';
  role: string;
  message: string;
  details?: Record<string, unknown>;
  originalTranscript?: string;
  action?: string;
}

export interface MacContainerState {
  assistantId: string;
  assistantName: string;
  isOnline: boolean;
  whisperxReady: boolean;
  lastHeartbeat: string;
  gpuAccelerated: boolean;
}
