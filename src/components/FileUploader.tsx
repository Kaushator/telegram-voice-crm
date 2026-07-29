import React, { useState, useRef } from 'react';
import { TaskFile } from '../types';

interface FileUploaderProps {
  taskId: string;
  currentRole: string;
  currentAssistantName: string;
  files?: TaskFile[];
  onUploadSuccess?: () => void;
  triggerHaptic?: (type?: string, subType?: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  taskId,
  currentRole,
  currentAssistantName,
  files = [],
  onUploadSuccess,
  triggerHaptic
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('role', currentRole);
    formData.append('uploaded_by_role', currentRole);
    formData.append('name', currentAssistantName);
    formData.append('uploaded_by_name', currentAssistantName);

    try {
      const res = await fetch(`/api/tasks/${taskId}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        // Retry with alternate route if needed
        const resAlt = await fetch(`/api/tasks/${taskId}/files`, {
          method: 'POST',
          body: formData
        });
        if (!resAlt.ok) throw new Error('Ошибка загрузки файла');
      }

      if (triggerHaptic) triggerHaptic('notification', 'success');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error('FileUploader error:', err);
      setErrorMsg('Не удалось загрузить файл');
      if (triggerHaptic) triggerHaptic('notification', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
          📎 Документы и файлы ({files.length}):
        </span>
        {isUploading && (
          <span className="text-[10px] font-mono text-amber-400 animate-pulse font-semibold">
            ⏳ Загрузка файла...
          </span>
        )}
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-200 ${
          isDragOver
            ? 'border-sky-400 bg-sky-950/30'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-xl">📁</span>
          <div className="text-xs text-slate-300 font-medium">
            {isUploading ? 'Сохранение файла на VPS...' : 'Перетащите PDF, билеты, фото или нажмите для выбора'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Автоматическое сохранение в директорию uploads/tasks/{taskId}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="text-[11px] text-red-400 bg-red-950/40 p-1.5 rounded border border-red-900/50 font-mono">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Files List */}
      {files.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 pt-1">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between bg-slate-900/90 p-2 rounded border border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <span className="text-sky-400 shrink-0 font-mono text-base">
                  {f.file_type?.includes('image') ? '🖼️' : '📄'}
                </span>
                <div className="truncate">
                  <div className="text-slate-200 font-medium truncate">{f.file_name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {f.uploaded_by_name} ({f.uploaded_by_role === 'boss' || f.uploaded_by_role === 'chief' ? 'Шеф' : 'Ассистент'}) • {(f.file_size / 1024).toFixed(1)} KB • {new Date(f.uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <a
                href={f.file_path}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-sky-950 hover:bg-sky-900 text-sky-300 rounded border border-sky-800/60 text-[11px] font-mono shrink-0 transition-colors flex items-center gap-1 font-semibold"
              >
                <span>Скачать</span>
                <span>↗</span>
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-slate-500 italic font-mono text-center">
          Нет загруженных файлов.
        </div>
      )}
    </div>
  );
};
