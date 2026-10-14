export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill="#234f39" />
        <circle cx="20" cy="20" r="14.5" fill="none" stroke="#c9dcc8" strokeWidth="1.2" strokeDasharray="2.2 2.2" />
        <path d="M11 26 L17.5 15.5 L21.5 21.5 L24.5 17.5 L29.5 26 Z" fill="#faf8f3" />
        <circle cx="26.5" cy="12.5" r="2.6" fill="#c99a3b" />
      </svg>
      <span className="leading-none">
        <span className="block font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-forest-900">
          Yoyo Travel
        </span>
        <span className="hidden sm:block text-[0.65rem] uppercase tracking-[0.18em] text-sage-500">
          Explore More. Collect Memories.
        </span>
      </span>
    </span>
  );
}
