import { Compass } from "lucide-react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-sage-100 text-forest-600">
        <Compass className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="font-semibold text-forest-900">{title}</p>
      {body && <p className="max-w-md text-sm muted">{body}</p>}
      {action}
    </div>
  );
}
