import React, { useState } from 'react';
import { triggerHaptic } from '../utils/telegramSdk';

export const TestingChecklist: React.FC = () => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const updated = { ...prev, [id]: !prev[id] };
      triggerHaptic('selection');
      return updated;
    });
  };

  const sections = [
    {
      title: '1. Авторизация и роли (Mock InitData)',
      items: [
        { id: 'auth_chief', label: 'Вход под Шефом: Кнопка записи голоса, лента задач, скрыта админ-панель' },
        { id: 'auth_assistant_setup', label: 'Первичный вход Ассистента: Окно ввода display_name и сохранение в профиль' },
        { id: 'auth_admin_tab', label: 'Вход под Админом: Появление вкладки «Администрирование» в навигации' },
        { id: 'auth_theme_switch', label: 'Переключение тем: Использование CSS var(--tg-theme-*)' }
      ]
    },
    {
      title: '2. Создание и передача задач (UI Flow)',
      items: [
        { id: 'flow_multi_part_voice', label: 'Запись нескольких аудио: Аудиочасть 1 ➔ «Добавить голос» ➔ Аудиочасть 2 ➔ «Завершить» (статус available)' },
        { id: 'flow_atomic_lock', label: 'Атомарный захват задачи: Нажатие [รับงาน] переводит задачу в «Мои задачи»' },
        { id: 'flow_readonly_check', label: 'Проверка Read-Only режима: У Ассистента 2 кнопка блокируется, статус "В работе у Ассистента 1"' },
        { id: 'flow_transfer_task', label: 'Передача задачи: Ассистент 1 передает задачу Ассистенту 2 ➔ Включение Read-Only у Ассистента 1' }
      ]
    },
    {
      title: '3. Чат и аудиоплеер',
      items: [
        { id: 'chat_player_speed', label: 'Аудиоплеер: Воспроизведение, пауза, скорость 1x / 1.25x / 1.5x' },
        { id: 'chat_instant_msg', label: 'Отправка уточнения: Текст от ассистента-владельца мгновенно отображается у Шефа' },
        { id: 'chat_lock_non_owner', label: 'Блокировка чата: Поле ввода заблокировано для не-владельца' }
      ]
    },
    {
      title: '4. Брендинг и Настройки',
      items: [
        { id: 'brand_logo_upload', label: 'Загрузка логотипа: Файл / URL появляется в Header приложения' },
        { id: 'brand_watermark', label: 'Водяной знак: Полупрозрачный логотип на заднем фоне карт' },
        { id: 'brand_reset_slot', label: 'Сброс слотов: Нажатие «Сбросить Слот 1» освобождает место для воркера' }
      ]
    }
  ];

  const totalCount = sections.reduce((acc, s) => acc + s.items.length, 0);
  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4 text-slate-100 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            <span>📋</span> Чек-лист тестирования Telegram Mini App (UI / Frontend)
          </h3>
          <p className="text-[11px] text-slate-400">Изолированная проверка веб-интерфейса без внешних MacBook воркеров</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs text-sky-400 font-bold">{completedCount} / {totalCount} ({progressPercent}%)</div>
          <div className="w-24 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 mt-1">
            <div className="bg-sky-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((sec, idx) => (
          <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-2">
            <div className="text-xs font-semibold text-sky-300 border-b border-slate-800 pb-1 flex justify-between">
              <span>{sec.title}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {sec.items.filter((i) => checkedItems[i.id]).length}/{sec.items.length}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              {sec.items.map((item) => {
                const isChecked = Boolean(checkedItems[item.id]);
                return (
                  <label
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-start gap-2.5 p-1.5 rounded cursor-pointer transition-colors ${
                      isChecked ? 'bg-emerald-950/40 text-emerald-200' : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-sky-600 focus:ring-0 accent-sky-500 cursor-pointer"
                    />
                    <span className={`text-[11px] leading-tight ${isChecked ? 'line-through text-slate-400' : ''}`}>
                      {item.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
