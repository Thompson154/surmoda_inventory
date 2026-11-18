import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoginForm } from '../components/LoginForm';

export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/" replace />;

  return (
    <main className="min-h-[100dvh] w-full bg-[#181224] text-white grid grid-cols-1 md:grid-cols-12 overflow-hidden">
      {/* Left / Top Wave Showcase — full height on desktop */}
      <div className="relative md:col-span-6 flex flex-col justify-between p-7 sm:p-10 md:p-14 lg:p-16 overflow-hidden">
        {/* Organic layered vector waves */}
        <svg
          viewBox="0 0 400 360"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-[320px] md:h-full pointer-events-none select-none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="waveWarm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#855250" />
              <stop offset="100%" stopColor="#4F304D" />
            </linearGradient>
            <linearGradient id="wavePlum" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#5D3382" />
              <stop offset="100%" stopColor="#2F1C4E" />
            </linearGradient>
            <linearGradient id="waveDeep" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B235E" />
              <stop offset="100%" stopColor="#181224" />
            </linearGradient>
          </defs>
          <path
            d="M0,0 L400,0 L400,190 C320,250 240,120 140,195 C75,245 35,215 0,185 Z"
            fill="url(#waveWarm)"
            opacity="0.9"
          />
          <path
            d="M0,75 C90,25 180,145 270,115 C340,92 375,140 400,165 L400,270 C310,335 190,235 90,290 C45,315 15,295 0,275 Z"
            fill="url(#wavePlum)"
            opacity="0.88"
          />
          <path
            d="M0,190 C95,245 190,155 295,220 C345,250 380,230 400,210 L400,360 L0,360 Z"
            fill="url(#waveDeep)"
            opacity="0.72"
          />
        </svg>

        <div className="relative z-10 pt-2 md:pt-0 max-w-md">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/25 backdrop-blur-md border border-white/10 mb-8 md:mb-16">
            <span className="h-2 w-2 rounded-full bg-[#e3ff6a]" />
            <span className="font-display text-xs font-semibold tracking-wide text-white/95">
              Sur Moda
            </span>
          </div>

          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.06]">
            Bienvenido
            <br />
            de nuevo
          </h1>
          <p className="text-xs md:text-sm text-white/75 mt-4 max-w-sm leading-relaxed">
            Control unificado de inventario, envíos y registro de ventas para tus sucursales.
          </p>
        </div>

        <div className="hidden md:flex relative z-10 flex-wrap gap-2 pt-8">
          {['Almacén Central', 'Prado', 'Zona Sur', 'Satélite', 'Online'].map((sede) => (
            <span
              key={sede}
              className="px-3 py-1 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm text-white/85 border border-white/10"
            >
              {sede}
            </span>
          ))}
        </div>
      </div>

      {/* Right / Bottom Form Area — full height, zero outer white void */}
      <div className="relative z-10 md:col-span-6 px-7 pb-10 pt-2 md:p-14 lg:p-16 md:bg-[#140E1F] md:border-l md:border-white/10 flex flex-col justify-center items-center">
        <div className="w-full max-w-[380px]">
          <div className="hidden md:block mb-8">
            <h2 className="font-display text-3xl font-bold text-white tracking-tight">
              Accedé a tu sucursal
            </h2>
            <p className="text-sm text-white/55 mt-1.5">Ingresá tu email y contraseña operativa</p>
          </div>

          <LoginForm immersive />

          <p className="text-center text-[11px] text-white/45 mt-8">
            Sur Moda · Inventario & Registro de Ventas
          </p>
        </div>
      </div>
    </main>
  );
}
