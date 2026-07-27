import React from 'react';

interface EdenLogoProps {
  variant?: 'full' | 'compact' | 'residences';
  className?: string;
}

export const EdenLogo: React.FC<EdenLogoProps> = ({ variant = 'full', className = '' }) => {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 font-serif text-white tracking-widest uppercase ${className}`}>
        <span className="font-light text-sm sm:text-base border-b border-amber-200/40 pb-0.5">
          EDEN <span className="font-serif italic text-amber-200 font-normal">Residences</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <svg
        viewBox="0 0 600 180"
        className="w-full max-w-[340px] sm:max-w-[420px] h-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Decorative flourishes / leaves */}
        <path
          d="M240 38 C 270 20, 330 20, 360 38 C 340 34, 260 34, 240 38 Z"
          fill="url(#goldGradient)"
          opacity="0.85"
        />
        
        {/* EDEN Header */}
        <text
          x="300"
          y="68"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Cinzel', 'Playfair Display', 'Georgia', serif"
          fontSize="54"
          fontWeight="300"
          letterSpacing="18"
        >
          EDEN
        </text>

        {/* Curved Swoosh Flourish under EDEN */}
        <path
          d="M 210 82 Q 300 102 390 82 Q 300 92 210 82 Z"
          fill="url(#goldGradient)"
        />

        {/* RESIDENCES Subtitle */}
        <text
          x="300"
          y="126"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Cinzel', 'Montserrat', 'Trajan Pro', serif"
          fontSize="32"
          fontWeight="400"
          letterSpacing="14"
        >
          RESIDENCES
        </text>

        {/* Luxury of Nature Tagline */}
        <text
          x="300"
          y="156"
          textAnchor="middle"
          fill="#FDE68A"
          fontFamily="'Playfair Display', 'Baskerville', serif"
          fontStyle="italic"
          fontSize="16"
          fontWeight="300"
          letterSpacing="4"
          opacity="0.95"
        >
          Luxury of Nature
        </text>

        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
