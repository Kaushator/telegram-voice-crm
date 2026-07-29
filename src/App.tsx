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
  const [currentRole, setCurrentRole] = useState<UserRole>('boss');
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

  useEffect(() => {
    initTelegramWebApp();
    
    const authenticate = async () => {
      try {
        const tgInitData = window.Telegram?.WebApp?.initData || '';
        
        const res = await fetch('/api/auth/me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData,
          },
          body: JSON.stringify({ initData: tgInitData }),
        });

        const data = await res.json();
        let mappedRole: UserRole = 'boss';
        
        if (data && data.success) {
          const rawRole = data.role || 'chief';
          if (rawRole === 'admin') mappedRole = 'admin';
          else if (rawRole === 'assistant') mappedRole = 'assistant_1';
        }

        const inTelegram = !!tgInitData;
        const isAdminRoute = window.location.pathname === '/admin';
        
        if (inTelegram && mappedRole === 'admin') {
           mappedRole = 'boss';
        }
        
        setCurrentRole(mappedRole);

        if (mappedRole === 'admin' && isAdminRoute && !inTelegram) {
          setActiveTab('dashboard');
        } else {
          setActiveTab('telegram');
        }

      } catch (err) {
        console.error('Splash auth check failed', err);
        setCurrentRole('boss');
        setActiveTab('telegram');
      } finally {
        setTimeout(() => {
          setIsInitializing(false);
          checkOnboarding();
        }, 1200); // Wait minimum 1.2s for splash screen
      }
    };

    authenticate();
  }, []);

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
          src="/welcome.mp4"
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

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-amber-600 selection:text-white relative bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.92)), url('/eden_bg.jpg')`
      }}
    >
      {(!inTelegram && window.location.pathname === '/admin' && currentRole === 'admin') && (
        <RoleSelector
          currentRole={currentRole}
          onSelectRole={(r) => {
            setCurrentRole(r);
            if (r === 'admin') setActiveTab('dashboard');
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
          />
        )}

        {activeTab === 'dashboard' && currentRole === 'admin' && (
          <AdminLogsDashboard
            logs={logs}
            onRefreshLogs={fetchLogs}
            onDownloadLogs={handleDownloadLogs}
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