import React, { useState } from 'react';
import { BrandingConfig } from '../types';
import { triggerHaptic } from '../utils/telegramSdk';

interface BrandingOnboardingModalProps {
  branding: BrandingConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaveBranding: (config: Partial<BrandingConfig>) => Promise<void>;
}

export const BrandingOnboardingModal: React.FC<BrandingOnboardingModalProps> = ({
  branding,
  isOpen,
  onClose,
  onSaveBranding
}) => {
  const [logoUrl, setLogoUrl] = useState(branding.logo_url || '');
  const [companyName, setCompanyName] = useState(branding.company_name || 'Voice CRM');
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color || '#0284c7');
  const [patternEnabled, setPatternEnabled] = useState(branding.background_pattern_enabled !== false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
        triggerHaptic('notification', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSaveBranding({
        logo_url: logoUrl,
        company_name: companyName,
        primary_color: primaryColor,
        background_pattern_enabled: patternEnabled
      });
      triggerHaptic('notification', 'success');
      onClose();
    } catch (err) {
      console.error('Error saving branding', err);
      triggerHaptic('notification', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎨</span>
            <h3 className="font-semibold text-sm text-white">Настройка стиля компании (Admin Onboarding)</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        </div>

        <p className="text-xs text-slate-400">
          Загрузите логотип компании для отображения в шапке Telegram Mini App и водяном знаке на фоне карт задач.
        </p>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Название компании</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Загрузить логотип (SVG / PNG / JPG)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-400 text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Или указать URL логотипа</label>
            <input
              type="text"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Основной цвет бренда</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-slate-700 bg-slate-950 cursor-pointer"
                />
                <span className="font-mono text-slate-300">{primaryColor}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="bg-pattern-check"
                checked={patternEnabled}
                onChange={(e) => setPatternEnabled(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-sky-600 accent-sky-500"
              />
              <label htmlFor="bg-pattern-check" className="text-slate-300 cursor-pointer">
                Фоновый водяной знак (5-10% opacity)
              </label>
            </div>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 relative overflow-hidden">
          <div className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">Предпросмотр шапки и водяного знака</div>
          <div className="flex items-center gap-3 bg-slate-900/90 p-2.5 rounded border border-slate-800 z-10 relative">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Preview" className="h-7 max-w-[120px] object-contain" />
            ) : (
              <div className="w-7 h-7 rounded bg-sky-600 flex items-center justify-center text-xs font-bold text-white">
                {companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-white">{companyName}</div>
              <div className="text-[10px] text-sky-400 font-mono">Telegram Mini App Header</div>
            </div>
          </div>

          {/* Watermark preview */}
          {patternEnabled && logoUrl && (
            <div className="absolute right-2 bottom-1 opacity-10 pointer-events-none">
              <img src={logoUrl} alt="Watermark" className="h-16 object-contain" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
          >
            Пропустить
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded text-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Сохранение...' : 'Сохранить стиль компании'}
          </button>
        </div>
      </div>
    </div>
  );
};
