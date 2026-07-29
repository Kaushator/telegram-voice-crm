import { useState, useEffect } from 'react';
import { UserRole, Task, LogEntry, MacContainerState, TaskMessage } from './types';
import { RoleSelector } from './components/RoleSelector';
import { TelegramSimulator } from './components/TelegramSimulator';
import { AdminLogsDashboard } from './components/AdminLogsDashboard';
import { MacContainerStatus } from './components/MacContainerStatus';
import { FirstRunOnboardingWizard } from './components/FirstRunOnboardingWizard';
import { initTelegramWebApp } from './utils/telegramSdk';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telegram' | 'docker'>('telegram');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskMessages, setTaskMessages] = useState<Record<string, TaskMessage[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containers, setContainers] = useState<Record<string, MacContainerState>>({});
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
      if (data.needsOnboarding) {
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

  const fetchContainers = async () => {
    if (activeTab !== 'docker') return;
    try {
      const res = await fetch('/api/containers');
      const data = await res.json();
      if (data.containers) setContainers(data.containers);
    } catch (err) {
      console.error('Error fetching containers', err);
    }
  };

  const authenticate = async () => {
    try {
      const tgInitData = window.Telegram?.WebApp?.initData || '';
      
      if (tgInitData) {
        const res = await fetch('/api/auth/me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData,
          },
          body: JSON.stringify({ initData: tgInitData }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.role) {
            let mappedRole: UserRole = 'boss';
            const rawRole = data.role;
            if (rawRole === 'admin') {
              mappedRole = 'admin';
            } else if (rawRole === 'assistant') mappedRole = 'assistant_1';
            else if (rawRole === 'chief') mappedRole = 'boss';
            else if (rawRole === 'pending') mappedRole = 'pending';
            else if (rawRole === 'kicked') mappedRole = 'kicked';
            setCurrentRole(mappedRole);
            if (mappedRole === 'admin') {
              setActiveTab('dashboard');
            } else {
              setActiveTab('telegram');
            }
          } else {
            setCurrentRole('admin');
            setActiveTab('dashboard');
          }
        } else {
          setCurrentRole('admin');
          setActiveTab('dashboard');
        }
      } else {
        // Not in telegram (browser / desktop mode) -> default to Admin Mode (dashboard)
        setCurrentRole('admin');
        setActiveTab('dashboard');
      }
    } catch (err) {
      console.error('Splash auth check failed', err);
      setCurrentRole('admin');
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    initTelegramWebApp();
    
    authenticate().finally(() => {
      setTimeout(() => {
        setIsInitializing(false);
        checkOnboarding();
      }, 1200); // Wait minimum 1.2s for splash screen
    });
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
    fetchContainers();
    
    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
      fetchContainers();
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

  if (isInitializing) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-75"
          src="/welcome.webm"
        />

        {/* Dark overlay with subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/80 to-slate-950/90 backdrop-blur-xs" />

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
              Luxury of Nature
            </p>
          </div>

          {/* Mandatory Splash Text */}
          <div className="py-2 px-4 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-inner flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-200">
              Welcome to CRM. Please wait for logging{dots}
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

  const inTelegram = !!(window.Telegram?.WebApp?.initData);
  
  if (currentRole === 'pending') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-75 opacity-70"
          src="/welcome.webm"
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950/95 backdrop-blur-sm" />

        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center space-y-8 animate-fade-in">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-white drop-shadow-lg" style={{ fontFamily: 'serif' }}>
              GARDENS OF EDEN
            </h1>
            <p className="text-sm tracking-widest text-emerald-300 font-medium font-serif italic">
              Luxury of Nature
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/80 border border-emerald-500/20 shadow-2xl backdrop-blur-md flex flex-col items-center space-y-4 w-full">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">Ожидание авторизации</h2>
              <p className="text-sm text-slate-400">
                Ваш аккаунт ожидает назначения роли администратором. Все рабочие роли сейчас заняты.
              </p>
            </div>

            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-4 relative">
               <div className="absolute inset-0 bg-emerald-500/50 w-1/3 rounded-full animate-bounce-x shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ animation: 'shimmer 2s infinite linear' }} />
            </div>
          </div>
          
          <button
            onClick={authenticate}
            className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 border border-emerald-400/30 active:scale-95"
          >
            Проверить статус
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
      {(!inTelegram || currentRole === 'admin') && (
        <RoleSelector
          currentRole={currentRole}
          onSelectRole={(r) => {
            setCurrentRole(r);
            if (r === 'admin') setActiveTab('dashboard');
            else setActiveTab('telegram');
          }}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
        />
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {activeTab === 'telegram' && (
          <TelegramSimulator
            currentRole={currentRole}
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
            onSwitchToAdmin={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && currentRole === 'admin' && (
          <AdminLogsDashboard
            logs={logs}
            onRefreshLogs={fetchLogs}
            onDownloadLogs={handleDownloadLogs}
            onSwitchToCrm={() => setActiveTab('telegram')}
          />
        )}

        {activeTab === 'docker' && currentRole === 'admin' && (
          <MacContainerStatus containers={containers} />
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