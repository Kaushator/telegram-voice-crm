import React, { useState } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';

export const MacDeploymentGuide: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    triggerHaptic('impact');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: 'Шаг 1: Проверка системных требований MacBook',
      description: 'Убедитесь, что на MacBook сотрудника установлена macOS Monterey (12.0+) или новее. Для максимальной скорости транскрибации рекомендуется Apple Silicon (чипы M1 / M2 / M3 / M4) с ускорением Metal MPS GPU.',
      code: `sw_vers
sysctl -n machdep.cpu.brand_string`
    },
    {
      title: 'Шаг 2: Установка системных зависимостей (Homebrew, FFmpeg, Python 3.10)',
      description: 'WhisperX требует наличие утилиты обработчика аудио FFmpeg и версии Python 3.10 / 3.11.',
      code: `# 1. Установка Homebrew (если еще не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Установка FFmpeg и Python 3.10
brew update
brew install ffmpeg git python@3.10 cloudflared`
    },
    {
      title: 'Шаг 3: Клонирование скрипта воркера и виртуальное окружение',
      description: 'Создаем изолированное окружение Python на MacBook сотрудника и активируем его.',
      code: `mkdir -p ~/gardens_crm_worker && cd ~/gardens_crm_worker

# Создание виртуального окружения Python 3.10
python3.10 -m venv venv
source venv/bin/activate

# Обновление pip
pip install --upgrade pip setuptools wheel`
    },
    {
      title: 'Шаг 4: Установка PyTorch с поддержкой Apple Silicon (Metal MPS) & WhisperX',
      description: 'Устанавливаем библиотеку WhisperX и движок Torch с аппаратным ускорением GPU Apple Silicon.',
      code: `# Установка PyTorch с Metal MPS
pip install torch torchvision torchaudio

# Установка WhisperX и FastAPI
pip install git+https.github.com/m-bain/whisperX.git
pip install fastapi uvicorn requests python-dotenv`
    },
    {
      title: 'Шаг 5: Конфигурация параметров связи (.env)',
      description: 'Создаем файл настройки связи с центральным CRM сервером Cloud Run и Telegram ботом.',
      code: `cat << 'EOF' > ~/.gardens_crm_worker.env
CRM_SERVER_URL="https://ais-dev-2vtm5l32y64lyz4sp46ov6-965580917797.asia-east1.run.app"
WORKER_NAME="MacBook_Employee_1"
TELEGRAM_BOT_TOKEN="7890123456:AAFx_YourTelegramBotTokenHere"
TELEGRAM_CHAT_ID="@employee_chat_id"
WORKER_PORT=8000
WHISPER_MODEL="small"
WHISPER_LANGUAGE="ru"
COMPUTE_TYPE="float16"
DEVICE="mps"
EOF`
    },
    {
      title: 'Шаг 6: Тестовый запуск и автоматическая регистрация слота в CRM',
      description: 'Запустите скрипт регистратора воркера. Он автоматически свяжется с сервером и забронирует рабочий слот.',
      code: `# Проверка доступности GPU MPS в Python
python -c "import torch; print('Metal MPS GPU Available:', torch.backends.mps.is_available())"

# Регистрация воркера на сервере CRM
curl -X POST "$CRM_SERVER_URL/api/register-worker" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "MacBook_Employee_1", "telegram_id": "employee_chat_id", "worker_url": "http://localhost:8000"}'`
    },
    {
      title: 'Шаг 7: Автозапуск службы воркера через launchd (Фоновый режим)',
      description: 'Чтобы воркер запускался автоматически при включении MacBook без открытия терминала.',
      code: `cat << 'EOF' > ~/Library/LaunchAgents/com.gardens.crm.worker.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gardens.crm.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/USER_NAME/gardens_crm_worker/venv/bin/uvicorn</string>
        <string>main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8000</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Запуск службы в macOS
launchctl load ~/Library/LaunchAgents/com.gardens.crm.worker.plist`
    }
  ];

  return (
    <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-5 text-slate-100 shadow-2xl space-y-6">
      <div className="border-b border-amber-900/30 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-amber-200 flex items-center gap-2">
            <span>💻</span> Текстовая инструкция: Деплой WhisperX на MacBook сотрудников
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Пошаговое руководство по развертыванию локального распознавания с ускорением Apple Silicon (Metal MPS)
          </p>
        </div>
        <div className="bg-amber-950/60 border border-amber-500/30 px-3 py-1.5 rounded-lg text-[11px] font-mono text-amber-300">
          Архитектура: Client-Side Mac Worker ➔ Cloud Run CRM
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((s, idx) => (
          <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-amber-300 tracking-wide">{s.title}</h3>
              <button
                onClick={() => copyToClipboard(s.code, idx)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono transition-colors border border-slate-700 flex items-center gap-1"
              >
                {copiedIndex === idx ? '✓ Скопировано' : '📋 Скопировать код'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{s.description}</p>
            <pre className="bg-black/80 p-3 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800 leading-normal select-all">
              {s.code}
            </pre>
          </div>
        ))}
      </div>

      <div className="bg-amber-950/40 border border-amber-800/50 p-4 rounded-xl text-xs text-amber-200 space-y-2">
        <div className="font-bold text-amber-300 flex items-center gap-2">
          <span>⚡</span> Результат развертывания
        </div>
        <p className="text-[11px] text-amber-100/80 leading-relaxed">
          После прохождения шагов MacBook сотрудника автоматически отправляет heartbeat на центральный сервер CRM каждые 15 секунд. При поступлении нового голосового задания от Шефа, сервер передает аудио напрямую на локальный порт 8000 MacBook сотрудника, где WhisperX осуществляет мгновенную транскрибацию за ~1.5 секунды.
        </p>
      </div>
    </div>
  );
};
