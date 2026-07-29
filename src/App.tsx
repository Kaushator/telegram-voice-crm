import { useState, useEffect } from 'react';
import { UserRole, Task, LogEntry, MacContainerState, TaskMessage } from './types';
import { RoleSelector } from './components/RoleSelector';
import { TelegramSimulator } from './components/TelegramSimulator';
import { AdminLogsDashboard } from './components/AdminLogsDashboard';
import { MacContainerStatus } from './components/MacContainerStatus';
import { FirstRunOnboardingWizard } from './components/FirstRunOnboardingWizard';
import { SplashScreen } from './components/SplashScreen';
import { initTelegramWebApp } from './utils/telegramSdk';

export default function App() {
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentRole, setCurrentRole] = useState<UserRole>('boss');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telegram' | 'docker'>('telegram');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskMessages, setTaskMessages] = useState<Record<string, TaskMessage[]>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containers, setContainers] = useState<Record<string, MacContainerState>>({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const handleAuthenticated = (role: UserRole, user: any) => {
    setCurrentRole(role);
    if (role === 'admin') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('telegram');
    }
    setIsAuthChecking(false);
  };

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
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (isAuthChecking) return;
    
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
  }, [activeTab, isAuthChecking]);


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

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col font-sans selection:bg-amber-600 selection:text-white relative bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.92)), url('/eden_bg.jpg')`
      }}
    >
      {isAuthChecking && (
        <SplashScreen onAuthenticated={handleAuthenticated} />
      )}

      <RoleSelector
        currentRole={currentRole}
        onSelectRole={(r) => {
          setCurrentRole(r);
          if (r === 'admin') setActiveTab('dashboard');
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

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

        {activeTab === 'dashboard' && (
          <AdminLogsDashboard
            logs={logs}
            onRefreshLogs={fetchLogs}
            onDownloadLogs={handleDownloadLogs}
          />
        )}

        {activeTab === 'docker' && (
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
