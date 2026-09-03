import React from "react";
import { AlertCircle, Film, Loader2 } from "lucide-react";

export function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`}
    />
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="w-[180px] shrink-0 sm:w-[210px]">
      <Skeleton className="aspect-[16/10] w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm text-[#9a8e93]">
        <Loader2 className="animate-spin" size={18} />
        <span>Loading your cinema…</span>
      </div>
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-red-300/10 bg-white/[0.03] px-6 py-12 text-center">
      <AlertCircle size={28} className="text-[#e08a6b]" />

      <h2 className="mt-4 font-[var(--font-display)] text-xl text-[#efe7da]">
        We hit a quiet moment.
      </h2>

      <p className="mt-2 text-sm text-[#9a8e93]">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-lg bg-[#d9a653] px-4 py-2 text-xs font-bold text-[#100d10]"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message = "Your cinema will fill up as you explore.",
  action,
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.025] px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#5c1220] text-[#d9a653]">
        <Film size={20} />
      </span>

      <h2 className="mt-4 font-[var(--font-display)] text-xl text-[#efe7da]">
        {title}
      </h2>

      <p className="mt-2 text-sm text-[#9a8e93]">
        {message}
      </p>

      {action}
    </div>
  );
}