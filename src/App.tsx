import { useState, useEffect } from 'react';
import { UserRole, Task, LogEntry, MacContainerState } from './types';
import { RoleSelector } from './components/RoleSelector';
import { TelegramSimulator } from './components/TelegramSimulator';
import { AdminLogsDashboard } from './components/AdminLogsDashboard';
import { MacContainerStatus } from './components/MacContainerStatus';

export default function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>('boss');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'telegram' | 'docker'>('telegram');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [containers, setContainers] = useState<Record<string, MacContainerState>>({});

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Error fetching tasks', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch (err) {
      console.error('Error fetching logs', err);
    }
  };

  const fetchContainers = async () => {
    try {
      const res = await fetch('/api/containers');
      const data = await res.json();
      if (data.containers) setContainers(data.containers);
    } catch (err) {
      console.error('Error fetching containers', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchLogs();
    fetchContainers();
    const interval = setInterval(() => {
      fetchTasks();
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    </div>
  );
}
