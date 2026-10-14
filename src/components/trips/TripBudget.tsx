"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { computeBudget, type ProviderPrice } from "@/lib/budget";
import { formatBaht, formatDate, localName } from "@/lib/display";
import { COST_CATEGORIES, type CostCategory, type Trip } from "@/lib/travel-state";

/** Budget calculator: estimates vs actual, per person, remaining, unpriced items and price sources. */
export function TripBudget({ trip, prices }: { trip: Trip; prices: Record<string, ProviderPrice | null> }) {
  const t = useTranslations("trips");
  const locale = useLocale();
  const store = useTravelStore();
  const b = computeBudget(trip, (id) => prices[id] ?? null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CostCategory>("transport");
  const [costType, setCostType] = useState<"estimated" | "actual">("estimated");
  const money = (n: number) => formatBaht(Math.round(n), locale);
  const range = (min: number, max: number) => (min === max ? money(min) : `${money(min)} – ${money(max)}`);
  const itemName = (itemId: string) => {
    const i = trip.items.find((x) => x.id === itemId);
    return i ? localName(i, locale) : "";
  };

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!label.trim() || !Number.isFinite(n) || n < 0) return;
    store.addExpense(trip.id, { label, amount: n, category, costType, day: null });
    setLabel("");
    setAmount("");
  };

  return (
    <section className="card space-y-5 p-5" aria-labelledby="budget-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="budget-title" className="text-lg font-bold">
          {t("costSummary")}
        </h2>
        <span className="text-xs muted">
          {t("currencyNote", { currency: trip.currency })} · {t("travelersN", { n: b.travelers })}
        </span>
      </div>

      {!b.complete && (
        <p className="flex items-start gap-2 rounded-xl bg-gold-soft px-4 py-3 text-sm text-[#5f4612]" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("incompleteBudget", { count: b.unpricedCount })}
        </p>
      )}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-sage-50 p-3">
          <dt className="text-xs muted">{t("plannedTotal")}</dt>
          <dd className="text-lg font-bold">{range(b.plannedMin, b.plannedMax)}</dd>
          {!b.complete && <dd className="text-xs text-[#8a6416]">{t("plusUnpriced")}</dd>}
        </div>
        <div className="rounded-xl bg-sage-50 p-3">
          <dt className="text-xs muted">{t("perPerson")}</dt>
          <dd className="text-lg font-bold">{range(b.perPersonMin, b.perPersonMax)}</dd>
        </div>
        <div className="rounded-xl bg-sage-50 p-3">
          <dt className="text-xs muted">{t("actualSpent")}</dt>
          <dd className="text-lg font-bold">{money(b.actualTotal)}</dd>
        </div>
        <div className="rounded-xl bg-sage-50 p-3">
          <dt className="text-xs muted">{t("remaining")}</dt>
          <dd className={`text-lg font-bold ${b.remaining != null && b.remaining < 0 ? "text-clay" : "text-forest-700"}`}>
            {b.remaining == null ? t("noBudgetSet") : money(b.remaining)}
          </dd>
        </div>
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-sage-200 text-xs muted">
              <th className="py-2 font-semibold">{t("category")}</th>
              <th className="font-semibold">{t("estimated")}</th>
              <th className="font-semibold">{t("actual")}</th>
              <th className="font-semibold">{t("unpriced")}</th>
            </tr>
          </thead>
          <tbody>
            {COST_CATEGORIES.map((c) => {
              const v = b.byCategory[c];
              return (
                <tr key={c} className="border-b border-sage-100">
                  <td className="py-2">{t(`cost.${c}`)}</td>
                  <td>{v.estimatedMax ? range(v.estimatedMin, v.estimatedMax) : "—"}</td>
                  <td>{v.actual ? money(v.actual) : "—"}</td>
                  <td className={v.unpriced ? "text-[#8a6416]" : ""}>{v.unpriced || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {b.items.some((i) => i.source === "provider") && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("priceSources")}</h3>
          <ul className="space-y-1 text-xs">
            {b.items
              .filter((i) => i.source === "provider" && i.provider)
              .map((i) => (
                <li key={i.itemId}>
                  {itemName(i.itemId)}: {range(i.provider!.min, i.provider!.max)}
                  {i.provider!.perPerson ? ` × ${b.travelers}` : ""} —{" "}
                  {i.provider!.sourceUrl ? (
                    <a href={i.provider!.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {i.provider!.source}
                    </a>
                  ) : (
                    i.provider!.source
                  )}
                  {i.provider!.observedAt ? ` (${formatDate(i.provider!.observedAt, locale)})` : ""}
                </li>
              ))}
          </ul>
        </div>
      )}

      {b.unpricedCount > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("unpricedItems")}</h3>
          <ul className="flex flex-wrap gap-2 text-xs">
            {b.items
              .filter((i) => i.source === "none")
              .map((i) => (
                <li key={i.itemId} className="badge bg-gold-soft text-[#6b4f12]">
                  {itemName(i.itemId)}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 border-t border-sage-100 pt-4">
        <h3 className="text-sm font-semibold">{t("otherExpenses")}</h3>
        {trip.expenses.length > 0 && (
          <ul className="space-y-1 text-sm">
            {trip.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="badge">{t(`cost.${e.category}`)}</span>
                <span className="flex-1 truncate">{e.label}</span>
                <span className="text-xs muted">{e.costType === "actual" ? t("actual") : t("estimated")}</span>
                <span className="font-semibold">{money(e.amount)}</span>
                <button
                  type="button"
                  className="rounded p-1 text-clay hover:bg-clay-soft"
                  onClick={() => store.removeExpense(trip.id, e.id)}
                  aria-label={`${t("remove")} ${e.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addExpense} className="grid gap-2 sm:grid-cols-[1fr_120px_130px_120px_auto]">
          <label className="sr-only" htmlFor="exp-label">
            {t("expenseLabel")}
          </label>
          <input id="exp-label" className="input text-sm" placeholder={t("expenseLabel")} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
          <label className="sr-only" htmlFor="exp-amount">
            {t("amount")}
          </label>
          <input
            id="exp-amount"
            className="input text-sm"
            type="number"
            min={0}
            step={10}
            inputMode="numeric"
            placeholder={t("amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <label className="sr-only" htmlFor="exp-cat">
            {t("category")}
          </label>
          <select id="exp-cat" className="input text-sm" value={category} onChange={(e) => setCategory(e.target.value as CostCategory)}>
            {COST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`cost.${c}`)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="exp-type">
            {t("costType")}
          </label>
          <select id="exp-type" className="input text-sm" value={costType} onChange={(e) => setCostType(e.target.value as "estimated" | "actual")}>
            <option value="estimated">{t("estimated")}</option>
            <option value="actual">{t("actual")}</option>
          </select>
          <button type="submit" className="btn btn-secondary btn-sm" disabled={!label.trim() || amount === ""}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("add")}
          </button>
        </form>
      </div>
      <p className="text-xs muted">{t("budgetNote")}</p>
    </section>
  );
}
