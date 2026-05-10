"use client";

export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="text-brand-600" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function CenteredLoader({ label = "Carregando...", className = "py-12" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-gray-400 ${className}`}>
      <Spinner className="text-brand-600" size={22} />
      <p className="text-xs">{label}</p>
    </div>
  );
}
