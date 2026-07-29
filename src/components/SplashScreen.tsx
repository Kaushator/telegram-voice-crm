import { useEffect, useState } from 'react';
import { UserRole } from '../types';

interface SplashScreenProps {
  onAuthenticated: (role: UserRole, user: any, token?: string) => void;
}

export function SplashScreen({ onAuthenticated }: SplashScreenProps) {
  const [loadingText, setLoadingText] = useState('Welcome to CRM. Please wait for logging');
  const [dots, setDots] = useState('.');
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();

    const authenticate = async () => {
      try {
        const tgInitData = window.Telegram?.WebApp?.initData || '';
        
        const res = await fetch('/api/auth/me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-init-data': tgInitData,
          },
          body: JSON.stringify({ initData: tgInitData }),
        });

        const data = await res.json();
        
        // Ensure at least 1.2s minimum delay so splash is visible smoothly
        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, 1200 - elapsed);

        setTimeout(() => {
          if (!isMounted) return;
          
          setFadeOut(true);
          
          setTimeout(() => {
            if (!isMounted) return;
            
            if (data && data.success) {
              const rawRole = data.role || 'chief';
              let mappedRole: UserRole = 'boss';
              if (rawRole === 'chief' || rawRole === 'boss') mappedRole = 'boss';
              else if (rawRole === 'admin') mappedRole = 'admin';
              else if (rawRole === 'assistant') mappedRole = 'assistant_1';
              
              onAuthenticated(mappedRole, data.user, data.token);
            } else {
              onAuthenticated('boss', { id: 1001, first_name: 'Шеф' });
            }
          }, 400); // fade duration
        }, remainingDelay);

      } catch (err) {
        console.error('Splash auth check failed', err);
        setTimeout(() => {
          if (!isMounted) return;
          setFadeOut(true);
          setTimeout(() => {
            onAuthenticated('boss', { id: 1001, first_name: 'Шеф' });
          }, 400);
        }, 1200);
      }
    };

    authenticate();

    return () => {
      isMounted = false;
    };
  }, [onAuthenticated]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white transition-opacity duration-500 overflow-hidden ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-75"
        src="/welcome.mp4"
      />

      {/* Dark overlay with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-900/80 to-slate-950/90 backdrop-blur-xs" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center space-y-6 animate-fade-in">
        {/* Animated Badge / Icon */}
        <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-sky-500/20 to-emerald-500/20 border border-white/10 shadow-2xl backdrop-blur-md">
          <div className="absolute inset-0 rounded-2xl bg-amber-500/10 animate-ping opacity-30" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg">
            🎙️
          </div>
        </div>

        {/* Brand Title */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
            Telegram Voice CRM
          </h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
            Enterprise System
          </p>
        </div>

        {/* Mandatory Splash Text */}
        <div className="py-2 px-4 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-inner flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-sm font-medium text-slate-200">
            Welcome to CRM. Please wait for logging{dots}
          </span>
        </div>

        {/* Loading Progress Bar Animation */}
        <div className="w-48 h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-white/5 relative shadow-inner">
          <div className="h-full bg-gradient-to-r from-amber-500 via-sky-400 to-emerald-400 animate-pulse w-full transform origin-left transition-all duration-1000" />
        </div>
      </div>
    </div>
  );
}
