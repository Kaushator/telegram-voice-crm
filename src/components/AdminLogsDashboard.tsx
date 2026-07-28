import React, { useState, useEffect } from 'react';
import { LogEntry } from '../types';
import { MacDeploymentGuide } from './MacDeploymentGuide';
import { MacWorkerConfigurator } from './MacWorkerConfigurator';

interface AdminLogsDashboardProps {
  logs: LogEntry[];
  onRefreshLogs: () => void;
  onDownloadLogs: () => void;
}

export const AdminLogsDashboard: React.FC<AdminLogsDashboardProps> = ({
  logs,
  onRefreshLogs,
  onDownloadLogs,
}) => {
  const [asst1Name, setAsst1Name] = useState('Ассистент 1 (Анна)');
  const [asst1ChatId, setAsst1ChatId] = useState('@anna_asst');
  const [asst1WorkerUrl, setAsst1WorkerUrl] = useState('http://localhost:8000');

  const [asst2Name, setAsst2Name] = useState('Ассистент 2 (Игорь)');
  const [asst2ChatId, setAsst2ChatId] = useState('@igor_asst');
  const [asst2WorkerUrl, setAsst2WorkerUrl] = useState('http://localhost:8001');

  const [slotsInfo, setSlotsInfo] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState('');

  const fetchSettings = () => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          if (data.settings.assistant1) {
            setAsst1Name(data.settings.assistant1.name || 'Ассистент 1 (Анна)');
            setAsst1ChatId(data.settings.assistant1.chatId || '@anna_asst');
            setAsst1WorkerUrl(data.settings.assistant1.workerUrl || 'http://localhost:8000');
          }
          if (data.settings.assistant2) {
            setAsst2Name(data.settings.assistant2.name || 'Ассистент 2 (Игорь)');
            setAsst2ChatId(data.settings.assistant2.chatId || '@igor_asst');
            setAsst2WorkerUrl(data.settings.assistant2.workerUrl || 'http://localhost:8001');
          }
        }
        if (data.slots) {
          setSlotsInfo(data.slots);
        }
      })
      .catch((err) => console.error('Error fetching settings', err));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant1: { name: asst1Name, chatId: asst1ChatId, workerUrl: asst1WorkerUrl },
          assistant2: { name: asst2Name, chatId: asst2ChatId, workerUrl: asst2WorkerUrl },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus('Настройки успешно сохранены');
        setTimeout(() => setSaveStatus(''), 3000);
        fetchSettings();
        onRefreshLogs();
      }
    } catch (err) {
      console.error('Error saving settings', err);
      setSaveStatus('Ошибка при сохранении настроек');
    }
  };

  const handleResetSlot = async (slotNumber: number) => {
    try {
      const res = await fetch('/api/slots/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slotNumber }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus(`Слот ${slotNumber} успешно сброшен`);
        setTimeout(() => setSaveStatus(''), 3000);
        fetchSettings();
        onRefreshLogs();
      }
    } catch (err) {
      console.error('Error resetting slot', err);
      setSaveStatus(`Ошибка при сбросе слота ${slotNumber}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mac Worker Configurator & File Generator */}
      <MacWorkerConfigurator />


      {/* Deployment Guide for Employee MacBooks */}
      <MacDeploymentGuide />

      {/* Settings & Slot Management Section */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 text-slate-100 p-4 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Управление Слотами и Настройки Ассистентов (MacBook M3)</h2>
            <p className="text-[11px] text-slate-400">
              Лимит 2 слотов. Администратор может изменять параметры или принудительно сбросить слот для привязки нового устройство.
            </p>
          </div>
          <button
            id="save-settings-btn"
            onClick={handleSaveSettings}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded transition-colors"
          >
            Сохранить настройки
          </button>
        </div>

        {saveStatus && (
          <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 p-2 rounded border border-emerald-800">
            {saveStatus}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Assistant 1 Config & Slot Management */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div className="font-semibold text-sky-400">
                Слот 1: {slotsInfo?.assistant1 ? 'Занят' : 'Свободен'}
              </div>
              <button
                id="reset-slot-1-btn"
                onClick={() => handleResetSlot(1)}
                className="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 text-white text-[10px] rounded font-medium transition-colors"
              >
                Сбросить слот 1
              </button>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Имя Ассистента 1</label>
              <input
                type="text"
                value={asst1Name}
                onChange={(e) => setAsst1Name(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Telegram Chat ID / Username</label>
              <input
                type="text"
                value={asst1ChatId}
                onChange={(e) => setAsst1ChatId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                URL локального воркера / Cloudflare Tunnel
              </label>
              <input
                type="text"
                value={asst1WorkerUrl}
                onChange={(e) => setAsst1WorkerUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Assistant 2 Config & Slot Management */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div className="font-semibold text-sky-400">
                Слот 2: {slotsInfo?.assistant2 ? 'Занят' : 'Свободен'}
              </div>
              <button
                id="reset-slot-2-btn"
                onClick={() => handleResetSlot(2)}
                className="px-2 py-0.5 bg-rose-700 hover:bg-rose-600 text-white text-[10px] rounded font-medium transition-colors"
              >
                Сбросить слот 2
              </button>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Имя Ассистента 2</label>
              <input
                type="text"
                value={asst2Name}
                onChange={(e) => setAsst2Name(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Telegram Chat ID / Username</label>
              <input
                type="text"
                value={asst2ChatId}
                onChange={(e) => setAsst2ChatId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                URL локального воркера / Cloudflare Tunnel
              </label>
              <input
                type="text"
                value={asst2WorkerUrl}
                onChange={(e) => setAsst2WorkerUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table Section */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 text-slate-100 overflow-hidden shadow-lg">
        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Панель Администратора: Логи и Транскрибация</h2>
            <p className="text-[11px] text-slate-400">
              Сохранение событий в текстовые файлы сервера и синхронизация реального времени
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="refresh-logs-btn"
              onClick={onRefreshLogs}
              className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors"
            >
              Обновить
            </button>
            <button
              id="download-logs-btn"
              onClick={onDownloadLogs}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-xs transition-colors flex items-center gap-1.5"
            >
              <span>📄</span>
              Скачать .txt лог сервера
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <span>Путь файла логов на сервере: <code className="text-indigo-400 font-mono">/logs/system.log</code></span>
            <span className="text-emerald-400 font-mono">● Запись в реальном времени</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-md">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Время</th>
                  <th className="py-2.5 px-3">Тип</th>
                  <th className="py-2.5 px-3">Роль</th>
                  <th className="py-2.5 px-3">Событие</th>
                  <th className="py-2.5 px-3">Оригинальная транскрипция</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-sans">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                      События пока не зафиксированы. Отправьте голосовое сообщение в симуляторе.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            log.level === 'AUDIO'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              : log.level === 'TASK'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {log.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-200">
                        {log.role}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {log.message}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 italic max-w-xs truncate">
                        {log.originalTranscript || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
