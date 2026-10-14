"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { createManualPlace, type AdminActionState } from "@/app/admin/actions";

const KINDS = ["attraction", "restaurant", "cafe", "accommodation", "activity"] as const;
const CATEGORIES = [
  "national_park", "nature", "waterfall", "beach", "island", "mountain", "cave", "viewpoint", "history", "museum",
  "temple", "market", "shopping", "park", "activity", "restaurant", "cafe", "hotel", "hostel", "guest_house", "motel", "apartment",
] as const;

export function AddPlaceForm({ provinces }: { provinces: Array<{ slug: string; name: string }> }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(createManualPlace, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className="label" htmlFor="ap-th">{t("admin.nameTh")}</label>
        <input id="ap-th" name="nameTh" className="input" maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="ap-en">{t("admin.nameEn")}</label>
        <input id="ap-en" name="nameEn" className="input" maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor="ap-prov">{t("random.province")}</label>
        <select id="ap-prov" name="provinceSlug" className="input" required>
          {provinces.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ap-kind">{t("admin.kind")}</label>
        <select id="ap-kind" name="kind" className="input">
          {KINDS.map((k) => (
            <option key={k} value={k}>{t(`kinds.${k}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ap-cat">{t("admin.category")}</label>
        <select id="ap-cat" name="category" className="input">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{t(`categories.${c}`)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="ap-lat">{t("admin.lat")}</label>
        <input id="ap-lat" name="lat" type="number" step="0.000001" min={5} max={21} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ap-lng">{t("admin.lng")}</label>
        <input id="ap-lng" name="lng" type="number" step="0.000001" min={97} max={106} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="ap-status">{t("admin.status")}</label>
        <select id="ap-status" name="status" className="input" defaultValue="draft">
          <option value="draft">{t("admin.draft")}</option>
          <option value="review">{t("admin.review")}</option>
          <option value="published">{t("admin.published")}</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="label" htmlFor="ap-src">{t("admin.sourceUrl")}</label>
        <input id="ap-src" name="sourceUrl" type="url" required className="input" placeholder="https://" />
      </div>
      <div className="flex items-end gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{t("common.add")}</button>
        {state && <span role="status" className={state.ok ? "text-forest-700 text-sm" : "text-clay text-sm"}>{state.ok ? t("admin.created") : t("admin.invalid")}</span>}
      </div>
    </form>
  );
}
