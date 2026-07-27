import React from 'react';
import { UserRole } from '../types';

interface RoleSelectorProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeTab: 'dashboard' | 'telegram' | 'docker';
  onSelectTab: (tab: 'dashboard' | 'telegram' | 'docker') => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  currentRole,
  onSelectRole,
  activeTab,
  onSelectTab,
}) => {
  const roles: { role: UserRole; title: string; subtitle: string; desc: string }[] = [
    {
      role: 'boss',
      title: 'Шеф (Руководитель)',
      subtitle: 'Отправка голосовых задач',
      desc: 'Запись аудиосообщений, отслеживание статуса в реальном времени',
    },
    {
      role: 'assistant_1',
      title: 'Ассистент 1 (Анна)',
      subtitle: 'Обработка задач #1',
      desc: 'Подтверждение активности MacBook, запуск WhisperX, прием задач',
    },
    {
      role: 'assistant_2',
      title: 'Ассистент 2 (Игорь)',
      subtitle: 'Обработка задач #2',
      desc: 'Подтверждение активности MacBook, запуск WhisperX, прием задач',
    },
    {
      role: 'admin',
      title: 'Администратор',
      subtitle: 'Логирование и контроль',
      desc: 'Просмотр журналов сервера, загрузка .txt файлов, оригиналы транскрибаций',
    },
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-indigo-600 flex items-center justify-center font-bold text-white tracking-wider text-sm">
              CRM
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">
                Telegram Voice CRM & WhisperX Processing
              </h1>
              <p className="text-xs text-slate-400">
                Автоматический перевод и транскрибация для распределенной команды
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center bg-slate-800 p-1 rounded-md text-xs font-medium border border-slate-700">
            <button
              id="tab-dashboard-btn"
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Рабочий стол
            </button>
            <button
              id="tab-telegram-btn"
              onClick={() => onSelectTab('telegram')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === 'telegram'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Симулятор Telegram Бота
            </button>
            <button
              id="tab-docker-btn"
              onClick={() => onSelectTab('docker')}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeTab === 'docker'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Контейнер MacBook (WhisperX)
            </button>
          </div>
        </div>

        {/* Role Selector Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {roles.map((r) => {
            const isSelected = currentRole === r.role;
            return (
              <button
                key={r.role}
                id={`role-btn-${r.role}`}
                onClick={() => onSelectRole(r.role)}
                className={`text-left p-3 rounded-md border transition-all text-xs ${
                  isSelected
                    ? 'bg-slate-800 border-indigo-500 ring-1 ring-indigo-500'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{r.title}</span>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{r.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
