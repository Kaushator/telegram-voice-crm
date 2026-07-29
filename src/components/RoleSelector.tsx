import React from 'react';
import { UserRole } from '../types';
import { EdenLogo } from './EdenLogo';

interface RoleSelectorProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeTab: 'dashboard' | 'telegram';
  onSelectTab: (tab: 'dashboard' | 'telegram') => void;
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
      desc: 'Прием задач Шефа, перевод и контроль качества',
    },
    {
      role: 'assistant_2',
      title: 'Ассистент 2 (Игорь)',
      subtitle: 'Обработка задач #2',
      desc: 'Прием задач Шефа, перевод и контроль качества',
    },
    {
      role: 'admin',
      title: 'Администратор',
      subtitle: 'Логирование и контроль',
      desc: 'Просмотр журналов сервера, загрузка .txt файлов, оригиналы транскрибаций',
    },
  ];

  return (
    <div className="bg-slate-950/85 backdrop-blur-md border-b border-amber-900/30 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <EdenLogo variant="compact" className="shrink-0" />
            <div className="border-l border-amber-500/30 pl-3">
              <h1 className="text-sm font-semibold text-white tracking-wide">
                GARDENS OF EDEN <span className="text-amber-300 font-normal text-xs">| Voice CRM</span>
              </h1>
              <p className="text-[11px] text-amber-100/70">
                WhisperX & AI Pipeline • Luxury Voice Management
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-lg text-xs font-medium border border-amber-900/30 shadow-inner">
            <button
              id="tab-dashboard-btn"
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-amber-700/80 text-white font-semibold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Рабочий стол
            </button>
            <button
              id="tab-telegram-btn"
              onClick={() => onSelectTab('telegram')}
              className={`px-3 py-1.5 rounded transition-all ${
                activeTab === 'telegram'
                  ? 'bg-amber-700/80 text-white font-semibold shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Симулятор Telegram Бота
            </button>
          </div>
        </div>

        {/* Role Selector Grid */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {roles.map((r) => {
            const isSelected = currentRole === r.role;
            return (
              <button
                key={r.role}
                id={`role-btn-${r.role}`}
                onClick={() => onSelectRole(r.role)}
                className={`text-left p-2.5 rounded-lg border transition-all text-xs ${
                  isSelected
                    ? 'bg-amber-950/60 border-amber-500/80 ring-1 ring-amber-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-100">{r.title}</span>
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
                  )}
                </div>
                <div className="text-[10px] text-amber-200/60 mt-0.5">{r.subtitle}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

