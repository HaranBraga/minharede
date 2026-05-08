"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { BottomSheet } from "./BottomSheet";

/** Modal pra o member trocar a própria senha. */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew]         = useState("");
  const [confirm, setConfirm]         = useState("");
  const [show, setShow]               = useState(false);
  const [busy, setBusy]               = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { toast.error("As senhas novas não conferem"); return; }
    if (newPassword.length < 6) { toast.error("Senha nova precisa ter ao menos 6 caracteres"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Erro ao trocar senha");
        return;
      }
      toast.success("Senha atualizada");
      onClose();
    } finally { setBusy(false); }
  }

  const inp = "w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-600";
  const lbl = "block text-xs font-medium text-gray-600 mb-1.5";

  return (
    <BottomSheet open onClose={onClose} title="Trocar senha">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-gray-500 -mt-2 leading-relaxed">
          Se essa é a sua primeira vez aqui e nunca trocou a senha, ela é a padrão: <strong>123456</strong>.
        </p>
        <div>
          <label className={lbl}>Senha atual</label>
          <div className="relative">
            <input required type={show ? "text" : "password"} value={currentPassword}
              onChange={e => setCurrent(e.target.value)} autoFocus
              className={inp + " pr-11"} />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className={lbl}>Nova senha</label>
          <input required type={show ? "text" : "password"} value={newPassword}
            onChange={e => setNew(e.target.value)} placeholder="Mínimo 6 caracteres"
            className={inp} />
        </div>
        <div>
          <label className={lbl}>Confirmar nova senha</label>
          <input required type={show ? "text" : "password"} value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repita a nova senha"
            className={inp} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 text-base text-gray-600 border border-gray-200 rounded-xl active:bg-gray-50">Cancelar</button>
          <button disabled={busy}
            className="flex-1 py-3 text-base font-semibold text-white bg-brand-600 active:bg-brand-700 rounded-xl disabled:opacity-60">
            {busy ? "Salvando..." : "Atualizar senha"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
