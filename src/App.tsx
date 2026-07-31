import { useState, useEffect } from 'react';
import { UserRole, Task, LogEntry, TaskMessage } from './types';
import { RoleSelector } from './components/RoleSelector';
import { TelegramSimulator } from './components/TelegramSimulator';
import { AdminLogsDashboard } from './components/AdminLogsDashboard';
import { FirstRunOnboardingWizard } from './components/FirstRunOnboardingWizard';
import { initTelegramWebApp } from './utils/telegramSdk';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telegram'>('telegram');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskMessages, setTaskMessages] = useState<Record<string, TaskMessage[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // loading dots for splash screen
  const [dots, setDots] = useState('.');
  useEffect(() => {
    if (isInitializing) {
      const interval = setInterval(() => setDots(p => p.length >= 3 ? '.' : p + '.'), 400);
      return () => clearInterval(interval);
    }
  }, [isInitializing]);

  const checkOnboarding = async () => {
    try {
      const res = await fetch('/api/system/onboarding-status');
      const data = await res.json();
      if (data && data.needsOnboarding) {
        setNeedsOnboarding(true);
        setIsOnboardingOpen(true);
      } else {
        setNeedsOnboarding(false);
      }
    } catch (err) {
      console.error('Error checking onboarding status', err);
    }
  };

  const fetchTasks = async () => {
    if (activeTab !== 'telegram') return;
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
      if (data.taskMessages) {
        const grouped: Record<string, TaskMessage[]> = {};
        data.taskMessages.forEach((m: TaskMessage) => {
          if (!grouped[m.task_id]) grouped[m.task_id] = [];
          grouped[m.task_id].push(m);
        });
        setTaskMessages(grouped);
      }
    } catch (err) {
      console.error('Error fetching tasks', err);
    }
  };

  const fetchLogs = async () => {
    if (activeTab !== 'dashboard') return;
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs', err);
    }
  };

  const isAdminHost = () => {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    const adminHostname = (import.meta as any).env?.VITE_ADMIN_HOSTNAME || 'crm.happyhouse420.com';
    const params = new URLSearchParams(window.location.search);
    const hasAdminQuery = params.get('admin') === 'true' || window.location.hash === '#admin';
    return hostname === adminHostname || hasAdminQuery;
  };

  const isDevMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('dev') === 'true' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const authenticate = async () => {
    try {
      if (isAdminHost()) {
        console.log('Detected Admin Host environment');
        setCurrentRole('admin');
        setActiveTab('dashboard');
        setCurrentUser({ id: 'usr-admin', telegram_id: '1000', first_name: 'Администратор' });
        return;
      }

      const tg = typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp : null;
      const tgInitData = tg?.initData || '';
      
      if (tg && tgInitData) {
        console.log('Telegram.WebApp present');
        console.log('initData present');
        console.log('initData length', tgInitData.length);

        const res = await fetch('/api/auth/me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData,
          },
          body: JSON.stringify({ initData: tgInitData }),
        });

        console.log('/api/auth/me HTTP status', res.status);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.role) {
            console.log('returned role', data.role);
            console.log('returned user id', data.user?.id);

            setCurrentUser(data.user);
            const rawRole = data.role; // 'boss' | 'assistant' | 'pending' | 'kicked'
            setCurrentRole(rawRole);
            setActiveTab('telegram');
          } else {
            setHasError(true);
            setErrorMessage('Не удалось получить роль пользователя');
          }
        } else {
          setHasError(true);
          setErrorMessage('Ошибка авторизации в Telegram Mini App');
        }
      } else {
        // Not in Telegram Mini App and not on Admin Host
        if (isDevMode) {
          // Allow dev simulator fallback
          setCurrentRole('boss');
          setActiveTab('telegram');
          setCurrentUser({ id: 'usr-1001', telegram_id: '1001', first_name: 'Шеф (Dev)' });
        } else {
          setCurrentRole(null);
          setHasError(true);
          setErrorMessage('This application must be opened from Telegram');
        }
      }
    } catch (err: any) {
      console.error('Splash auth check failed', err);
      setHasError(true);
      setErrorMessage(err?.message || 'Ошибка авторизации');
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    const initializeApp = async () => {
      try {
        const checkTgInitData = () => {
          return new Promise<boolean>((resolve) => {
            const tg = typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp : null;
            if (!tg) {
              resolve(false);
              return;
            }
            if (typeof tg.ready === 'function') tg.ready();
            if (typeof tg.expand === 'function') tg.expand();

            if (tg.initData) {
              resolve(true);
              return;
            }

            // Retry up to 2 seconds (20 attempts of 100ms)
            let attempts = 0;
            const interval = setInterval(() => {
              attempts++;
              if (tg.initData) {
                clearInterval(interval);
                resolve(true);
              } else if (attempts >= 20) {
                clearInterval(interval);
                resolve(false);
              }
            }, 100);
          });
        };

        await checkTgInitData();
        await authenticate();
        if (isSubscribed) {
          await checkOnboarding();
        }
      } catch (err: any) {
        console.error('Fatal initialization error:', err);
        if (isSubscribed) {
          setHasError(true);
          setErrorMessage(err?.message || 'Ошибка загрузки системы');
        }
      } finally {
        if (isSubscribed) {
          setTimeout(() => {
            if (isSubscribed) {
              setIsInitializing(false);
            }
          }, 800);
        }
      }
    };

    initializeApp();

    return () => {
      isSubscribed = false;
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentRole === 'pending') {
      interval = setInterval(() => {
        authenticate();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [currentRole]);

  useEffect(() => {
    if (isInitializing) return;
    
    // Initial fetch when tab changes
    fetchTasks();
    fetchLogs();
    
    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeTab, isInitializing]);

  const handleSendVoiceMessage = async (title: string, durationSec: number) => {
    try {
      const formData = new FormData();
      formData.append('bossId', '1001');
      formData.append('title', title);
      formData.append('duration', durationSec.toString());

      await fetch('/api/tasks', {
        method: 'POST',
        body: formData,
      });

      fetchTasks();
      fetchLogs();
    } catch (err) {
      console.error('Error sending voice task', err);
    }
  };

  const handleTakeTask = async (taskId: string, assistantId: string, assistantName: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, assistantName }),
      });

      fetchTasks();
      fetchLogs();
    } catch (err) {
      console.error('Error taking task', err);
    }
  };

  const handleAskQuestion = async (
    taskId: string,
    assistantId: string,
    assistantName: string,
    questionTh: string
  ) => {
    try {
      await fetch(`/api/tasks/${taskId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, assistantName, questionTh }),
      });

      fetchTasks();
      fetchLogs();
    } catch (err) {
      console.error('Error asking question', err);
    }
  };

  const handleReplyQuestion = async (taskId: string, questionId: string, replyRu: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, replyRu }),
      });

      fetchTasks();
      fetchLogs();
    } catch (err) {
      console.error('Error replying to question', err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      fetchTasks();
      fetchLogs();
    } catch (err) {
      console.error('Error completing task', err);
    }
  };

  const handleDownloadLogs = () => {
    window.open('/api/logs/download', '_blank');
  };

  if (hasError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl">
            ⚠️
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-widest font-serif">GARDENS OF EDEN CRM</h1>
            <p className="text-sm text-slate-300 font-medium">
              Произошла ошибка загрузки
            </p>
            {errorMessage && (
              <p className="text-xs text-slate-400 font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800 break-words w-full">
                {errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all border border-amber-500/40 active:scale-95"
          >
            Перезапустить
          </button>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div 
        className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10, 14, 23, 0.88), rgba(10, 14, 23, 0.96)), url('/eden_bg.jpg')`,
          backgroundColor: '#0a0e17'
        }}
      >
        {/* Ambient CSS glow background elements */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center space-y-6 animate-fade-in">
          {/* Animated Badge / Icon */}
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-sky-500/20 to-emerald-500/20 border border-white/10 shadow-2xl backdrop-blur-md">
            <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-ping opacity-30" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg">
              🎙️
            </div>
          </div>

          {/* Brand Title */}
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-white drop-shadow-lg" style={{ fontFamily: 'serif' }}>
              GARDENS OF EDEN
            </h1>
            <p className="text-xs sm:text-sm tracking-widest text-emerald-300 font-medium font-serif italic">
              Luxury of Nature / Voice CRM
            </p>
          </div>

          {/* Mandatory Splash Text */}
          <div className="py-2.5 px-5 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-inner flex items-center space-x-2.5 backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-medium text-slate-200 font-mono">
              Инициализация авторизации{dots}
            </span>
          </div>

          {/* Loading Progress Bar Animation */}
          <div className="w-48 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-white/5 relative shadow-inner">
            <div className="h-full bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400 animate-pulse w-full transform origin-left transition-all duration-1000" />
          </div>
        </div>
      </div>
    );
  }

  const tg = typeof window !== 'undefined' ? window?.Telegram?.WebApp : null;
  const inTelegram = !!(tg?.initData);
  
  if (currentRole === 'pending') {
    return (
      <div 
        className="fixed inset-0 z-50 flex flex-col items-center justify-center text-white overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(10, 14, 23, 0.88), rgba(10, 14, 23, 0.96)), url('/eden_bg.jpg')`,
          backgroundColor: '#0a0e17'
        }}
      >
        {/* Ambient CSS glow background elements */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center space-y-8 animate-fade-in">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-white drop-shadow-lg" style={{ fontFamily: 'serif' }}>
              GARDENS OF EDEN
            </h1>
            <p className="text-sm tracking-widest text-emerald-300 font-medium font-serif italic">
              Luxury of Nature / Voice CRM
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/20 shadow-2xl backdrop-blur-md flex flex-col items-center space-y-4 w-full">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Доступ на рассмотрении</h2>
              <p className="text-sm text-slate-300">
                Ваш аккаунт зарегистрирован. Ожидайте подтверждения доступа администратором.
              </p>
            </div>

            {currentUser && (
              <div className="w-full bg-slate-950/50 rounded-lg p-3 text-left border border-slate-800/50 space-y-1">
                <div className="text-[10px] text-slate-500 font-mono uppercase">Ваши данные Telegram</div>
                <div className="text-sm font-medium text-slate-200">{currentUser.first_name || currentUser.name || 'Без имени'}</div>
                <div className="text-xs font-mono text-slate-400">ID: {currentUser.telegram_id || currentUser.id || '---'}</div>
              </div>
            )}

            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-2 relative">
               <div className="absolute inset-0 bg-emerald-500/50 w-1/3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ animation: 'shimmer 2s infinite linear' }} />
            </div>
          </div>
          
          <button
            onClick={authenticate}
            className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 border border-emerald-400/30 active:scale-95 flex items-center gap-2"
          >
            <span>🔄</span>
            <span>Проверить статус доступа</span>
          </button>
        </div>
        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    );
  }

  if (currentRole === null || currentRole === 'kicked') {
    return (
      <div className="min-h-screen text-slate-100 flex flex-col items-center justify-center font-sans bg-slate-950">
        <div className="max-w-md p-6 bg-slate-900 border border-red-500/20 rounded-2xl shadow-xl text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-sm text-slate-400">
            You do not have permission to access this application. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-amber-600 selection:text-white relative bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.92)), url('/eden_bg.jpg')`
      }}
    >
      {isDevMode && (
        <RoleSelector
          currentRole={currentRole}
          onSelectRole={(r) => {
            setCurrentRole(r);
            if (r === 'admin') {
              setActiveTab('dashboard');
              setCurrentUser({ id: 'usr-admin', telegram_id: '1000', first_name: 'Администратор' });
            } else {
              setActiveTab('telegram');
              if (r === 'boss') {
                setCurrentUser({ id: 'usr-1001', telegram_id: '1001', first_name: 'Шеф' });
              } else if (r === 'assistant_1') {
                setCurrentUser({
                  id: 'usr-1002',
                  telegram_id: '1002',
                  first_name: 'Анна',
                  assistantProfile: { id: 'prof-1002', displayName: 'Ассистент 1 (Анна)' }
                });
              } else if (r === 'assistant_2') {
                setCurrentUser({
                  id: 'usr-1003',
                  telegram_id: '1003',
                  first_name: 'Игорь',
                  assistantProfile: { id: 'prof-1003', displayName: 'Ассистент 2 (Игорь)' }
                });
              }
            }
          }}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'telegram' && (
          <TelegramSimulator
            currentRole={currentRole}
            currentUser={currentUser}
            tasks={tasks}
            taskMessages={taskMessages}
            onSendVoiceMessage={handleSendVoiceMessage}
            onTakeTask={handleTakeTask}
            onAskQuestion={handleAskQuestion}
            onReplyQuestion={handleReplyQuestion}
            onCompleteTask={handleCompleteTask}
            onRefreshAll={() => {
              fetchTasks();
              fetchLogs();
            }}
            onSwitchToAdmin={isDevMode ? () => setActiveTab('dashboard') : undefined}
          />
        )}

        {activeTab === 'dashboard' && currentRole === 'admin' && (
          <AdminLogsDashboard
            logs={logs}
            onRefreshLogs={fetchLogs}
            onDownloadLogs={handleDownloadLogs}
            onSwitchToCrm={isDevMode ? () => setActiveTab('telegram') : undefined}
            currentUser={currentUser}
            onRoleChanged={(r) => {
              setCurrentRole(r);
              if (r !== 'admin') setActiveTab('telegram');
            }}
          />
        )}
      </main>

      <FirstRunOnboardingWizard
        isOpen={isOnboardingOpen}
        isInitialBlocker={needsOnboarding}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={() => {
          setIsOnboardingOpen(false);
          setNeedsOnboarding(false);
          fetchTasks();
          fetchLogs();
        }}
      />
    </div>
  );
}