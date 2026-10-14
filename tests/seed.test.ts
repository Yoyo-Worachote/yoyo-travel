/** Loads the real migrations + generated supabase/seed.sql into PGlite and checks integrity. */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { getPlaces } from "@/lib/catalog";
import { SUPABASE_STUBS } from "./helpers/supabase-stubs";

let db: PGlite;
const count = async (sql: string) => Number(((await db.query(sql)).rows[0] as { n: number }).n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  await db.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8"));
}, 180_000);

describe("supabase/seed.sql", () => {
  it("loads 77 provinces in 6 regions", async () => {
    expect(await count("select count(*)::int n from public.provinces")).toBe(77);
    expect(await count("select count(distinct region_id)::int n from public.provinces")).toBe(6);
  });

  it("contains every catalog place exactly once with valid province links", async () => {
    expect(await count("select count(*)::int n from public.places")).toBe(getPlaces().length);
    expect(await count("select count(*)::int n from public.places p left join public.provinces v on v.slug = p.province_slug where v.slug is null")).toBe(0);
    expect(await count("select count(distinct province_slug)::int n from public.places where provider = 'osm'")).toBe(77);
    expect(await count("select count(distinct province_slug)::int n from public.places where provider = 'wikidata'")).toBe(77);
  });

  it("stores provenance for every place and license for every image", async () => {
    expect(await count("select count(*)::int n from public.places where source_url is null or license is null or fetched_at is null")).toBe(0);
    expect(await count("select count(*)::int n from public.place_images where license = '' or author = ''")).toBe(0);
  });

  it("is idempotent (can be re-applied after a re-sync)", async () => {
    await db.exec(fs.readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8"));
    expect(await count("select count(*)::int n from public.places")).toBe(getPlaces().length);
  });
});
