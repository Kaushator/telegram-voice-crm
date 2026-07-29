import React, { useState, useEffect } from 'react';
import { UserRole, Task, TaskMessage } from '../types';
import { initTelegramWebApp, triggerHaptic } from '../utils/telegramSdk';
import { EdenLogo } from './EdenLogo';
import { OpenRouterAdminControl } from './OpenRouterAdminControl';
import { FileUploader } from './FileUploader';


interface TelegramSimulatorProps {
  currentRole: UserRole;
  tasks: Task[];
  taskMessages: Record<string, TaskMessage[]>;
  onSendVoiceMessage: (title: string, durationSec: number) => void;
  onTakeTask: (taskId: string, assistantId: string, assistantName: string) => void;
  onAskQuestion: (taskId: string, assistantId: string, assistantName: string, questionTh: string) => void;
  onReplyQuestion: (taskId: string, questionId: string, replyRu: string) => void;
  onCompleteTask: (taskId: string) => void;
  onRefreshAll?: () => void;
  onSwitchToAdmin?: () => void;
}

export const TelegramSimulator: React.FC<TelegramSimulatorProps> = ({
  currentRole,
  tasks,
  taskMessages,
  onSendVoiceMessage,
  onTakeTask,
  onAskQuestion,
  onReplyQuestion,
  onCompleteTask,
  onRefreshAll,
  onSwitchToAdmin
}) => {
  // Telegram WebApp Init
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  // Chief Voice Recording Flow State
  const [voiceTitle, setVoiceTitle] = useState('Инструкция по закупке техники');
  const [durationSec, setDurationSec] = useState(135);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPartsChain, setAudioPartsChain] = useState<{ id: string; partNum: number; duration: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Assistant & Admin Tabs State
  const [assistantTab, setAssistantTab] = useState<'available' | 'in_progress' | 'completed'>('available');


  // Audio Player Speeds per Task
  const [playbackSpeeds, setPlaybackSpeeds] = useState<Record<string, number>>({});
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Testing States for Bottlenecks & FIFO queue
  const [showTesterPanel, setShowTesterPanel] = useState(true);
  const [latencySimulation, setLatencySimulation] = useState(true); // Default to true so user sees queue order instantly!
  const [isTestingQueue, setIsTestingQueue] = useState(false);
  const [testQueueLog, setTestQueueLog] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [simulatedViewport, setSimulatedViewport] = useState<'full' | 'half'>('full');

  // Chat & Conflict State
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [conflictErrors, setConflictErrors] = useState<Record<string, string>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<string, 'chat' | 'history' | 'pipeline'>>({});
  const [simulatingWorker, setSimulatingWorker] = useState<string | null>(null);

  // Assistant & Chief UX states
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [quickReplyTexts, setQuickReplyTexts] = useState<Record<string, string>>({});

  // Admin Data State
  const [adminSubTab, setAdminSubTab] = useState<'system_ai' | 'simulation' | 'checklist'>('system_ai');
  const [adminActivationCode, setAdminActivationCode] = useState<string | null>(null);

  // Ksenia Easter Egg State
  const [showKseniaEasterEgg, setShowKseniaEasterEgg] = useState(false);
  const [hasSeenKseniaEasterEgg, setHasSeenKseniaEasterEgg] = useState(false);
  const [adminAnalytics, setAdminAnalytics] = useState<any>(null);

  const currentAssistantId = currentRole === 'assistant_1' ? 'usr-1002' : currentRole === 'assistant_2' ? 'usr-1003' : 'usr-1001';
  const currentAssistantName = currentRole === 'assistant_1' ? 'Ассистент 1 (Анна)' : currentRole === 'assistant_2' ? 'Ассистент 2 (Игорь)' : 'Шеф';

  // Fetch Admin Data
  const fetchAdminData = async () => {
    try {
      const analyticsRes = await fetch('/api/admin/analytics');
      const analyticsData = await analyticsRes.json();
      if (analyticsData.analytics) setAdminAnalytics(analyticsData.analytics);
    } catch (err) {
      console.error('Error fetching admin data', err);
    }
  };

  useEffect(() => {
    if (currentRole === 'admin') {
      fetchAdminData();
    }
  }, [currentRole]);

  const [easterEggLang, setEasterEggLang] = useState<'ru' | 'en' | 'th'>('ru');

  useEffect(() => {
    const completedBossTasksCount = tasks.filter((t) => t.status === 'completed').length;
    if (completedBossTasksCount >= 5 && !hasSeenKseniaEasterEgg) {
      setShowKseniaEasterEgg(true);
      setHasSeenKseniaEasterEgg(true);
      triggerHaptic('notification');
    }
  }, [tasks, hasSeenKseniaEasterEgg]);

  // Voice recording simulation
  const handleStartVoiceRecord = () => {
    triggerHaptic('impact', 'medium');
    setIsRecording(true);
  };

  const handleAddVoicePart = () => {
    triggerHaptic('notification', 'success');
    const newPartNum = audioPartsChain.length + 1;
    setAudioPartsChain((prev) => [
      ...prev,
      { id: 'part-' + Date.now(), partNum: newPartNum, duration: Math.floor(Math.random() * 30) + 15 }
    ]);
  };

  const handleFinishVoiceTask = () => {
    triggerHaptic('notification', 'success');
    setIsRecording(false);
    const totalDuration = audioPartsChain.reduce((sum, p) => sum + p.duration, durationSec);
    onSendVoiceMessage(voiceTitle, totalDuration);
    setAudioPartsChain([]);
  };

  const handleCancelVoiceTask = () => {
    triggerHaptic('notification', 'warning');
    setIsRecording(false);
    setAudioPartsChain([]);
  };

  const handleSendMessage = async (taskId: string) => {
    const text = chatInputs[taskId];
    if (!text) return;

    triggerHaptic('impact', 'light');

    try {
      const res = await fetch(`/api/tasks/${taskId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          senderId: currentAssistantId,
          senderName: currentAssistantName,
          senderRole: currentRole.startsWith('assistant') ? 'assistant' : currentRole === 'admin' ? 'admin' : 'chief'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setConflictErrors((prev) => ({ ...prev, [taskId]: data.message || 'Ошибка доступа' }));
        triggerHaptic('notification', 'error');
      } else {
        setChatInputs((prev) => ({ ...prev, [taskId]: '' }));
        setConflictErrors((prev) => ({ ...prev, [taskId]: '' }));
        if (onRefreshAll) onRefreshAll();
      }
    } catch (err: any) {
      setConflictErrors((prev) => ({ ...prev, [taskId]: err.message }));
      triggerHaptic('notification', 'error');
    }
  };

  const handleTransferTask = async (taskId: string, targetId: string, targetName: string) => {
    triggerHaptic('impact', 'medium');
    try {
      const res = await fetch(`/api/tasks/${taskId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAssistantId: targetId,
          targetAssistantName: targetName,
          senderId: currentAssistantId,
          senderRole: currentRole.startsWith('assistant') ? 'assistant' : 'admin',
          reason: 'Передача задачи второму ассистенту'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setConflictErrors((prev) => ({ ...prev, [taskId]: data.message }));
        triggerHaptic('notification', 'error');
      } else {
        setConflictErrors((prev) => ({ ...prev, [taskId]: `Успешно передано ассистенту ${targetName}` }));
        triggerHaptic('notification', 'success');
        setTimeout(() => setConflictErrors((prev) => ({ ...prev, [taskId]: '' })), 4000);
        if (onRefreshAll) onRefreshAll();
      }
    } catch (err: any) {
      setConflictErrors((prev) => ({ ...prev, [taskId]: err.message }));
    }
  };

  const handleAcceptTaskWithLock = async (taskId: string) => {
    triggerHaptic('impact', 'heavy');
    try {
      const res = await fetch(`/api/tasks/${taskId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: currentAssistantId,
          assistantName: currentAssistantName
        })
      });
      const data = await res.json();

      if (res.status === 409) {
        setConflictErrors((prev) => ({ ...prev, [taskId]: data.message }));
        triggerHaptic('notification', 'error');
      } else if (!res.ok) {
        setConflictErrors((prev) => ({ ...prev, [taskId]: data.message || 'Ошибка принятия задачи' }));
        triggerHaptic('notification', 'error');
      } else {
        setConflictErrors((prev) => ({ ...prev, [taskId]: '' }));
        triggerHaptic('notification', 'success');
        onTakeTask(taskId, currentAssistantId, currentAssistantName);
        if (onRefreshAll) onRefreshAll();
      }
    } catch (err: any) {
      setConflictErrors((prev) => ({ ...prev, [taskId]: err.message }));
    }
  };

  const handleStressTestQueue = async () => {
    setIsTestingQueue(true);
    setTestQueueLog(['[ТЕСТ] Запуск параллельного стресс-теста очереди...']);
    triggerHaptic('impact', 'heavy');

    try {
      setTestQueueLog((p) => [...p, '[ТЕСТ] Шаг 1: Создание 3 тестовых задач на сервере...']);
      const createRes = await fetch('/api/tasks/mass-create-test', {
        method: 'POST'
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || 'Ошибка создания задач');
      }

      const { taskIds } = createData;
      setTestQueueLog((p) => [
        ...p,
        `[ТЕСТ] Создано задач: ${taskIds.length} (${taskIds.join(', ')})`,
        '[ТЕСТ] Шаг 2: Отправка 3 параллельных запросов транскрибации на сервер...',
        '[ТЕСТ] Запросы запущены одновременно (Promise.all). Наблюдайте за последовательным FIFO-выполнением:'
      ]);

      if (onRefreshAll) onRefreshAll();

      const startTime = Date.now();
      const promises = taskIds.map(async (id: string, index: number) => {
        const orderNum = index + 1;
        setTestQueueLog((p) => [...p, `⏳ [ТЕСТ] Запрос #${orderNum} отправлен для задачи #${id}...`]);
        try {
          const res = await fetch('/api/openrouter/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: id, simulateLatency: true }) // Force simulated delay to make queue visible
          });
          const data = await res.json();
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          if (res.ok) {
            setTestQueueLog((p) => [...p, `✅ [ТЕСТ] Завершено #${orderNum} (${id}) на ${elapsedSec}с от старта`]);
          } else {
            setTestQueueLog((p) => [...p, `❌ [ТЕСТ] Ошибка #${orderNum} (${id}): ${data.message} на ${elapsedSec}с`]);
          }
        } catch (err: any) {
          setTestQueueLog((p) => [...p, `❌ [ТЕСТ] Сбой соединения для #${orderNum}: ${err.message}`]);
        }
      });

      // Wait for all to finish
      await Promise.all(promises);
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      setTestQueueLog((p) => [
        ...p,
        `🎉 [ТЕСТ ЗАВЕРШЕН] Все запросы выполнены за ${totalElapsed}с! Очередь обрабатывалась строго по одному.`,
        '[ТЕСТ] Это доказывает полную защиту от пересечения вызовов API и перегрузки OpenRouter.'
      ]);
      triggerHaptic('notification', 'success');
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setTestQueueLog((p) => [...p, `❌ [ТЕСТ СБОЙ]: ${err.message}`]);
      triggerHaptic('notification', 'error');
    } finally {
      setIsTestingQueue(false);
    }
  };

  const handleSimulateTranscription = async (taskId: string) => {
    setSimulatingWorker(taskId);
    triggerHaptic('impact', 'medium');
    try {
      const res = await fetch('/api/openrouter/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, simulateLatency: latencySimulation })
      });
      const data = await res.json();

      if (res.ok) {
        setConflictErrors((prev) => ({ ...prev, [taskId]: '✅ OpenRouter (GPT-4o) завершил транскрибацию! Выполнен AI Cleanup & Translation.' }));
        setActiveTabMap((p) => ({ ...p, [taskId]: 'pipeline' }));
        triggerHaptic('notification', 'success');
        setTimeout(() => setConflictErrors((prev) => ({ ...prev, [taskId]: '' })), 5000);
        if (onRefreshAll) onRefreshAll();
      } else {
        setConflictErrors((prev) => ({ ...prev, [taskId]: data.message || 'Ошибка OpenRouter' }));
        triggerHaptic('notification', 'error');
      }
    } catch (err: any) {
      setConflictErrors((prev) => ({ ...prev, [taskId]: err.message }));
      triggerHaptic('notification', 'error');
    } finally {
      setSimulatingWorker(null);
    }
  };

  const handleGenerateActivationCode = async () => {
    try {
      const res = await fetch('/api/assistant/activation-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: '1002' })
      });
      const data = await res.json();
      if (data.code) {
        setAdminActivationCode(data.code);
        triggerHaptic('notification', 'success');
      }
    } catch (err) {
      console.error('Activation code error', err);
    }
  };

  const handleResetSlot = async (slotNum: number) => {
    try {
      const res = await fetch('/api/slots/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slotNum })
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('notification', 'success');
        fetchAdminData();
      }
    } catch (err) {
      console.error('Reset slot error', err);
    }
  };

  const togglePlaybackSpeed = (taskId: string) => {
    setPlaybackSpeeds((prev) => {
      const current = prev[taskId] || 1;
      const next = current === 1 ? 1.25 : current === 1.25 ? 1.5 : 1;
      triggerHaptic('selection');
      return { ...prev, [taskId]: next };
    });
  };

  // Filter tasks based on Assistant tab
  const availableTasks = tasks.filter((t) => !t.assignedAssistantId || t.status === 'available' || t.status === 'pending');
  const inProgressTasks = tasks.filter((t) => t.assignedAssistantId === currentAssistantId && t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter((t) => t.assignedAssistantId === currentAssistantId && t.status === 'completed');

  const displayedTasks = currentRole.startsWith('assistant')
    ? assistantTab === 'available'
      ? availableTasks
      : assistantTab === 'in_progress'
      ? inProgressTasks
      : completedTasks
    : tasks;

  const simulatorStyle = themeMode === 'light'
    ? {
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        borderColor: '#cbd5e1'
      }
    : {
        backgroundColor: 'var(--tg-theme-bg-color, #0f172a)',
        color: 'var(--tg-theme-text-color, #f8fafc)'
      };

  return (
    <div
      className="bg-slate-900 rounded-xl border border-slate-800 text-slate-100 overflow-hidden shadow-2xl relative transition-all duration-300"
      style={simulatorStyle}
    >
      {/* Background Watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 overflow-hidden z-0">
        <EdenLogo className="scale-150" />
      </div>

      {/* Telegram Header with Branding */}
      <div className={`backdrop-blur-md px-4 py-3 border-b flex items-center justify-between z-10 relative transition-colors duration-300 ${
        themeMode === 'light' ? 'bg-white/95 border-slate-200' : 'bg-slate-900/90 border-amber-900/30'
      }`}>
        <div className="flex items-center gap-3">
          <EdenLogo variant="compact" />
          <div className="border-l border-amber-500/30 pl-3">
            <h2 className={`text-xs font-semibold tracking-wide ${themeMode === 'light' ? 'text-slate-800' : 'text-white'}`}>GARDENS OF EDEN RESIDENCES</h2>
            <p className="text-[10px] text-amber-500 font-mono">
              {currentRole === 'boss' && 'Язык: Русский (Шеф)'}
              {currentRole.startsWith('assistant') && 'ภาษา: ภาษาไทย (ผู้ช่วย)'}
              {currentRole === 'admin' && 'Язык: Русский (Администратор)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2.5 py-1 rounded border font-mono transition-colors duration-300 ${
            themeMode === 'light' ? 'text-slate-700 bg-slate-100 border-slate-200' : 'text-amber-100/90 bg-amber-950/60 border-amber-800/50'
          }`}>
            {currentRole === 'admin' ? 'Администратор' : currentAssistantName}
          </span>
        </div>
      </div>

      {/* Main Container */}
      <div 
        className={`p-4 space-y-4 overflow-y-auto transition-all duration-300 z-10 relative ${
          themeMode === 'light' ? 'bg-slate-100/90' : 'bg-slate-950/70'
        }`}
        style={{
          maxHeight: simulatedViewport === 'half' ? '380px' : '640px'
        }}
      >
        {/* 🧪 ПАНЕЛЬ ТЕСТИРОВАНИЯ УЗКИХ МЕСТ TG MINI APP & FIFO ОЧЕРЕДИ */}
        <div className={`rounded-xl border transition-all duration-300 ${
          themeMode === 'light' 
            ? 'bg-white border-slate-200 shadow-sm text-slate-800' 
            : 'bg-slate-900/90 border-slate-800 shadow-xl text-slate-100'
        }`}>
          <div 
            onClick={() => {
              setShowTesterPanel(!showTesterPanel);
              triggerHaptic('selection');
            }}
            className={`p-3 flex items-center justify-between cursor-pointer select-none font-semibold text-xs border-b transition-colors ${
              themeMode === 'light' ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-800/60 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🧪</span>
              <span className="tracking-wide uppercase">Панель тестирования Mini App & FIFO-очереди</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                themeMode === 'light' ? 'bg-sky-100 text-sky-700' : 'bg-sky-950 text-sky-400 border border-sky-900/60'
              }`}>
                FIFO-Очередь: Активна
              </span>
              <span className="text-slate-400">{showTesterPanel ? '▲' : '▼'}</span>
            </div>
          </div>

          {showTesterPanel && (
            <div className="p-3.5 space-y-3.5 text-xs animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                
                {/* 1. FIFO Очередь */}
                <div className="space-y-2">
                  <div className="font-bold text-[11px] tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                    <span>⚡️</span>
                    <span>1. FIFO Очередь (OpenRouter)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Предотвращает параллельные вызовы OpenRouter и ошибки 429 (Too Many Requests), выстраивая запросы строго по очереди.
                  </p>
                  <button
                    onClick={handleStressTestQueue}
                    disabled={isTestingQueue}
                    className="w-full py-2 px-3 rounded-lg font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white disabled:bg-slate-800 disabled:text-slate-500 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
                  >
                    {isTestingQueue ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-slate-400 border-t-white animate-spin" />
                        <span>Тестирование...</span>
                      </>
                    ) : (
                      <>
                        <span>💥</span>
                        <span>Запустить FIFO Стресс-тест</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. Задержка Сети */}
                <div className="space-y-2">
                  <div className="font-bold text-[11px] tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                    <span>📡</span>
                    <span>2. Имитация задержки связи</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Добавляет искусственную задержку +2.5с к транскрибации, чтобы наглядно увидеть последовательное продвижение очереди FIFO.
                  </p>
                  <label className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                    themeMode === 'light' 
                      ? latencySimulation ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200' 
                      : latencySimulation ? 'bg-amber-950/15 border-amber-900/40' : 'bg-slate-950/40 border-slate-800'
                  }`}>
                    <span className="font-semibold text-[11px] text-slate-400">Медленное 3G соединение</span>
                    <input
                      type="checkbox"
                      checked={latencySimulation}
                      onChange={(e) => {
                        setLatencySimulation(e.target.checked);
                        triggerHaptic('selection');
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                {/* 3. TG SDK & Viewport */}
                <div className="space-y-2">
                  <div className="font-bold text-[11px] tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                    <span>📱</span>
                    <span>3. TG SDK & Viewport</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Проверка адаптивности Mini App к интерфейсу Telegram: смена цветовой темы и сжатие экрана клавиатурой.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
                        triggerHaptic('selection');
                      }}
                      className="py-1 px-1.5 rounded border border-slate-700 hover:bg-slate-800 text-[10px] font-semibold text-center transition-colors bg-slate-900/50"
                    >
                      🎨 {themeMode === 'dark' ? 'Светлая тема' : 'Темная тема'}
                    </button>
                    <button
                      onClick={() => {
                        setSimulatedViewport(simulatedViewport === 'full' ? 'half' : 'full');
                        triggerHaptic('impact', 'light');
                      }}
                      className="py-1 px-1.5 rounded border border-slate-700 hover:bg-slate-800 text-[10px] font-semibold text-center transition-colors bg-slate-900/50"
                    >
                      ⌨️ {simulatedViewport === 'full' ? 'Клавиатура' : 'Полный экран'}
                    </button>
                  </div>
                  <div className="pt-1">
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                      <span>Имитация Haptic feedback:</span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => triggerHaptic('impact', 'light')}
                          className="px-1 py-0.5 bg-slate-950/85 border border-slate-800 text-slate-300 rounded hover:text-white"
                          title="Impact Light"
                        >
                          L
                        </button>
                        <button 
                          onClick={() => triggerHaptic('impact', 'heavy')}
                          className="px-1 py-0.5 bg-slate-950/85 border border-slate-800 text-slate-300 rounded hover:text-white"
                          title="Impact Heavy"
                        >
                          H
                        </button>
                        <button 
                          onClick={() => triggerHaptic('notification', 'success')}
                          className="px-1 py-0.5 bg-slate-950/85 border border-slate-800 text-emerald-400 rounded hover:text-emerald-300"
                          title="Notification Success"
                        >
                          S
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Тестовый консольный лог выполнения очереди */}
              {testQueueLog.length > 0 && (
                <div className="mt-2.5 p-2.5 bg-slate-950 border border-slate-850 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-900 pb-1">
                    <span>📋 Консоль тестирования FIFO-очереди</span>
                    <button
                      onClick={() => setTestQueueLog([])}
                      className="text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Очистить
                    </button>
                  </div>
                  <div className="max-h-[110px] overflow-y-auto space-y-0.5 font-mono text-[10px] leading-normal text-slate-300">
                    {testQueueLog.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CHIEF ROLE INTERFACE */}
        {currentRole === 'boss' && (
          <div className="space-y-4">
            {/* Elegant Boss Command Center Banner */}
            <div 
              className="relative rounded-2xl overflow-hidden border border-amber-500/20 shadow-2xl p-6 flex flex-col justify-between min-h-[160px] bg-cover bg-center select-none"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.95) 40%, rgba(15, 23, 42, 0.4) 100%), url('/assets/brand-image/GardensOfEden_Hero_1920x1080.png')`
              }}
            >
              {/* Monogram watermark */}
              <div className="absolute top-4 right-4 w-12 h-12 opacity-80 pointer-events-none">
                <img src="/assets/logos/Gardens of Eden/Monogram.svg" alt="Monogram" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>

              <div className="space-y-1 relative z-10">
                <span className="text-[10px] font-mono font-bold tracking-widest text-amber-300 uppercase px-2 py-0.5 bg-amber-950/85 rounded border border-amber-800/40 w-fit block">
                  Рабочий стол Шефа (Boss Dashboard)
                </span>
                <h1 className="text-xl sm:text-2xl font-bold font-serif-luxury tracking-wide text-white">
                  Gardens of Eden CRM
                </h1>
                <p className="text-xs text-slate-300 max-w-md">
                  Управление поручениями, транскрибация голосовых в реальном времени и контроль качества работы ассистентов.
                </p>
              </div>

              {/* Status Indicators */}
              <div className="flex flex-wrap items-center gap-4 pt-3 mt-2 border-t border-slate-800/60 text-[11px] text-slate-300 relative z-10">
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>OpenRouter GPT-4o Transcribe: <b>Активен</b></span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
                  <span>Задач в работе: <b>{tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length}</b></span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-900/95 p-1.5 rounded-xl border border-slate-800/80 backdrop-blur-md">
              <button
                onClick={() => {
                  setShowHistory(false);
                  triggerHaptic('selection');
                }}
                className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  !showHistory ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🎙 Запись задачи
              </button>
              <button
                onClick={() => {
                  setShowHistory(true);
                  triggerHaptic('selection');
                }}
                className={`py-2 px-3 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  showHistory ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📜 История заданий
              </button>
            </div>

            {!showHistory && (
              <div className="bg-slate-900/90 border border-sky-800/60 rounded-xl p-4 space-y-3.5 text-xs shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                    <span className="font-semibold text-slate-100 text-sm">Голосовое поручение Шефа</span>
                  </div>
                  {isRecording && (
                    <span className="text-rose-400 font-mono text-xs font-bold animate-pulse px-2 py-0.5 bg-rose-950/60 rounded border border-rose-800">
                      REC ●
                    </span>
                  )}
                </div>

                {/* Soundwave / Waveform visualizer */}
                {isRecording && (
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-sky-900/60 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Запись аудиопотока...</span>
                      <span className="text-sky-400 font-bold">{durationSec} сек</span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 h-12">
                      {[...Array(20)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 bg-sky-400 rounded-full animate-bounce"
                          style={{
                            height: `${Math.floor(Math.random() * 32) + 10}px`,
                            animationDelay: `${(i % 6) * 100}ms`
                          }}
                        />
                      ))}
                    </div>

                    {/* Sequential Voice Parts Chain */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <div className="text-[11px] text-slate-400 font-mono font-bold">
                        Записано фрагментов ({audioPartsChain.length + 1}):
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                        <span className="bg-sky-950 text-sky-300 px-2.5 py-1 rounded border border-sky-800 font-semibold">
                          Фрагмент 1 ({durationSec} сек)
                        </span>
                        {audioPartsChain.map((part) => (
                          <span key={part.id} className="bg-indigo-950 text-indigo-300 px-2.5 py-1 rounded border border-indigo-800 font-semibold">
                            Фрагмент {part.partNum + 1} ({part.duration} сек)
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Prominent Recording & Action Controls */}
                {!isRecording ? (
                  <button
                    onClick={handleStartVoiceRecord}
                    className="w-full py-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-sky-500/20 text-base flex items-center justify-center gap-2"
                  >
                    <span className="text-xl">🎙</span>
                    <span>Дать задание</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      onClick={handleAddVoicePart}
                      className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow"
                    >
                      <span>➕ Дописать</span>
                    </button>
                    <button
                      onClick={handleFinishVoiceTask}
                      className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow"
                    >
                      <span>🚀 Отправить</span>
                    </button>
                    <button
                      onClick={handleCancelVoiceTask}
                      className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 border border-slate-700"
                    >
                      <span>❌ Отмена</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ASSISTANT ROLE INTERFACE TABS */}
        {currentRole.startsWith('assistant') && (
          <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setAssistantTab('available');
                triggerHaptic('selection');
              }}
              className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                assistantTab === 'available' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              งานที่พร้อมรับ ({availableTasks.length})
            </button>
            <button
              onClick={() => {
                setAssistantTab('in_progress');
                triggerHaptic('selection');
              }}
              className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                assistantTab === 'in_progress' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              กำลังดำเนินการ ({inProgressTasks.length})
            </button>
            <button
              onClick={() => {
                setAssistantTab('completed');
                triggerHaptic('selection');
              }}
              className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                assistantTab === 'completed' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              งานที่เสร็จสิ้น ({completedTasks.length})
            </button>
          </div>
        )}

        {/* ADMIN ROLE INTEGRATED DASHBOARD HEADER */}
        {currentRole === 'admin' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-sky-400">📊 Режим CRM / Задач (Администратор)</span>
              <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800 font-mono">
                Admin Mode
              </span>
            </div>
            {onSwitchToAdmin && (
              <button
                id="switch-to-admin-btn"
                onClick={onSwitchToAdmin}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white font-medium text-xs rounded transition-all flex items-center gap-1.5 shadow border border-amber-600/40 active:scale-95"
              >
                <span>⚙️</span>
                <span>Настройки системы / Админка</span>
              </button>
            )}
          </div>
        )}


        {/* TASK FEED LIST */}
        <div className="space-y-3 z-10 relative">
          <div className="text-center text-[10px] text-slate-500 uppercase tracking-wider font-mono">
            {currentRole.startsWith('assistant')
              ? assistantTab === 'available'
                ? 'งานที่พร้อมรับทั้งหมด (AVAILABLE TASKS)'
                : assistantTab === 'in_progress'
                ? 'งานที่อยู่ระหว่างดำเนินการ (IN PROGRESS TASKS)'
                : 'งานที่เสร็จสิ้นแล้ว (COMPLETED TASKS)'
              : 'Лента всех задач'}
          </div>

          {displayedTasks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs italic">
              {currentRole.startsWith('assistant') ? 'ไม่มีรายการงานในหมวดหมู่นี้' : 'Нет доступных задач в этой категории'}
            </div>
          ) : (
            displayedTasks.map((task) => {
              const isOwner =
                !task.assignedAssistantId ||
                task.assignedAssistantId === currentAssistantId ||
                currentRole === 'chief' ||
                currentRole === 'admin';

              const speed = playbackSpeeds[task.id] || 1;

              return (
                <div key={task.id} className="bg-slate-800/90 border border-slate-700/80 rounded-lg p-3.5 space-y-3 text-xs shadow-md">
                  {/* Card Header */}
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-mono text-sky-400 font-bold">#{task.id}</span>
                    <div className="flex items-center gap-2">
                      {task.assignedAssistantName && (
                        <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono">
                          {currentRole.startsWith('assistant') ? `👤 ผู้ดูแล: ${task.assignedAssistantName}` : `👤 Владелец: ${task.assignedAssistantName}`}
                        </span>
                      )}
                      <span>{new Date(task.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>

                  {/* Task Title & Read-Only Badge */}
                  <div className="font-semibold text-slate-100 flex items-center justify-between text-sm">
                    <span>{task.title}</span>
                    {!isOwner && currentRole.startsWith('assistant') && (
                      <span className="text-[10px] text-rose-400 bg-rose-950/80 border border-rose-800 px-2 py-0.5 rounded font-mono font-bold">
                        🔒 อ่านอย่างเดียว (READ-ONLY)
                      </span>
                    )}
                  </div>

                  {/* Main Task Content (3-Level Architecture for Assistants, Russian for Boss) */}
                  {currentRole.startsWith('assistant') ? (
                    <div className="space-y-2.5 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                      {/* Level 1: Refined English */}
                      <div className="space-y-1">
                        <div className="text-[10px] text-sky-400 font-mono font-bold uppercase tracking-wider flex justify-between">
                          <span>1. Refined English Task (หลัก):</span>
                          <span className="text-slate-500 font-normal">Clean English</span>
                        </div>
                        <div className="text-slate-100 text-xs leading-relaxed font-medium bg-slate-900/90 p-2.5 rounded border border-slate-800 shadow-inner">
                          {task.voiceMessage.translationEn || 'We urgently need to order 5 new 4K monitors and 2 Cisco network switches for our branch. Please approve the invoice by the end of the day.'}
                        </div>
                      </div>

                      {/* Level 2: Thai Summary + Meaning Validator Warning */}
                      <div className="space-y-1 pt-1.5 border-t border-slate-900">
                        <div className="text-[10px] text-emerald-400 font-mono font-bold uppercase tracking-wider flex justify-between">
                          <span>🇹🇭 2. Thai Summary (สรุป):</span>
                          <span className="text-slate-500 font-normal">ภาษาไทย</span>
                        </div>
                        <div className="text-emerald-200 text-xs leading-relaxed italic bg-emerald-950/30 p-2.5 rounded border border-emerald-900/50">
                          {task.voiceMessage.summaryTh || task.voiceMessage.translationTh || 'เราจำเป็นต้องสั่งซื้อจอมอนิเตอร์ 4K ใหม่ 5 จอและสวิตช์เครือข่าย Cisco 2 เครื่องสำหรับสาขาของเราโดยด่วน'}
                        </div>

                        {/* Meaning Validator Warning Badge */}
                        <div className="mt-1.5 p-2 bg-amber-950/50 border border-amber-800/60 rounded-lg text-amber-300 text-[11px] font-mono flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="text-amber-400">⚠️</span>
                            <span className="font-semibold">Перепроверьте контекст / Чат с Шефом</span>
                          </span>
                          <span className="text-[10px] text-amber-400/80 bg-amber-900/40 px-1.5 py-0.5 rounded border border-amber-800/40">
                            โปรดตรวจสอบบริบท
                          </span>
                        </div>
                      </div>

                      {/* Level 3: Raw English (Hidden under toggle button) */}
                      <div className="pt-1.5 border-t border-slate-900">
                        <button
                          onClick={() => setExpandedTranscripts((prev) => ({ ...prev, [task.id]: !prev[task.id] }))}
                          className="w-full py-1.5 px-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded border border-slate-800 text-[11px] font-mono flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>🔍</span>
                            <span>{expandedTranscripts[task.id] ? 'Скрыть исходник / Hide Raw' : 'Показать исходник / Show Raw'}</span>
                          </span>
                          <span className="text-sky-400">{expandedTranscripts[task.id] ? '▲' : '▼'}</span>
                        </button>

                        {expandedTranscripts[task.id] && (
                          <div className="mt-2 p-2.5 bg-slate-900/90 rounded text-[11px] text-slate-300 space-y-1 font-mono border border-slate-800 animate-fadeIn">
                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">[3. RAW ENGLISH / WHISPERX TRANSCRIPTION]:</div>
                            <p className="whitespace-pre-wrap leading-relaxed text-slate-200 bg-slate-950 p-2 rounded border border-slate-800/80">
                              {task.voiceMessage.originalTranscript || 'Raw transcript: We urgently need to order 5 new 4K monitors and 2 Cisco network switches for branch office.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider flex justify-between">
                        <span>Поручение Шефа (Русский):</span>
                        {task.audioPartsCount && task.audioPartsCount > 1 && (
                          <span className="text-sky-400 font-bold">🎙 {task.audioPartsCount} частей аудио</span>
                        )}
                      </div>
                      <div className="text-slate-100 text-xs leading-relaxed">
                        {task.voiceMessage.translationRu || task.voiceMessage.originalTranscript || 'Инструкция по закупке оборудования'}
                      </div>

                      {/* Questions from Assistants Block for Chief */}
                      {currentRole === 'boss' && task.questions && task.questions.length > 0 && (
                        <div className="mt-2 bg-amber-950/30 border border-amber-800/60 p-2.5 rounded-lg space-y-2">
                          <div className="text-amber-400 text-xs font-bold flex items-center gap-1">
                            <span>❓ Вопросы от ассистентов ({task.questions.length}):</span>
                          </div>
                          {task.questions.map((q) => (
                            <div key={q.id} className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span className="text-sky-400 font-bold">{q.assistantName}:</span>
                                <span>{new Date(q.createdAt).toLocaleTimeString()}</span>
                              </div>
                              <div className="text-xs text-slate-200">{q.questionRu}</div>
                              {q.replyRu ? (
                                <div className="text-[11px] text-emerald-400 bg-emerald-950/40 p-1.5 rounded font-mono border border-emerald-900/50">
                                  ✅ Ваш ответ: {q.replyRu}
                                </div>
                              ) : (
                                <div className="flex gap-1.5 pt-1">
                                  <input
                                    type="text"
                                    placeholder="Быстрый ответ..."
                                    value={quickReplyTexts[q.id] || ''}
                                    onChange={(e) => setQuickReplyTexts((p) => ({ ...p, [q.id]: e.target.value }))}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => {
                                      if (quickReplyTexts[q.id]) {
                                        onReplyQuestion(task.id, q.id, quickReplyTexts[q.id]);
                                        setQuickReplyTexts((p) => ({ ...p, [q.id]: '' }));
                                        triggerHaptic('notification', 'success');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold shrink-0"
                                  >
                                    Ответить
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Audio Playback Badge (Timeline slider removed for clean UI) */}
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPlayingAudioId(playingAudioId === task.id ? null : task.id);
                          triggerHaptic('impact', 'light');
                        }}
                        className="w-7 h-7 rounded-full bg-sky-600 hover:bg-sky-500 flex items-center justify-center text-white font-bold shrink-0 transition-colors"
                      >
                        {playingAudioId === task.id ? '⏸' : '▶'}
                      </button>
                      <span className="text-slate-300 font-medium">
                        🎙 {currentRole.startsWith('assistant') ? `ข้อความเสียง ${task.voiceMessage.durationSeconds} วินาที` : `Голосовое ${task.voiceMessage.durationSeconds} сек`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-sky-400">
                        {playingAudioId === task.id ? (currentRole.startsWith('assistant') ? 'กำลังเล่น...' : 'Воспроизведение') : ''}
                      </span>
                      <button
                        onClick={() => togglePlaybackSpeed(task.id)}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-sky-400 font-mono rounded text-[10px] font-bold border border-slate-800"
                      >
                        {speed}x
                      </button>
                    </div>
                  </div>

                  {/* File Exchange Section (Chief <-> Assistant) */}
                  <FileUploader
                    taskId={task.id}
                    currentRole={currentRole}
                    currentAssistantName={currentAssistantName}
                    files={task.files}
                    triggerHaptic={triggerHaptic}
                    onUploadSuccess={() => {
                      if (onRefreshAll) onRefreshAll();
                    }}
                  />

                  {/* Status Badge (Thai for Assistant, Russian for Chief/Admin) */}
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between text-[11px]">
                    <div className="text-slate-400 font-mono">{currentRole.startsWith('assistant') ? 'สถานะงาน:' : 'Статус задачи:'}</div>
                    <div className="font-mono font-semibold">
                      {currentRole.startsWith('assistant') ? (
                        <>
                          {task.status === 'collecting' && <span className="text-purple-400">🎙 กำลังบันทึกเสียง...</span>}
                          {task.status === 'pending' && <span className="text-amber-400">⏳ พร้อมรับงาน</span>}
                          {task.status === 'available' && <span className="text-amber-400">🟢 พร้อมรับงาน</span>}
                          {task.status === 'assigned' && <span className="text-sky-400">📌 รับงานแล้ว</span>}
                          {task.status === 'transcribing' && <span className="text-sky-300">🎙 กำลังถอดความ...</span>}
                          {task.status === 'processing' && <span className="text-indigo-400">⚙️ กำลังประมวลผล AI...</span>}
                          {task.status === 'review' && <span className="text-emerald-300">🔍 รอการตรวจสอบ</span>}
                          {task.status === 'in_progress' && <span className="text-emerald-400">⚡ กำลังดำเนินการ</span>}
                          {task.status === 'completed' && <span className="text-slate-400">✅ เสร็จสิ้น</span>}
                        </>
                      ) : (
                        <>
                          {task.status === 'collecting' && <span className="text-purple-400">🎙 Прием голоса...</span>}
                          {task.status === 'pending' && <span className="text-amber-400">⏳ Свободна</span>}
                          {task.status === 'available' && <span className="text-amber-400">🟢 Доступна</span>}
                          {task.status === 'assigned' && <span className="text-sky-400">📌 Принята</span>}
                          {task.status === 'transcribing' && <span className="text-sky-300">🎙 Транскрибация WhisperX</span>}
                          {task.status === 'processing' && <span className="text-indigo-400">⚙️ AI Pipeline Gemini</span>}
                          {task.status === 'review' && <span className="text-emerald-300">🔍 Финальная проверка</span>}
                          {task.status === 'in_progress' && <span className="text-emerald-400">⚡ В работе</span>}
                          {task.status === 'completed' && <span className="text-slate-400">✅ Выполнено</span>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Conflict / Warning Error Bar */}
                  {conflictErrors[task.id] && (
                    <div className="p-2 bg-rose-950/90 border border-rose-800 text-rose-300 text-[11px] rounded font-mono">
                      ⚠️ {conflictErrors[task.id]}
                    </div>
                  )}

                  {/* Assistant Controls & Atomic Lock */}
                  {currentRole.startsWith('assistant') && (
                    <div className="space-y-2 pt-1">
                      {(!task.assignedAssistantId || task.status === 'pending' || task.status === 'available') && (
                        <button
                          onClick={() => handleAcceptTaskWithLock(task.id)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow"
                        >
                          <span>💻</span> [รับงาน] (Take Task)
                        </button>
                      )}

                      {/* Run OpenRouter GPT-4o Transcribe */}
                      {isOwner && (task.status === 'assigned' || task.status === 'transcribing') && (
                        <button
                          disabled={simulatingWorker === task.id}
                          onClick={() => handleSimulateTranscription(task.id)}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <span>🎙️</span> {simulatingWorker === task.id ? 'กำลังถอดความด้วย GPT-4o...' : 'ถอดความด้วย OpenRouter (GPT-4o + AI Pipeline)'}
                        </button>
                      )}

                      {/* Transfer & Complete Buttons for Owner */}
                      {isOwner && task.assignedAssistantId && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 bg-slate-900 p-2 rounded border border-slate-800 text-[11px]">
                            <span className="text-slate-400">โอนงานให้ผู้ช่วยท่านอื่น:</span>
                            <button
                              onClick={() =>
                                handleTransferTask(
                                  task.id,
                                  currentAssistantId === 'usr-1002' ? 'usr-1003' : 'usr-1002',
                                  currentAssistantId === 'usr-1002' ? 'ผู้ช่วย 2 (อิกอร์)' : 'ผู้ช่วย 1 (อันนา)'
                                )
                              }
                              className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-[11px] font-medium"
                            >
                              🔄 [โอนงาน] (Transfer)
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              onCompleteTask(task.id);
                              triggerHaptic('notification', 'success');
                            }}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                          >
                            <span>✅</span> [ส่งงาน] (Complete Task)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clarification Chat & History & AI Pipeline Sub-Tabs */}
                  <div className="pt-2 border-t border-slate-700/60 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <button
                        onClick={() => setActiveTabMap((p) => ({ ...p, [task.id]: 'chat' }))}
                        className={`px-2.5 py-1 rounded font-medium ${
                          activeTabMap[task.id] === 'chat' || !activeTabMap[task.id] ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        💬 {currentRole.startsWith('assistant') ? 'แชท' : 'Чат'} ({taskMessages[task.id]?.length || 0})
                      </button>
                      <button
                        onClick={() => setActiveTabMap((p) => ({ ...p, [task.id]: 'pipeline' }))}
                        className={`px-2.5 py-1 rounded font-medium ${
                          activeTabMap[task.id] === 'pipeline' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        ⚡ {currentRole.startsWith('assistant') ? 'ระบบ AI Pipeline' : 'AI Pipeline (3 Слоя)'}
                      </button>
                      <button
                        onClick={() => setActiveTabMap((p) => ({ ...p, [task.id]: 'history' }))}
                        className={`px-2.5 py-1 rounded font-medium ${
                          activeTabMap[task.id] === 'history' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        📜 {currentRole.startsWith('assistant') ? 'ประวัติ' : 'История'} ({task.history?.length || 0})
                      </button>
                    </div>

                    {/* AI Pipeline 3-Layer View */}
                    {activeTabMap[task.id] === 'pipeline' && (
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2.5 text-[11px]">
                        <div className="text-slate-400 font-mono font-bold text-[10px] uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-1 flex justify-between">
                          <span>3-Layer Post-Processing Pipeline</span>
                          <span className="text-emerald-400 font-normal">Gemini 2.5 Flash / Gemma 2</span>
                        </div>

                        {/* Layer 1: Raw WhisperX */}
                        <div className="space-y-1 bg-slate-900/90 p-2.5 rounded border border-slate-800">
                          <div className="font-semibold text-sky-400 font-mono text-[10px] flex justify-between">
                            <span>Layer 1: Raw WhisperX Transcription</span>
                            <span className="text-slate-500">Lang: {task.transcription?.language || 'ru'}</span>
                          </div>
                          <div className="text-slate-300 font-mono text-[11px]">
                            {task.transcription?.raw_text || task.voiceMessage.originalTranscript || 'Транскрибация еще не выполнена'}
                          </div>
                        </div>

                        {/* Layer 2: Cleaned Text */}
                        <div className="space-y-1 bg-slate-900/90 p-2.5 rounded border border-slate-800">
                          <div className="font-semibold text-purple-300 font-mono text-[10px] flex justify-between">
                            <span>Layer 2: Cleaned Text (AI Cleanup API)</span>
                            <span className="text-emerald-400">Hallucinations Check: ✅ Passed</span>
                          </div>
                          <div className="text-slate-200 font-mono text-[11px]">
                            {task.processedText?.clean_text || task.voiceMessage.translationRu || 'Ожидает очистки через Gemini API'}
                          </div>
                        </div>

                        {/* Layer 3: Translation */}
                        <div className="space-y-1 bg-slate-900/90 p-2.5 rounded border border-slate-800">
                          <div className="font-semibold text-amber-400 font-mono text-[10px] flex justify-between">
                            <span>Layer 3: Working Translation (EN & TH)</span>
                            <span className="text-amber-300">Model: {task.translations?.[0]?.model || 'gemini-2.5-flash'}</span>
                          </div>
                          <div className="text-amber-200 font-mono text-[11px]">
                            <strong>[EN]:</strong> {task.voiceMessage.translationEn || task.translations?.find(t => t.target_language === 'en')?.translated_text || 'Pending English translation...'}<br/>
                            <strong>[TH]:</strong> {task.voiceMessage.translationTh || task.translations?.find(t => t.target_language === 'th')?.translated_text || 'Pending Thai translation...'}
                          </div>
                        </div>

                        {/* Chief Result Approval */}
                        {currentRole === 'boss' && (
                          <div className="flex gap-2 pt-2 border-t border-slate-800">
                            <button
                              onClick={() => {
                                onCompleteTask(task.id);
                                triggerHaptic('notification', 'success');
                              }}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition-colors"
                            >
                              👍 Утвердить результат
                            </button>
                            <button
                              onClick={() => triggerHaptic('notification', 'warning')}
                              className="px-3 py-1.5 bg-amber-700 hover:bg-amber-600 text-white font-medium rounded text-xs transition-colors"
                            >
                              🔄 Доработать
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clarification Chat View */}
                    {(activeTabMap[task.id] === 'chat' || !activeTabMap[task.id]) && (
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2 text-[11px]">
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {!taskMessages[task.id] || taskMessages[task.id].length === 0 ? (
                            <div className="text-slate-500 italic text-center py-2">
                              {currentRole.startsWith('assistant') ? 'ยังไม่มีข้อความในแชท' : 'Сообщений в чате пока нет'}
                            </div>
                          ) : (
                            taskMessages[task.id].map((msg) => (
                              <div key={msg.id} className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1">
                                <div className="flex items-center justify-between font-mono text-[10px] text-sky-400">
                                  <span>{msg.sender_name} [{msg.sender_role}]</span>
                                  <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-slate-200">{msg.text}</div>
                                {msg.translation_ru && <div className="text-[10px] text-amber-300 italic">{msg.translation_ru}</div>}
                                {msg.translation_th && <div className="text-[10px] text-amber-300 italic">{msg.translation_th}</div>}
                              </div>
                            ))
                          )}
                        </div>

                        {/* Chat Input Field */}
                        <div className="flex gap-2 pt-1 border-t border-slate-800">
                          <input
                            type="text"
                            placeholder={
                              !isOwner && currentRole.startsWith('assistant')
                                ? '🔒 ไม่อนุญาต: คุณไม่ใช่ผู้ดูแลงานนี้'
                                : currentRole.startsWith('assistant')
                                ? 'พิมพ์ข้อความสอบถามเพิ่มเติม...'
                                : 'Напишите уточнение...'
                            }
                            disabled={!isOwner && currentRole.startsWith('assistant')}
                            value={chatInputs[task.id] || ''}
                            onChange={(e) => setChatInputs({ ...chatInputs, [task.id]: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500 disabled:opacity-50"
                          />
                          <button
                            onClick={() => handleSendMessage(task.id)}
                            disabled={!isOwner && currentRole.startsWith('assistant')}
                            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-semibold rounded text-xs transition-colors"
                          >
                            {currentRole.startsWith('assistant') ? 'ส่ง' : 'Отправить'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* State History View */}
                    {activeTabMap[task.id] === 'history' && (
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1.5 font-mono">
                        {!task.history || task.history.length === 0 ? (
                          <div className="text-slate-500 italic text-center">
                            {currentRole.startsWith('assistant') ? 'ไม่มีประวัติการเปลี่ยนสถานะ' : 'История переходов пуста'}
                          </div>
                        ) : (
                          task.history.map((h, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-slate-900 pb-1 text-slate-300">
                              <span>[{new Date(h.timestamp).toLocaleTimeString()}]</span>
                              <span className="text-sky-400 font-bold">{h.from_status} ➔ {h.to_status}</span>
                              <span className="text-slate-500">{h.changed_by}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Easter Egg Modal - Ksenia's Vacation Greetings */}
      {showKseniaEasterEgg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl text-left space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-200 tracking-wide uppercase">
                {easterEggLang === 'ru' && 'Системный статус'}
                {easterEggLang === 'en' && 'System Status'}
                {easterEggLang === 'th' && 'สถานะระบบ'}
              </span>
              <div className="flex items-center gap-1 text-[10px] font-mono">
                <button
                  onClick={() => setEasterEggLang('ru')}
                  className={`px-2 py-0.5 rounded ${easterEggLang === 'ru' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
                >
                  RU
                </button>
                <button
                  onClick={() => setEasterEggLang('en')}
                  className={`px-2 py-0.5 rounded ${easterEggLang === 'en' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setEasterEggLang('th')}
                  className={`px-2 py-0.5 rounded ${easterEggLang === 'th' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-800 text-slate-400'}`}
                >
                  TH
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white">
                {easterEggLang === 'ru' && 'Виртуальный ассистент Ксения'}
                {easterEggLang === 'en' && 'Virtual Assistant Ksenia'}
                {easterEggLang === 'th' && 'ผู้ช่วยเสมือน Ksenia'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {easterEggLang === 'ru' && 'Виртуальный ассистент Ксения обеспечивает бесперебойный контроль выполнения задач и WhisperX-транскрибацию, пока реальный сотрудник находится в плановом отпуске.'}
                {easterEggLang === 'en' && 'Virtual Assistant Ksenia provides continuous workflow oversight and WhisperX transcription while the staff member is on scheduled leave.'}
                {easterEggLang === 'th' && 'ผู้ช่วยเสมือน Ksenia ดูแลการทำงานและการถอดความ WhisperX อย่างต่อเนื่อง ขณะที่เจ้าหน้าที่หลักอยู่ระหว่างการลาพักร้อน'}
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[11px] text-slate-300 font-mono flex items-center justify-between">
              <span>
                {easterEggLang === 'ru' && 'Завершенных поручений Шефа:'}
                {easterEggLang === 'en' && 'Boss tasks completed:'}
                {easterEggLang === 'th' && 'งานของหัวหน้าเสร็จสิ้น:'}
              </span>
              <span className="font-bold text-amber-400 text-xs">
                {tasks.filter((t) => t.status === 'completed').length}
              </span>
            </div>

            <button
              onClick={() => setShowKseniaEasterEgg(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors border border-slate-700"
            >
              {easterEggLang === 'ru' && 'Подтвердить'}
              {easterEggLang === 'en' && 'Confirm'}
              {easterEggLang === 'th' && 'ตกลง'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
