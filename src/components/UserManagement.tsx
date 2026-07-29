import React, { useState, useEffect } from 'react';
import { DbUser } from '../types';

import { UserRole } from '../types';

interface UserManagementProps {
  currentUser?: any;
  onRoleChanged?: (role: UserRole) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onRoleChanged }) => {
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
      await fetchUsers();
      
      // If admin changed their own role, update the app state instantly
      if (currentUser && (currentUser.id === userId || currentUser.telegram_id === userId) && onRoleChanged) {
        let mappedRole: UserRole = 'boss';
        if (role === 'admin') mappedRole = 'admin';
        else if (role === 'assistant') mappedRole = 'assistant_1';
        else if (role === 'chief') mappedRole = 'boss';
        else if (role === 'pending') mappedRole = 'pending';
        else if (role === 'kicked') mappedRole = 'kicked';
        
        onRoleChanged(mappedRole);
      }
    } catch (err) {
      console.error('Error setting role', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя?')) return;
    try {
      await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      fetchUsers();
    } catch (err) {
      console.error('Error deleting user', err);
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-sm">Загрузка пользователей...</div>;
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800/80 text-slate-100 overflow-hidden shadow-2xl mt-6 relative">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-slate-950/60 backdrop-blur-md px-6 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-wide font-serif-luxury">
              Управление Пользователями
            </h2>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              Gardens of Eden
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление ролями, одобрение заявок и администрирование доступа
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 rounded-lg text-xs font-mono transition-all border border-slate-700/60 flex items-center gap-1.5 active:scale-95 self-start sm:self-auto"
        >
          <span>Обновить список</span>
        </button>
      </div>

      <div className="p-6 relative z-10 space-y-4">
        {users.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800/50">
            Пользователи не найдены
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => {
              const isChief = user.role === 'chief' || user.role === 'boss';
              const isAssistant = user.role === 'assistant';
              const isAdmin = user.role === 'admin';
              const isPending = user.role === 'pending';
              const isKicked = user.role === 'kicked';

              return (
                <div
                  key={user.id}
                  className="bg-slate-950/70 backdrop-blur-md border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-200 flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-3">
                      <div>
                        <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
                          <span>{user.first_name || user.username || 'Без имени'}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          ID: {user.telegram_id || user.id}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md border tracking-wider uppercase ${
                          isChief
                            ? 'bg-amber-950/80 text-amber-300 border-amber-800/80'
                            : isAdmin
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                            : isAssistant
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80'
                            : isPending
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800/80 animate-pulse'
                            : 'bg-rose-950/80 text-rose-300 border-rose-800/80'
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-slate-400">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Системный ID:</span>
                        <span className="font-mono text-slate-300 text-[11px]">{user.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Telegram:</span>
                        <span className="font-mono text-slate-300 text-[11px]">
                          @{user.username || 'n/a'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    <select
                      className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono transition-colors w-full"
                      value={user.role}
                      onChange={(e) => handleSetRole(user.id, e.target.value)}
                    >
                      <option value="none">-- Выберите роль --</option>
                      <option value="chief">boss (Шеф)</option>
                      <option value="assistant">assistant (Помощник)</option>
                      <option value="admin">admin (Администратор)</option>
                      <option value="pending">pending (Ожидание)</option>
                      <option value="kicked" disabled>kicked (Заблокирован)</option>
                    </select>

                    {isKicked ? (
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
                        className="px-3 py-1.5 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 text-xs rounded-lg border border-emerald-700/60 transition-all font-mono shrink-0"
                      >
                        Разблокировать
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-rose-100 text-xs rounded-lg border border-rose-800/60 transition-all font-mono shrink-0"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
