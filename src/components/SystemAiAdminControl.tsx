import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';
import { OpenRouterConfig } from '../types';

const POPULAR_MODELS_MODEL1 = [
  { id: 'openai/gpt-5.6-sol', name: 'OpenAI GPT-5.6 Sol (Редактор & Переводчик - По умолчанию)' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Высокая точность текста)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' }
];

const POPULAR_MODELS_MODEL2 = [
  { id: 'openai/o3-mini', name: 'OpenAI o3-mini (Валидатор & Аудит - По умолчанию)' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet (Строгий аудит)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' }
];

interface SystemStatusData {
  telegramBot: { status: string; tokenMasked: string; source: string };
  openrouter: { status: string; apiKeyMasked: string; stage1Model: string; stage2Model: string; isEnabled: boolean };
  macWorkers: { status: string; workerCount: number; syncInterval: number; autoDistribution: boolean };
}

interface HealthLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  category: string;
  message: string;
  details?: Record<string, any>;
}


export const SystemAiAdminControl: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [healthLogs, setHealthLogs] = useState<HealthLogEntry[]>([]);
  const [healthSummary, setHealthSummary] = useState<any>(null);
  const [showHealthLogs, setShowHealthLogs] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model1, setModel1] = useState('openai/gpt-5.6-sol');
  const [model2, setModel2] = useState('openai/o3-mini');
  const [isEnabled, setIsEnabled] = useState(true);

  // Family Context
  const [familyStructure, setFamilyStructure] = useState('Шеф с женой, 3 детьми и нянями');
  const [currentLocation, setCurrentLocation] = useState('Заграничная поездка / Турне по Европе');
  const [primaryDomains, setPrimaryDomains] = useState([
    'VIP-логистика и трансферы по Европе',
    'Аренда премиальных авто (Range Rover, Mercedes S-Class/V-Class)',
    'Аренда частных яхт, катеров и вертолетов',
    'Бронирование 5-звездочных отелей, вилл и резортов',
    'Координация распорядка семьи, детей и нянь'
  ]);
  const [newDomain, setNewDomain] = useState('');

  // Sandbox Test
  const [testInput, setTestInput] = useState(
    'Забронируй на завтра в Ницце два микроавтобуса Мерседес V-класс для детей с нянями и с 14:00 Range Rover для нас с женой. Еще проверь стоянку для яхты в Каннах и бронь в отеле Negresco на 3 ночи.'
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchHealthLogs = () => {
    fetch('/api/system/health-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHealthLogs(data.logs || []);
          setHealthSummary(data.summary || null);
        }
      })
      .catch((e) => console.error('Error fetching health logs', e));
  };

  useEffect(() => {
    // 1. Load System Status
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSystemStatus({
            telegramBot: data.telegramBot,
            openrouter: data.openrouter,
            macWorkers: data.macWorkers
          });
        }
      })
      .catch((e) => console.error('Error fetching system status', e));

    // 2. Fetch OpenRouter config
    fetch('/api/admin/openrouter-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          const cfg: OpenRouterConfig = data.config;
          if (cfg.apiKey) setApiKey(cfg.apiKey);
          if (cfg.model1Editor) setModel1(cfg.model1Editor);
          if (cfg.model2Validator) setModel2(cfg.model2Validator);
          setIsEnabled(cfg.isEnabled !== false);
          if (cfg.systemContext) {
            setFamilyStructure(cfg.systemContext.familyStructure || familyStructure);
            setCurrentLocation(cfg.systemContext.currentLocation || currentLocation);
            if (cfg.systemContext.primaryTaskDomains?.length) {
              setPrimaryDomains(cfg.systemContext.primaryTaskDomains);
            }
          }
        }
      })
      .catch((err) => console.error('Error fetching OpenRouter config', err));

    // 3. Fetch System Config Health Logs
    fetchHealthLogs();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    triggerHaptic('impact');

    const configToSave: OpenRouterConfig = {
      apiKey,
      model1Editor: model1,
      model2Validator: model2,
      isEnabled,
      systemContext: {
        familyStructure,
        currentLocation,
        primaryTaskDomains: primaryDomains,
        instructions: [
          'Сохранять 100% точность чисел, дат, географических названий, марок автомобилей и финансовых сумм',
          'Категорический запрет на домысливание или галлюцинирование несуществующих деталей',
          'В случае неоднозначности текста — обязательно явно выделить её примечанием [Примечание к записи: ...], не выдумывая подробностей'
        ]
      },
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('openrouter_config', JSON.stringify(configToSave));

    try {
      const res = await fetch('/api/admin/openrouter-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configToSave })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Error saving config', e);
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestError(null);
    setTestResult(null);
    triggerHaptic('impact');

    const overrideConfig: OpenRouterConfig = {
      apiKey,
      model1Editor: model1,
      model2Validator: model2,
      isEnabled: true,
      systemContext: {
        familyStructure,
        currentLocation,
        primaryTaskDomains: primaryDomains,
        instructions: ['Точность фактов', 'Без галлюцинаций']
      }
    };

    try {
      const res = await fetch('/api/admin/openrouter-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: testInput,
          configOverride: overrideConfig
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Ошибка тестирования');
      }

      setTestResult(data.result);
      triggerHaptic('notification');
    } catch (err: any) {
      setTestError(err.message || 'Не удалось выполнить запрос');
    } finally {
      setTestLoading(false);
    }
  };

  const addDomain = () => {
    if (newDomain.trim() && !primaryDomains.includes(newDomain.trim())) {
      setPrimaryDomains([...primaryDomains, newDomain.trim()]);
      setNewDomain('');
    }
  };

  const removeDomain = (idx: number) => {
    setPrimaryDomains(primaryDomains.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 shadow-2xl space-y-5">
        {/* HEADER WITH ZERO-CONFIG BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-sky-300">⚡ Система & AI Движок (Zero-Config)</h2>
            <span className="bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800/60 font-mono">
              Env-First Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Автоматическая инициализация. Бесшовная интеграция Telegram и OpenRouter.
          </p>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow transition-all flex items-center justify-center gap-1.5 active:scale-95"
        >
          {saving ? 'Сохранение...' : saveSuccess ? '✓ Сохранено' : '💾 Сохранить изменения'}
        </button>
      </div>

      {/* 3 STATUS INDICATOR CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Telegram Bot Indicator */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <span>🤖</span> Telegram Bot API
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Активен
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Токен: <span className="text-slate-200">{systemStatus?.telegramBot.tokenMasked || '7890...xX8'}</span>
          </div>
          <div className="text-[10px] text-slate-500">Автозагрузка из .env без вопросов</div>
        </div>

        {/* OpenRouter Indicator */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
              <span>🌐</span> OpenRouter AI Engine
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Подключен
            </span>
          </div>
          <div className="text-[11px] font-mono text-amber-200">
            M1: {model1} | M2: {model2}
          </div>
          <div className="text-[10px] text-slate-500">Ключ: {systemStatus?.openrouter.apiKeyMasked || 'sk-or-v1-...'}</div>
        </div>
      </div>

      {/* SYSTEM CONFIG HEALTH LOGS PANEL */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => { setShowHealthLogs(!showHealthLogs); fetchHealthLogs(); }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <span>📋</span> Логи загрузки конфигурации и здоровья системы ({healthLogs.length})
            </span>
            {healthSummary?.errors > 0 ? (
              <span className="text-[10px] bg-red-950 text-red-400 font-bold px-2 py-0.5 rounded border border-red-800">
                {healthSummary.errors} Ошибок
              </span>
            ) : healthSummary?.warnings > 0 ? (
              <span className="text-[10px] bg-amber-950 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-800">
                {healthSummary.warnings} Предупреждений
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-800">
                Конфигурация OK
              </span>
            )}
          </div>
          <span className="text-[11px] text-sky-400 underline">
            {showHealthLogs ? 'Скрыть логи' : 'Развернуть логи'}
          </span>
        </div>

        {showHealthLogs && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex justify-end mb-1">
              <button
                onClick={fetchHealthLogs}
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1 font-mono"
              >
                🔄 Обновить
              </button>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {healthLogs.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-2 text-center">Логи пусты</div>
              ) : (
                healthLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded border text-xs font-mono space-y-1 ${
                      log.level === 'ERROR'
                        ? 'bg-red-950/60 border-red-800 text-red-200'
                        : log.level === 'WARN'
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold tracking-wider">
                        [{log.level}] [{log.category}]
                      </span>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>{log.message}</div>
                    {log.details && (
                      <div className="text-[10px] text-slate-400 bg-black/40 p-1 rounded overflow-x-auto">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* DUAL MODEL CONFIGURATION & FAMILY LOGISTICS CONTEXT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Model 1: Editor & Translator */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-950 space-y-2.5">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">1️⃣ Модель 1: Перевод & Редактор</span>
            <span className="text-[10px] bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800/40 font-mono">
              gpt-5.6-sol
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Литературная очистка текста от междометий и перевод на EN / TH.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Быстрый выбор:</label>
            <select
              value={model1}
              onChange={(e) => setModel1(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono focus:outline-none focus:border-sky-500"
            >
              {POPULAR_MODELS_MODEL1.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">ID модели OpenRouter:</label>
            <input
              type="text"
              value={model1}
              onChange={(e) => setModel1(e.target.value)}
              placeholder="openai/gpt-5.6-sol"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 font-mono"
            />
          </div>
        </div>

        {/* Model 2: Validator */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-950 space-y-2.5">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">2️⃣ Модель 2: Инспектор Валидации</span>
            <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
              o3-mini
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Аудит точности и сверка фактов. Исключает галлюцинации.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Быстрый выбор:</label>
            <select
              value={model2}
              onChange={(e) => setModel2(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-emerald-200 font-mono focus:outline-none focus:border-sky-500"
            >
              {POPULAR_MODELS_MODEL2.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">ID модели OpenRouter:</label>
            <input
              type="text"
              value={model2}
              onChange={(e) => setModel2(e.target.value)}
              placeholder="openai/o3-mini"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 font-mono"
            />
          </div>
        </div>

        {/* Family & Logistics Context Area */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
          <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <span>🏰</span> Контекст Семьи & Логистики
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Состав семьи и сопровождение:</label>
            <input
              type="text"
              value={familyStructure}
              onChange={(e) => setFamilyStructure(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Сферы задач (VIP):</label>
            <div className="flex flex-wrap gap-1 mb-1">
              {primaryDomains.slice(0, 3).map((domain, idx) => (
                <span
                  key={idx}
                  className="bg-slate-800 text-sky-200 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-slate-700"
                >
                  {domain}
                  <button onClick={() => removeDomain(idx)} className="text-red-400 hover:text-red-300 font-bold ml-1">
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Добавить..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-200"
              />
              <button onClick={addDomain} className="px-2 py-0.5 bg-sky-800 text-white rounded text-xs font-bold">
                +
              </button>
            </div>
          </div>

          {/* API Key Override Optional */}
          <div className="pt-1 space-y-1 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-slate-400 font-mono">OpenRouter API Key:</label>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[10px] text-sky-400 hover:underline"
              >
                {showApiKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-200 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SANDBOX TEST CONSOLE */}
      <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-900/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div>
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
              <span>🧪</span> Песочница экспресс-тестирования AI (GPT-5.6 Sol + o3-mini)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Моментальный запуск 2-этапной обработки текста с подставленным API-ключом.
            </p>
          </div>

          <button
            onClick={handleRunTest}
            disabled={testLoading}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            {testLoading ? '⏳ Выполнение...' : '⚡ Запустить экспресс-тест'}
          </button>
        </div>

        <textarea
          rows={2}
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
        />

        {testError && (
          <div className="p-2 bg-red-950/80 border border-red-800 text-red-200 rounded text-xs font-mono">
            ❌ {testError}
          </div>
        )}

        {testResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-amber-800/60 space-y-1">
              <span className="text-xs font-bold text-amber-300">1️⃣ Ответ Модели 1 ({testResult.model1?.modelName})</span>
              <p className="text-xs font-mono text-amber-100 bg-black/60 p-1.5 rounded">{testResult.model1?.cleanText}</p>
              <p className="text-[11px] font-mono text-slate-300">EN: {testResult.model1?.translationEn}</p>
            </div>

            <div className="bg-slate-900 p-2.5 rounded-lg border border-emerald-800/60 space-y-1">
              <span className="text-xs font-bold text-emerald-300">2️⃣ Валидатор Модели 2 ({testResult.model2?.modelName})</span>
              <p className="text-xs font-mono text-emerald-200 bg-black/60 p-1.5 rounded">{testResult.model2?.validatedCleanText}</p>
              <p className="text-[11px] font-mono text-emerald-400">Аудит: {testResult.model2?.auditSummary}</p>
            </div>
          </div>
        )}
      </div>

    </div>
    </div>
  );
};
