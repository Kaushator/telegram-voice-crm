import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';
import { OnboardingConfig, WorkerNodeConfig } from '../types';

interface FirstRunOnboardingWizardProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  isInitialBlocker?: boolean;
}

export const FirstRunOnboardingWizard: React.FC<FirstRunOnboardingWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isInitialBlocker = false
}) => {
  const [telegramToken, setTelegramToken] = useState('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState('');
  const [stage1Model, setStage1Model] = useState('openai/gpt-5.6-sol');
  const [stage2Model, setStage2Model] = useState('openai/o3-mini');
  const [workerSecret, setWorkerSecret] = useState('secret-worker-token-2026');
  const [activeWorkerCount, setActiveWorkerCount] = useState<number>(2);

  const [worker1Name, setWorker1Name] = useState('Ассистент 1 (Анна)');
  const [worker1Telegram, setWorker1Telegram] = useState('1002');
  const [worker1Url, setWorker1Url] = useState('http://localhost:8000');

  const [worker2Name, setWorker2Name] = useState('Ассистент 2 (Игорь)');
  const [worker2Telegram, setWorker2Telegram] = useState('1003');
  const [worker2Url, setWorker2Url] = useState('http://localhost:8001');

  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load existing status from server on mount
  useEffect(() => {
    if (isOpen) {
      fetch('/api/system/onboarding-status')
        .then((res) => res.json())
        .then((data) => {
          if (data.config) {
            const cfg = data.config;
            if (cfg.telegramToken && !cfg.telegramToken.includes('AAFxXXXX')) {
              setTelegramToken(cfg.telegramToken);
            }
            if (cfg.openRouterApiKey && !cfg.openRouterApiKey.includes('preset-key')) {
              setOpenRouterApiKey(cfg.openRouterApiKey);
            }
            if (cfg.stage1Model) setStage1Model(cfg.stage1Model);
            if (cfg.stage2Model) setStage2Model(cfg.stage2Model);
            if (cfg.workerInternalSecret) setWorkerSecret(cfg.workerInternalSecret);
            if (cfg.activeWorkerCount) setActiveWorkerCount(cfg.activeWorkerCount);

            if (cfg.workers && cfg.workers.length > 0) {
              const w1 = cfg.workers[0];
              if (w1) {
                setWorker1Name(w1.assignedAssistantName || w1.name);
                setWorker1Telegram(w1.telegramId ? `@${w1.telegramId.replace('@', '')}` : '@anna_asst_1002');
                setWorker1Url(w1.workerUrl || 'http://localhost:8000');
              }
              const w2 = cfg.workers[1];
              if (w2) {
                setWorker2Name(w2.assignedAssistantName || w2.name);
                setWorker2Telegram(w2.telegramId ? `@${w2.telegramId.replace('@', '')}` : '@igor_asst_1003');
                setWorker2Url(w2.workerUrl || 'http://localhost:8001');
              }
            }
          }
        })
        .catch((e) => console.error('Failed to load onboarding status', e));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    triggerHaptic('impact');

    const workers: WorkerNodeConfig[] = [
      {
        id: 'worker-1',
        name: worker1Name,
        telegramId: worker1Telegram.replace('@', ''),
        workerUrl: worker1Url,
        assignedAssistantName: worker1Name,
        active: true
      }
    ];

    if (activeWorkerCount === 2) {
      workers.push({
        id: 'worker-2',
        name: worker2Name,
        telegramId: worker2Telegram.replace('@', ''),
        workerUrl: worker2Url,
        assignedAssistantName: worker2Name,
        active: true
      });
    }

    const payload: OnboardingConfig = {
      telegramToken: telegramToken.trim(),
      openRouterApiKey: openRouterApiKey.trim(),
      stage1Model,
      stage2Model,
      workerInternalSecret: workerSecret.trim(),
      activeWorkerCount,
      workers
    };

    try {
      const res = await fetch('/api/system/onboarding-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Ошибка сохранения конфигурации');
      }

      triggerHaptic('notification');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Не удалось применить конфигурацию');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-sky-800/60 rounded-2xl max-w-2xl w-full p-5 sm:p-7 text-slate-100 shadow-2xl space-y-6 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚀</span>
              <h2 className="text-lg font-bold text-sky-300">
                {isInitialBlocker ? 'Мастер Первичной Настройки CRM (First Run)' : 'Настройка параметров CRM'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Укажите ключевые параметры инфраструктуры. Все значения автоматически сохраняются в конфигурацию.
            </p>
          </div>
          {!isInitialBlocker && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 rounded-xl text-xs font-mono">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Core API Keys */}
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🔑</span> Ключи API и Интеграции
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                TELEGRAM_BOT_TOKEN <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="7890123456:AAFxXXXXXXXXXXXXXXXXXXXXXXXXX"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-slate-500">Токен вашего Telegram-бота от @BotFather</p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-300">
                OPENROUTER_API_KEY <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={openRouterApiKey}
                  onChange={(e) => setOpenRouterApiKey(e.target.value)}
                  placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-2 text-[10px] text-slate-400 hover:text-white"
                >
                  {showSecret ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                API ключ OpenRouter для двухэтапного ИИ-транслейтора и валидатора
              </p>
            </div>
          </div>

          {/* Section 2: AI Engine Models */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-amber-300">
                Модель Stage 1 (Редактор)
              </label>
              <select
                value={stage1Model}
                onChange={(e) => setStage1Model(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono"
              >
                <option value="openai/gpt-5.6-sol">openai/gpt-5.6-sol (По умолчанию)</option>
                <option value="openai/gpt-4o">openai/gpt-4o</option>
                <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                <option value="deepseek/deepseek-chat">deepseek/deepseek-chat</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-emerald-300">
                Модель Stage 2 (Валидатор)
              </label>
              <select
                value={stage2Model}
                onChange={(e) => setStage2Model(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-200 font-mono"
              >
                <option value="openai/o3-mini">openai/o3-mini (По умолчанию)</option>
                <option value="openai/gpt-4o">openai/gpt-4o</option>
                <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            {!isInitialBlocker && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Отмена
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !telegramToken || !openRouterApiKey}
              className="w-full sm:w-auto px-6 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>⏳ Инициализация CRM...</span>
              ) : (
                <span>✅ Завершить настройку и запустить CRM</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
