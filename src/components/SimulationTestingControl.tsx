import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';

export const SimulationTestingControl: React.FC = () => {
  const [bossChatId, setBossChatId] = useState('@boss_test_1001');
  const [recipientChatId, setRecipientChatId] = useState('@anna_asst_1002');
  const [recipientName, setRecipientName] = useState('Ассистент 1 (Анна)');

  const [simulationState, setSimulationState] = useState<{
    isTestingMode: boolean;
    bossChatId: string;
    recipientChatId: string;
    recipientName: string;
    boundMacWorkerId: string;
    statusMessage: string;
  }>({
    isTestingMode: true,
    bossChatId: '@boss_test_1001',
    recipientChatId: '@anna_asst_1002',
    recipientName: 'Ассистент 1 (Анна)',
    boundMacWorkerId: '1002',
    statusMessage: 'Режим тестирования активен'
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchSimulationState = async () => {
    try {
      const res = await fetch('/api/simulation/state');
      const data = await res.json();
      if (data.simulationConfig) {
        setSimulationState(data.simulationConfig);
        if (data.simulationConfig.bossChatId) setBossChatId(data.simulationConfig.bossChatId);
        if (data.simulationConfig.recipientChatId) setRecipientChatId(data.simulationConfig.recipientChatId);
        if (data.simulationConfig.recipientName) setRecipientName(data.simulationConfig.recipientName);
      }
    } catch (err) {
      console.error('Error fetching simulation state', err);
    }
  };

  useEffect(() => {
    fetchSimulationState();
  }, []);

  const handleApplySetup = async () => {
    setLoading(true);
    triggerHaptic('impact');
    try {
      const res = await fetch('/api/simulation/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bossChatId,
          recipientChatId,
          recipientName
        })
      });
      const data = await res.json();
      if (data.simulationConfig) {
        setSimulationState(data.simulationConfig);
        setFeedback('✅ Тестовые параметры и Mac привязка сохранены');
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err) {
      console.error('Error setting simulation', err);
      setFeedback('❌ Ошибка сохранения параметров');
    } finally {
      setLoading(false);
    }
  };

  const handleResetTests = async () => {
    setLoading(true);
    triggerHaptic('notification');
    try {
      const res = await fetch('/api/simulation/reset', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.simulationConfig) {
        setSimulationState(data.simulationConfig);
        setBossChatId('');
        setRecipientChatId('');
        setRecipientName('');
        setFeedback('🛑 Все тесты завершены. Chat ID и Mac отвязаны!');
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err) {
      console.error('Error resetting simulation', err);
      setFeedback('❌ Ошибка сброса тестов');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-4 sm:p-5 text-slate-100 shadow-2xl space-y-4">
      {/* Top Banner Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <span>🧪</span> Настройка режимов тестирования & Chat ID
          </h3>
          <p className="text-[11px] text-slate-400">
            Управление виртуальными аккаунтами Шефа, Получателя и привязкой Mac Worker
          </p>
        </div>

        <div className="flex items-center gap-2">
          {simulationState.isTestingMode ? (
            <span className="px-3 py-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 rounded-lg text-[11px] font-mono font-semibold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              ТЕСТОВЫЙ РЕЖИМ АКТИВЕН
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-950/80 border border-amber-500/50 text-amber-300 rounded-lg text-[11px] font-mono font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              ОЖИДАНИЕ РЕАЛЬНЫХ ПОЛЬЗОВАТЕЛЕЙ
            </span>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs font-semibold text-amber-200 text-center animate-fade-in">
          {feedback}
        </div>
      )}

      {/* Form Grid for Chat IDs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-300">
            Chat ID / Username Шефа
          </label>
          <input
            type="text"
            value={bossChatId}
            onChange={(e) => setBossChatId(e.target.value)}
            placeholder="@boss_test_1001"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-300">
            Chat ID Получателя (Ассистента)
          </label>
          <input
            type="text"
            value={recipientChatId}
            onChange={(e) => setRecipientChatId(e.target.value)}
            placeholder="@anna_asst_1002"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-300">
            Имя Ассистента (Слот 1)
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Ассистент 1 (Анна)"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Mac Worker Binding Notice */}
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-base">💻</span>
          <div>
            <span className="font-semibold text-slate-200">Автоматическая привязка Mac Worker:</span>
            <span className="text-slate-400 ml-1">
              {simulationState.isTestingMode
                ? `Mac Worker #1002 [Шеф ➔ ${simulationState.recipientName || 'Ассистент'}] привязан и готовит WhisperX`
                : 'Отвязано. Ожидание регистрации реального Mac Worker'}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-amber-300/80 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40 shrink-0">
          Mac Worker status: {simulationState.isTestingMode ? 'ONLINE' : 'OFFLINE (STANDBY)'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
        <button
          disabled={loading}
          onClick={handleApplySetup}
          className="w-full sm:w-auto px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
        >
          <span>⚙️</span> Привязать Chat ID и Mac Worker
        </button>

        <button
          disabled={loading}
          onClick={handleResetTests}
          className="w-full sm:w-auto px-4 py-2 bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg"
        >
          <span>🛑</span> Окончание тестов (Сбросить ID и Mac)
        </button>
      </div>
    </div>
  );
};
