import React from 'react';
import { MacContainerState } from '../types';

interface MacContainerStatusProps {
  containers: Record<string, MacContainerState>;
}

export const MacContainerStatus: React.FC<MacContainerStatusProps> = ({ containers }) => {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 text-slate-100 overflow-hidden shadow-lg">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-white">Статус локальных Docker-контейнеров на MacBook (mac_worker)</h2>
        <p className="text-[11px] text-slate-400">
          Локальная транскрибация WhisperX (Apple MPS / CPU) + Gemma 2 (Ollama / llama.cpp)
        </p>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.entries(containers) as [string, MacContainerState][]).map(([id, c]) => (
            <div key={id} className="bg-slate-800/80 border border-slate-700/80 rounded-md p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{c.assistantName}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    c.isOnline ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {c.isOnline ? 'ONLINE (Включен)' : 'OFFLINE'}
                </span>
              </div>

              <div className="space-y-1 text-slate-400 text-[11px]">
                <div className="flex justify-between">
                  <span>WhisperX Engine:</span>
                  <span className="text-slate-200 font-mono">{c.whisperxReady ? 'Готов (large-v2)' : 'Не загружен'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gemma 2 LLM (Ollama):</span>
                  <span className="text-slate-200 font-mono">gemma2:2b (Apple Metal API)</span>
                </div>
                <div className="flex justify-between">
                  <span>Ускорение GPU/MPS:</span>
                  <span className="text-emerald-400 font-mono">{c.gpuAccelerated ? 'Metal / MPS Active' : 'CPU Only'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Docker Command Instruction */}
        <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="font-semibold text-indigo-400">Команда развертывания на Mac ассистента:</div>
          <pre className="bg-slate-900 p-2 rounded text-[11px] font-mono text-emerald-400 overflow-x-auto">
            cd mac_worker && docker-compose up -d --build
          </pre>
        </div>
      </div>
    </div>
  );
};
