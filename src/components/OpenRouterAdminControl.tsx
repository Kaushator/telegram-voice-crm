import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';
import { OpenRouterConfig } from '../types';

const POPULAR_MODELS_MODEL1 = [
  { id: 'openai/gpt-5.6-sol', name: 'OpenAI GPT-5.6 Sol (Редактор & Переводчик)' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Высокая точность текста)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' }
];

const POPULAR_MODELS_MODEL2 = [
  { id: 'openai/o3-mini', name: 'OpenAI o3-mini (Валидатор & Аудит)' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet (Строгий аудит)' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
  { id: 'google/gemini-2.0-flash-001', name: 'Google Gemini 2.0 Flash' }
];

export const OpenRouterAdminControl: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model1, setModel1] = useState('openai/gpt-5.6-sol');
  const [model2, setModel2] = useState('openai/o3-mini');
  const [isEnabled, setIsEnabled] = useState(true);

  // Context State
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

  // Sandbox Test State
  const [testInput, setTestInput] = useState(
    'Забронируй на завтра в Ницце два микроавтобуса Мерседес V-класс для детей с нянями и с 14:00 Range Rover для нас с женой. Еще проверь стоянку для яхты в Каннах и бронь в отеле Negresco на 3 ночи. Если будет сомнительное время выезда — согласуй со мной.'
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load from LocalStorage and Server on Mount
  useEffect(() => {
    // 1. Try local storage
    const savedLocal = localStorage.getItem('openrouter_config');
    if (savedLocal) {
      try {
        const parsed: OpenRouterConfig = JSON.parse(savedLocal);
        setApiKey(parsed.apiKey || '');
        setModel1(parsed.model1Editor || 'openai/gpt-5.6-sol');
        setModel2(parsed.model2Validator || 'openai/o3-mini');
        setIsEnabled(parsed.isEnabled !== false);
        if (parsed.systemContext) {
          setFamilyStructure(parsed.systemContext.familyStructure || familyStructure);
          setCurrentLocation(parsed.systemContext.currentLocation || currentLocation);
          if (parsed.systemContext.primaryTaskDomains) {
            setPrimaryDomains(parsed.systemContext.primaryTaskDomains);
          }
        }
      } catch (e) {
        console.error('Error parsing local openrouter config', e);
      }
    }

    // 2. Fetch from server
    fetch('/api/admin/openrouter-config')
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          const cfg: OpenRouterConfig = data.config;
          if (cfg.apiKey && !apiKey) setApiKey(cfg.apiKey);
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
      .catch((err) => console.error('Error fetching server OpenRouter config', err));
  }, []);

  // Save Settings
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

    // Save to LocalStorage
    localStorage.setItem('openrouter_config', JSON.stringify(configToSave));

    // Save to Server
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
      console.error('Failed to sync OpenRouter config to server', e);
    } finally {
      setSaving(false);
    }
  };

  // Run Sandbox Test
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
        instructions: [
          'Сохранять 100% точность фактов и дат',
          'Никаких галлюцинаций',
          'Обращать внимание на неоднозначности в тексте'
        ]
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
        throw new Error(data.message || 'Ошибка выполнения OpenRouter теста');
      }

      setTestResult(data.result);
      triggerHaptic('notification');
    } catch (err: any) {
      setTestError(err.message || 'Не удалось выполнить запрос к OpenRouter API');
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

  const removeDomain = (index: number) => {
    setPrimaryDomains(primaryDomains.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-slate-900 border border-sky-900/50 rounded-xl p-5 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="border-b border-sky-900/30 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-sky-300 flex items-center gap-2">
            <span>🌐</span> Интеграция с OpenRouter (Двухуровневый AI-Движок)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Настройка 2-х независимых нейросетей: Редактор-Переводчик + Инспектор Валидации
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="accent-sky-500 w-4 h-4 rounded cursor-pointer"
            />
            <span className={isEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {isEnabled ? 'Включен' : 'Выключен'}
            </span>
          </label>

          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5 active:scale-95"
          >
            {saving ? 'Сохранение...' : saveSuccess ? '✓ Сохранено!' : '💾 Сохранить настройки'}
          </button>
        </div>
      </div>

      {/* Model Configurations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* API Key */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 lg:col-span-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <span>🔑</span> OpenRouter API Key (sk-or-v1-...)
            </label>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="text-[11px] text-sky-400 hover:underline"
            >
              {showApiKey ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-200 focus:outline-none focus:border-sky-500"
          />
          <p className="text-[10px] text-slate-500">
            Ключ сохраняется локально в localStorage вашей панели управления и на сервере CRM.
          </p>
        </div>

        {/* Model 1: Editor & Translator */}
        <div className="bg-slate-950 p-4 rounded-xl border border-sky-950 space-y-3">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">1️⃣ Модель 1: Редактор & Переводчик</span>
            <span className="text-[10px] bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800/40 font-mono">
              Stage 1
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Очищает сырой текст от шума, расставляет пунктуацию и переводит на английский и тайский.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Выберите модель:</label>
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
            <label className="text-[10px] text-slate-400">Свой ID модели OpenRouter:</label>
            <input
              type="text"
              value={model1}
              onChange={(e) => setModel1(e.target.value)}
              placeholder="openai/gpt-5.6-sol"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 font-mono"
            />
          </div>
        </div>

        {/* Model 2: Validator & Auditor */}
        <div className="bg-slate-950 p-4 rounded-xl border border-sky-950 space-y-3">
          <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">2️⃣ Модель 2: Инспектор Валидации</span>
            <span className="text-[10px] bg-emerald-950/80 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
              Stage 2
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Сравнивает результат Модели 1 с исходником. Проверяет отстутствие галлюцинаций и подсвечивает неоднозначности.
          </p>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Выберите модель:</label>
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
            <label className="text-[10px] text-slate-400">Свой ID модели OpenRouter:</label>
            <input
              type="text"
              value={model2}
              onChange={(e) => setModel2(e.target.value)}
              placeholder="openai/o3-mini"
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 font-mono"
            />
          </div>
        </div>

        {/* Context Configuration */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-sky-200 flex items-center gap-1.5">
              <span>🏰</span> Структурированный контекст поездки
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Состав семьи и сопровождение:</label>
            <input
              type="text"
              value={familyStructure}
              onChange={(e) => setFamilyStructure(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Локация / Маршрут:</label>
            <input
              type="text"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-400">Сферы задач (VIP Логистика):</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {primaryDomains.map((domain, idx) => (
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
                placeholder="Добавить домен..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
              />
              <button
                onClick={addDomain}
                className="px-2.5 py-1 bg-sky-800 hover:bg-sky-700 text-white rounded text-xs font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sandbox Test Console */}
      <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center gap-2">
              <span>🧪</span> Песочница тестирования двух моделей OpenRouter
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Введите тестовый сырой текст голоса и проверьте последовательную работу Модели 1 и Модели 2 в реальном времени.
            </p>
          </div>

          <button
            onClick={handleRunTest}
            disabled={testLoading || !apiKey}
            className="px-4 py-2 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            {testLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>⚡</span>
            )}
            <span>{testLoading ? 'Выполнение запроса...' : 'Запустить тест 2-х моделей'}</span>
          </button>
        </div>

        {!apiKey && (
          <div className="p-2.5 bg-amber-950/60 border border-amber-700/50 rounded-lg text-amber-200 text-xs flex items-center gap-2">
            <span>⚠️</span> Укажите ваш OpenRouter API Key выше для запуска онлайн-тестирования моделей.
          </div>
        )}

        {/* Input Textarea */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-300 font-semibold">Сырой текст голос-в-текст (WhisperX):</label>
          <textarea
            rows={3}
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Test Error */}
        {testError && (
          <div className="p-3 bg-red-950/80 border border-red-800 text-red-200 rounded-lg text-xs font-mono">
            ❌ Ошибка: {testError}
          </div>
        )}

        {/* Test Output Dual Model Results */}
        {testResult && (
          <div className="space-y-4 animate-fade-in border-t border-slate-800 pt-3">
            <h4 className="text-xs font-bold text-sky-300 flex items-center gap-2">
              <span>📊</span> Результат двухуровневой обработки OpenRouter:
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Model 1 Output */}
              <div className="bg-slate-900 p-3.5 rounded-xl border border-amber-800/60 space-y-2">
                <div className="flex items-center justify-between border-b border-amber-900/40 pb-2">
                  <span className="text-xs font-bold text-amber-300">1️⃣ Ответ Модели 1 ({testResult.model1?.modelName})</span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded font-mono">
                    Редактор & Переводчик
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Очищенный текст (RU):</span>
                  <p className="text-xs font-mono text-amber-100 bg-black/60 p-2 rounded border border-slate-800">
                    {testResult.model1?.cleanText}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Перевод EN:</span>
                  <p className="text-xs font-mono text-slate-200 bg-black/60 p-2 rounded border border-slate-800">
                    {testResult.model1?.translationEn}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Перевод TH:</span>
                  <p className="text-xs font-mono text-slate-200 bg-black/60 p-2 rounded border border-slate-800">
                    {testResult.model1?.translationTh}
                  </p>
                </div>
              </div>

              {/* Model 2 Output */}
              <div className="bg-slate-900 p-3.5 rounded-xl border border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                  <span className="text-xs font-bold text-emerald-300">2️⃣ Ответ Модели 2 ({testResult.model2?.modelName})</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded font-mono">
                    Аудитор Валидации
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Проверенный финальный текст:</span>
                  <p className="text-xs font-mono text-emerald-200 bg-black/60 p-2 rounded border border-slate-800">
                    {testResult.model2?.validatedCleanText}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Проверенный перевод EN:</span>
                  <p className="text-xs font-mono text-slate-200 bg-black/60 p-2 rounded border border-slate-800">
                    {testResult.model2?.validatedTranslationEn}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Отчет о проверке галлюцинаций:</span>
                  <div className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-800/60">
                    {testResult.model2?.auditSummary}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
