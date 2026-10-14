import { useTranslations } from "next-intl";
import type { DataLabel as DL, DataProvider } from "@/lib/types";
import { Database, BadgeCheck, PenLine, Users, Calculator, FlaskConical } from "lucide-react";

const ICON = {
  provider: Database,
  verified: BadgeCheck,
  editor: PenLine,
  community: Users,
  estimated: Calculator,
  demo: FlaskConical,
} as const;

export function DataLabelBadge({ label, provider }: { label: DL; provider?: DataProvider }) {
  const t = useTranslations("labels");
  const Icon = ICON[label];
  return (
    <span className="badge bg-forest-50 text-forest-700 border border-forest-100">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(label)}
      {provider && provider !== "manual" ? ` · ${t(provider)}` : ""}
    </span>
  );
}
