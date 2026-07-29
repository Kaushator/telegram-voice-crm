import React, { useState, useEffect } from 'react';
import { LogEntry, UserRole } from '../types';
import { UserManagement } from './UserManagement';
import { SystemAiAdminControl } from './SystemAiAdminControl';

interface AdminLogsDashboardProps {
  logs: LogEntry[];
  onRefreshLogs: () => void;
  onDownloadLogs: () => void;
  onSwitchToCrm?: () => void;
  currentUser?: any;
  onRoleChanged?: (role: UserRole) => void;
}

export const AdminLogsDashboard: React.FC<AdminLogsDashboardProps> = ({
  logs,
  onRefreshLogs,
  onDownloadLogs,
  onSwitchToCrm,
  currentUser,
  onRoleChanged,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Banner with Switch to CRM Button */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-950/80 border border-amber-800/60 rounded-lg text-amber-400 text-lg">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Панель Администратора</h1>
              <span className="bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                Admin Mode
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Управление пользователями, системные параметры, логи сервера и настройки воркеров
            </p>
          </div>
        </div>

        {onSwitchToCrm && (
          <button
            id="switch-to-crm-btn"
            onClick={onSwitchToCrm}
            className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2 border border-amber-500/40 active:scale-95 shrink-0"
          >
            <span>📊</span>
            <span>Переключить в режим CRM / Задач</span>
          </button>
        )}
      </div>

      {/* User Management Section */}
      <UserManagement currentUser={currentUser} onRoleChanged={onRoleChanged} />

      {/* System AI Admin Control */}
      <SystemAiAdminControl />

      {/* Logs Table Section */}

      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl text-slate-100 overflow-hidden shadow-2xl relative">
        {/* Ambient background light */}
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-slate-950/60 backdrop-blur-md px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <h2 className="text-base font-bold text-white font-serif-luxury tracking-wide">Панель Администратора: Логи и Транскрибация</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Сохранение событий в текстовые файлы сервера и синхронизация в реальном времени
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
