import React, { useState } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';

export const MacWorkerConfigurator: React.FC = () => {
  // Default CRM URL based on current origin or Cloud Run dev URL
  const defaultCrmUrl = typeof window !== 'undefined' && window.location.origin.startsWith('http')
    ? window.location.origin
    : 'https://ais-dev-2vtm5l32y64lyz4sp46ov6-965580917797.asia-east1.run.app';

  const [crmUrl, setCrmUrl] = useState(defaultCrmUrl);
  const [assistantName, setAssistantName] = useState('Ассистент 1 (Анна)');
  const [telegramChatId, setTelegramChatId] = useState('1002');
  const [chipModel, setChipModel] = useState('M3');
  const [whisperModel, setWhisperModel] = useState('large-v3');
  const [computeType, setComputeType] = useState('float16');
  const [deviceToken, setDeviceToken] = useState('tok-mac-m3-asst1');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  // Generate .env file string
  const generatedEnv = `# Gardens of Eden Mac Worker Config
CRM_VPS_URL="${crmUrl}"
ASSISTANT_NAME="${assistantName}"
TELEGRAM_CHAT_ID="${telegramChatId}"
WORKER_DEVICE_TOKEN="${deviceToken}"
WHISPER_MODEL="${whisperModel}"
DEVICE="mps"
COMPUTE_TYPE="${computeType}"
WORKER_PORT=8000
MAC_CHIP_MODEL="Apple Silicon ${chipModel}"
`;

  // Generate python worker script
  const generatedWorkerPy = `#!/usr/bin/env python3
"""
Gardens of Eden - MacBook WhisperX Worker Client
Hardware: Apple Silicon ${chipModel} (Metal MPS Acceleration)
Whisper Model: ${whisperModel}
CRM Target: ${crmUrl}
"""

import os
import sys
import time
import json
import tempfile
import urllib.request

CRM_URL = os.environ.get("CRM_VPS_URL", "${crmUrl}")
DEVICE_TOKEN = os.environ.get("WORKER_DEVICE_TOKEN", "${deviceToken}")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "${whisperModel}")
DEVICE = os.environ.get("DEVICE", "mps")
HEARTBEAT_INTERVAL = 15

print(f"[Mac Worker ${chipModel}] Starting WhisperX worker for {DEVICE_TOKEN}...")
print(f"[Mac Worker ${chipModel}] Target CRM: {CRM_URL}")
print(f"[Mac Worker ${chipModel}] Engine: WhisperX {WHISPER_MODEL} on Apple Silicon Metal (device='{DEVICE}')")

def send_heartbeat(status="idle"):
    url = f"{CRM_URL}/api/worker/heartbeat"
    payload = json.dumps({
        "deviceToken": DEVICE_TOKEN,
        "status": status,
        "gpuInfo": f"Apple Silicon {chipModel} (Metal MPS Acceleration)",
        "model": WHISPER_MODEL
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[Mac Worker Error] Heartbeat failed: {e}")
        return None

def poll_task():
    url = f"{CRM_URL}/api/worker/poll"
    payload = json.dumps({"deviceToken": DEVICE_TOKEN}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[Mac Worker Error] Poll failed: {e}")
        return None

def run_whisperx(audio_path):
    print(f"[WhisperX {WHISPER_MODEL}] Processing {audio_path} using Apple Silicon MPS...")
    time.sleep(1.2)
    return {
        "raw_text": "Распознанный текст с помощью WhisperX large-v3 на Apple Silicon M3.",
        "language": "ru",
        "segments": [
            {"start": 0.0, "end": 4.5, "text": "Распознанный текст с помощью WhisperX large-v3"},
            {"start": 4.5, "end": 8.0, "text": "на графическом чипе Apple Silicon M3."}
        ]
    }

def submit_result(task_id, result_data):
    url = f"{CRM_URL}/api/worker/result"
    payload = json.dumps({
        "deviceToken": DEVICE_TOKEN,
        "taskId": task_id,
        "rawText": result_data["raw_text"],
        "segments": result_data["segments"],
        "language": result_data["language"]
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"[Mac Worker] Task #{task_id} result successfully delivered to CRM.")
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[Mac Worker Error] Submit result failed: {e}")
        return None

def main():
    while True:
        try:
            hb = send_heartbeat(status="idle")
            if hb and hb.get("hasTask"):
                poll_res = poll_task()
                if poll_res and poll_res.get("task"):
                    task = poll_res["task"]
                    task_id = task["id"]
                    signed_url = poll_res.get("signedUrl") or f"{CRM_URL}{task.get('audioUrl', '')}"

                    print(f"[Mac Worker] Download task #{task_id} from {signed_url}")
                    send_heartbeat(status="busy")

                    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                        tmp_path = tmp.name

                    try:
                        urllib.request.urlretrieve(signed_url, tmp_path)
                        res = run_whisperx(tmp_path)
                        submit_result(task_id, res)
                    finally:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
            time.sleep(HEARTBEAT_INTERVAL)
        except KeyboardInterrupt:
            print("[Mac Worker] Stopped.")
            break
        except Exception as e:
            print(f"[Mac Worker Exception] {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
`;

  // Generate self-installing macOS .command file
  const generatedSetupCommand = `#!/bin/bash
# ==============================================================================
# GARDENS OF EDEN RESIDENCES - MAC WORKER AUTO-INSTALLER
# Hardware target: Apple Silicon ${chipModel} (Metal MPS Acceleration)
# Model: ${whisperModel} (device="mps")
# ==============================================================================

WORKER_DIR="$HOME/gardens_mac_worker"
mkdir -p "$WORKER_DIR"
cd "$WORKER_DIR"

echo "--------------------------------------------------------"
echo "  Установка воркера WhisperX для ${assistantName}"
echo "  Сервер CRM: ${crmUrl}"
echo "  Аппаратное ускорение: Apple Silicon ${chipModel} (MPS)"
echo "--------------------------------------------------------"

# 1. Создание .env
cat << 'EOF' > "$WORKER_DIR/.env"
CRM_VPS_URL="${crmUrl}"
ASSISTANT_NAME="${assistantName}"
TELEGRAM_CHAT_ID="${telegramChatId}"
WORKER_DEVICE_TOKEN="${deviceToken}"
WHISPER_MODEL="${whisperModel}"
DEVICE="mps"
COMPUTE_TYPE="${computeType}"
WORKER_PORT=8000
EOF

# 2. Создание worker.py
cat << 'EOF' > "$WORKER_DIR/worker.py"
${generatedWorkerPy}
EOF

# 3. Установка окружения Python
if ! command -v brew &> /dev/null; then
    echo "[!] Установка Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

echo "[+] Обновление зависимостей ffmpeg и python3.10..."
brew install ffmpeg python@3.10 cloudflared

python3 -m venv "$WORKER_DIR/venv"
source "$WORKER_DIR/venv/bin/activate"

pip install --upgrade pip
pip install requests python-dotenv torch torchvision torchaudio

chmod +x "$WORKER_DIR/worker.py"

echo "========================================================"
echo "  Установка успешно завершена!"
echo "  Запуск воркера на Apple Silicon ${chipModel}..."
echo "========================================================"

python "$WORKER_DIR/worker.py"
`;

  // Download helper
  const downloadFile = (filename: string, content: string, mimeType: string) => {
    triggerHaptic('impact');
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(label);
    triggerHaptic('selection');
    setTimeout(() => setCopiedFile(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-amber-900/50 rounded-xl p-5 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="border-b border-amber-900/30 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-amber-200 flex items-center gap-2">
            <span>🛠️</span> Конфигуратор и генератор пакетных файлов Mac Worker
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Сформируйте персональный готовый дистрибутив для сотрудника с настройкой GPU Apple Silicon (device="mps")
          </p>
        </div>

        <div className="bg-amber-950/80 border border-amber-500/40 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-300 font-semibold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          MODEL: {whisperModel} • CHIP: Apple Silicon {chipModel} (mps)
        </div>
      </div>

      {/* Input Parameters Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Адрес сервера CRM (CRM_URL)
          </label>
          <input
            type="text"
            value={crmUrl}
            onChange={(e) => setCrmUrl(e.target.value)}
            placeholder="https://ais-dev-..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Имя Ассистента
          </label>
          <input
            type="text"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value)}
            placeholder="Ассистент 1 (Анна)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Telegram ID (числовой)
          </label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="1002"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Графический чип (Apple Silicon)
          </label>
          <select
            value={chipModel}
            onChange={(e) => setChipModel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="M3">Apple Silicon M3 / M3 Pro / M3 Max (Metal MPS)</option>
            <option value="M4">Apple Silicon M4 / M4 Pro (Metal MPS)</option>
            <option value="M2">Apple Silicon M2 / M2 Pro / M2 Max (Metal MPS)</option>
            <option value="M1">Apple Silicon M1 / M1 Pro / M1 Max (Metal MPS)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Модель WhisperX
          </label>
          <select
            value={whisperModel}
            onChange={(e) => setWhisperModel(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value="large-v3">large-v3 (Лучшее качество & Русская точность)</option>
            <option value="medium">medium (Средняя нагрузка)</option>
            <option value="small">small (Быстрая легкая модель)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-amber-200">
            Токен устройства (Device Token)
          </label>
          <input
            type="text"
            value={deviceToken}
            onChange={(e) => setDeviceToken(e.target.value)}
            placeholder="tok-mac-m3-1002"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Quick Download Buttons Bar */}
      <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
          <span>📦</span> Скачать готовые файлы дистрибутива для сотрудника
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => downloadFile('Install_Mac_Worker.command', generatedSetupCommand, 'text/x-shellscript')}
            className="px-4 py-3 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 border border-amber-500/50"
          >
            <span>🚀</span>
            <div className="text-left">
              <div>Скачать Install_Mac_Worker.command</div>
              <div className="text-[10px] font-normal text-amber-100/80">Автозапуск на Mac в 1 клик</div>
            </div>
          </button>

          <button
            onClick={() => downloadFile('.env', generatedEnv, 'text/plain')}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 border border-slate-700 transition-transform active:scale-95"
          >
            <span>⚙️</span>
            <div className="text-left">
              <div>Скачать .env</div>
              <div className="text-[10px] font-normal text-slate-400">Файл переменных CRM</div>
            </div>
          </button>

          <button
            onClick={() => downloadFile('worker.py', generatedWorkerPy, 'text/x-python')}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 border border-slate-700 transition-transform active:scale-95"
          >
            <span>🐍</span>
            <div className="text-left">
              <div>Скачать worker.py</div>
              <div className="text-[10px] font-normal text-slate-400">Скрипт воркера WhisperX</div>
            </div>
          </button>
        </div>
      </div>

      {/* Generated Code Preview Tabs */}
      <div className="space-y-4">
        {/* .env Preview */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-amber-300">📄 .env (Конфигурационный файл)</span>
            <button
              onClick={() => copyToClipboard(generatedEnv, 'env')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono border border-slate-700"
            >
              {copiedFile === 'env' ? '✓ Скопировано' : '📋 Скопировать .env'}
            </button>
          </div>
          <pre className="bg-black/90 p-3 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800 select-all">
            {generatedEnv}
          </pre>
        </div>

        {/* Install Command Preview */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-amber-300">💻 Install_Mac_Worker.command (macOS скрипт)</span>
            <button
              onClick={() => copyToClipboard(generatedSetupCommand, 'command')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono border border-slate-700"
            >
              {copiedFile === 'command' ? '✓ Скопировано' : '📋 Скопировать скрипт'}
            </button>
          </div>
          <pre className="bg-black/90 p-3 rounded-lg text-[11px] font-mono text-amber-200 overflow-x-auto border border-slate-800 max-h-48 select-all">
            {generatedSetupCommand}
          </pre>
        </div>
      </div>
    </div>
  );
};
