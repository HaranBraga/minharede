"use client";
import { ReactNode, useEffect } from "react";

/**
 * Bottom sheet mobile-first. No desktop vira modal centralizado.
 */
export function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto sheet-anim">
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pt-2 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <p className="font-bold text-gray-900 text-base">{title}</p>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
