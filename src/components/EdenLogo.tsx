import React from 'react';

interface EdenLogoProps {
  variant?: 'full' | 'compact' | 'residences';
  className?: string;
}

export const EdenLogo: React.FC<EdenLogoProps> = ({ variant = 'full', className = '' }) => {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <img 
          src="/assets/logos/Gardens of Eden/Monogram.svg" 
          alt="Gardens of Eden Monogram" 
          className="w-8 h-8 object-contain"
          referrerPolicy="no-referrer"
        />
        <span className="font-serif-luxury text-sm sm:text-base text-white tracking-widest uppercase border-b border-amber-500/20 pb-0.5">
          GARDENS OF EDEN <span className="font-serif italic text-amber-300 font-normal">Residences</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <img
        src="/assets/logos/Gardens of Eden/2 Lines/GardensOfEden_Logo-White.png"
        alt="Gardens of Eden Logo"
        className="w-full max-w-[320px] sm:max-w-[400px] h-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
