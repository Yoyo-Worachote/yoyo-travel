import { redirect } from "next/navigation";

/** Search now lives in the Places explorer; keep old links working. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  for (const key of ["q", "province"]) {
    const v = sp[key];
    if (v) next.set(key, v.slice(0, 100));
  }
  redirect(`/places${next.toString() ? `?${next}` : ""}`);
}
