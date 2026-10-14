"use client";

import { useEffect, useRef } from "react";

/** Accessible confirmation dialog (native <dialog>: focus trap + Esc to cancel). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,26rem)] rounded-[var(--radius-card)] p-0 shadow-[var(--shadow-lift)] backdrop:bg-forest-900/40"
    >
      <div className="space-y-4 p-6">
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        {body && <p className="text-sm muted">{body}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? "btn-accent" : "btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
