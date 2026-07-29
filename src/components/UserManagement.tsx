import React, { useState, useEffect } from 'react';
import { DbUser } from '../types';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<DbUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (err) {
      console.error('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSetRole = async (userId: string, role: string) => {
    try {
      await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      });
      fetchUsers();
    } catch (err) {
      console.error('Error setting role', err);
    }
  };

  const handleKickUser = async (userId: string) => {
    try {
      await fetch('/api/admin/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      fetchUsers();
    } catch (err) {
      console.error('Error kicking user', err);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Загрузка пользователей...</div>;
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 text-slate-100 overflow-hidden shadow-lg mt-6">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Управление Пользователями</h2>
          <p className="text-[11px] text-slate-400">
            Список пользователей Mini App, назначение ролей и блокировка
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs transition-colors"
        >
          Обновить
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="overflow-x-auto border border-slate-800 rounded-md">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-700">
              <tr>
                <th className="py-2.5 px-3">ID / Telegram ID</th>
                <th className="py-2.5 px-3">Имя</th>
                <th className="py-2.5 px-3">Роль</th>
                <th className="py-2.5 px-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60 font-sans">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500 text-xs">
                    Нет пользователей
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      <div>{user.id}</div>
                      <div className="text-slate-500 text-[10px]">TG: {user.telegram_id}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-200 font-medium">
                      {user.first_name || user.username || 'Без имени'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <select
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                          value={user.role}
                          onChange={(e) => handleSetRole(user.id, e.target.value)}
                        >
                          <option value="none">-- Роль --</option>
                          <option value="chief">boss (Шеф)</option>
                          <option value="assistant">assistant (Помощник)</option>
                          <option value="admin">admin</option>
                          <option value="pending">pending (Ожидание)</option>
                          <option value="kicked" disabled>kicked (Заблокирован)</option>
                        </select>
                        {user.role === 'kicked' ? (
                          <button
                            onClick={async () => {
                              try {
                                await fetch('/api/admin/unban', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ userId: user.id }),
                                });
                                fetchUsers();
                              } catch (err) {
                                console.error('Error unbanning user', err);
                              }
                            }}
                            className="px-2 py-1 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-300 hover:text-white text-[10px] rounded border border-emerald-800 transition-colors"
                          >
                            Разблокировать
                          </button>
                        ) : (
                          <button
                            onClick={() => handleKickUser(user.id)}
                            className="px-2 py-1 bg-rose-900/80 hover:bg-rose-800 text-rose-300 hover:text-white text-[10px] rounded border border-rose-800 transition-colors"
                          >
                            Выгнать
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
