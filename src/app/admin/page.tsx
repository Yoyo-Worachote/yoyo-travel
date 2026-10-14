import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { AddPlaceForm } from "@/components/admin/AddPlaceForm";
import { getBasePlaces, getCatalogDates, getProvinces } from "@/lib/catalog";
import { formatDate, localName } from "@/lib/display";
import { findDuplicates } from "@/lib/duplicates";
import { getAdminContext } from "@/lib/supabase/server";
import { setPlaceStatus } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AdminPage() {
  const t = await getTranslations();
  const locale = await getLocale();
  const ctx = await getAdminContext();

  if (ctx.status === "signed_out") redirect("/login?next=/admin");
  if (ctx.status !== "ok") {
    return (
      <div className="container-page grid min-h-[50vh] place-items-center py-16">
        <div className="card max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-clay" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-bold">{ctx.status === "not_configured" ? t("admin.title") : t("admin.forbidden")}</h1>
          <p className="mt-2 muted">{ctx.status === "not_configured" ? t("admin.notConfigured") : t("admin.forbiddenBody")}</p>
        </div>
      </div>
    );
  }

  // Authorized admin below this line (checked server-side; RLS also enforces is_admin()).
  const places = getBasePlaces();
  const provinces = getProvinces();
  const dates = getCatalogDates();
  const byProvider = places.reduce<Record<string, number>>((acc, p) => ((acc[p.source.provider] = (acc[p.source.provider] ?? 0) + 1), acc), {});
  const withImages = places.filter((p) => p.image).length;
  const missingLicense = places.filter((p) => p.image && (!p.image.license || !p.image.author)).length;
  const dups = findDuplicates(places).slice(0, 50);

  const [{ data: manual }, { data: hidden }, { data: logs }] = await Promise.all([
    ctx.supabase.from("places").select("id,name_th,name_en,province_slug,status,source_url,updated_at").eq("provider", "manual").order("updated_at", { ascending: false }).limit(100),
    ctx.supabase.from("places").select("id,name_th,name_en,status").neq("provider", "manual").neq("status", "published").limit(100),
    ctx.supabase.from("data_sync_logs").select("*").order("started_at", { ascending: false }).limit(20),
  ]);

  const StatusForm = ({ id, status }: { id: string; status: string }) => (
    <form action={setPlaceStatus} className="flex gap-1">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`st-${id}`}>
        {t("admin.status")}
      </label>
      <select id={`st-${id}`} name="status" defaultValue={status} className="input !w-auto !py-1 text-sm">
        {(["draft", "review", "published", "hidden"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`admin.${s}`)}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn-secondary btn-sm">
        {t("common.save")}
      </button>
    </form>
  );

  return (
    <div className="container-page space-y-8 py-10">
      <h1 className="text-3xl font-bold">{t("admin.title")}</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("admin.overview")}>
        {[
          [t("admin.provinces"), provinces.length],
          [t("admin.places"), places.length],
          [t("admin.withImages"), withImages],
          [t("admin.manualPlaces"), manual?.length ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-5">
            <p className="text-sm muted">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">{t("admin.byProvider")} / {t("admin.freshness")}</h2>
          <ul className="space-y-1 text-sm">
            {Object.entries(byProvider).map(([k, v]) => (
              <li key={k}>
                {t(`labels.${k}`)}: <strong>{v}</strong>
              </li>
            ))}
            <li>Provinces: {formatDate(dates.provinces, locale)}</li>
            <li>Wikidata: {formatDate(dates.wikidata, locale)}</li>
            <li>OpenStreetMap: {formatDate(dates.osm, locale)}</li>
          </ul>
          <p className="mt-3 text-xs muted">{t("admin.syncHowTo")}</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">{t("admin.attribution")}</h2>
          <p className="text-sm">{missingLicense === 0 ? t("admin.missingLicense") : `⚠ ${missingLicense}`}</p>
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">{t("admin.addPlace")}</h2>
        <AddPlaceForm provinces={provinces.map((p) => ({ slug: p.slug, name: localName(p, locale) }))} />
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-lg font-bold">{t("admin.manualPlaces")}</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-sage-200">
              <th className="py-2">{t("admin.nameTh")}</th>
              <th>{t("admin.nameEn")}</th>
              <th>{t("random.province")}</th>
              <th>{t("admin.status")}</th>
            </tr>
          </thead>
          <tbody>
            {(manual ?? []).map((m) => (
              <tr key={m.id} className="border-b border-sage-100">
                <td className="py-2">{m.name_th}</td>
                <td>{m.name_en}</td>
                <td>{m.province_slug}</td>
                <td>
                  <StatusForm id={m.id} status={m.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(hidden ?? []).length > 0 && (
          <>
            <h3 className="mb-2 mt-6 font-semibold">{t("admin.hidden")}</h3>
            <ul className="space-y-2 text-sm">
              {(hidden ?? []).map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3">
                  <span>{h.name_th ?? h.name_en} ({h.id})</span>
                  <StatusForm id={h.id} status={h.status} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="text-lg font-bold">{t("admin.duplicates")}</h2>
        <p className="mb-3 text-xs muted">{t("admin.duplicatesNote")}</p>
        {dups.length === 0 ? (
          <p className="text-sm">{t("admin.noDuplicates")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {dups.map(([a, b]) => (
              <li key={`${a.id}-${b.id}`} className="flex flex-wrap items-center gap-2 border-b border-sage-100 pb-2">
                <span>
                  {a.nameTh ?? a.nameEn} <code className="text-xs">{a.id}</code>
                </span>
                <span aria-hidden="true">↔</span>
                <span>
                  {b.nameTh ?? b.nameEn} <code className="text-xs">{b.id}</code>
                </span>
                <StatusForm id={b.id} status="published" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-lg font-bold">{t("admin.syncLogs")}</h2>
        {(logs ?? []).length === 0 ? (
          <p className="text-sm muted">{t("admin.noLogs")}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="border-b border-sage-100">
                  <td className="py-2">{l.provider}</td>
                  <td>{l.scope}</td>
                  <td>{l.status}</td>
                  <td>{l.records}</td>
                  <td>{formatDate(l.started_at, locale)}</td>
                  <td className="text-clay">{l.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
