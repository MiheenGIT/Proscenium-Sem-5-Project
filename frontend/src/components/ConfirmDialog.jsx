import React from "react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(10,8,10,0.7)] backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[4px] border border-[rgba(239,231,218,0.16)] bg-[#17131a] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
      >
        <h2 className="mb-2 font-[var(--font-display)] text-lg font-medium text-[var(--parchment)]">
          {title}
        </h2>
        {message && (
          <p className="mb-6 text-sm leading-relaxed text-[var(--mauve)]">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[3px] border border-[rgba(239,231,218,0.2)] px-4 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] text-[var(--parchment)] transition-colors hover:border-[var(--gold)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-[3px] border px-4 py-1.5 font-[var(--font-mono)] text-[0.68rem] uppercase tracking-[0.06em] transition-colors ${
              danger
                ? "border-[rgba(224,138,107,0.4)] text-[var(--error)] hover:bg-[rgba(224,138,107,0.1)]"
                : "border-[var(--gold)] text-[var(--gold-soft)] hover:bg-[rgba(217,166,83,0.1)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
