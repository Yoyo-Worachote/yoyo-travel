/**
 * Runs the real Supabase migrations in PGlite (Postgres compiled to WASM) with
 * minimal stand-ins for Supabase's `auth`/`storage` schemas and roles, then
 * verifies Row Level Security isolates user data. This exercises the actual
 * SQL policies; it does not replace testing against a real Supabase project.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`;

let db: PGlite;

async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const f of fs.readdirSync(dir).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  await db.exec(`
    insert into public.countries values ('TH','ประเทศไทย','Thailand');
    insert into public.regions values ('north','TH','ภาคเหนือ','Northern');
    insert into public.provinces (slug, iso_code, country_code, region_id, name_th, name_en) values ('chiang-mai','TH-50','TH','north','เชียงใหม่','Chiang Mai');
    insert into public.place_categories values ('temple','ศาสนสถาน','Religious site');
    insert into public.places (id, slug, province_slug, kind, category, name_th, name_en, lat, lng, provider, external_id, status)
      values ('wd-Q1','wat-a-q1','chiang-mai','attraction','temple','วัดเอ','Wat A',18.8,98.9,'wikidata','Q1','published'),
             ('wd-Q2','wat-b-q2','chiang-mai','attraction','temple','วัดบี','Wat B',18.8,98.95,'wikidata','Q2','hidden');
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}','a@example.com','{"full_name":"User A"}'),
      ('${B}','b@example.com','{"full_name":"User B"}'),
      ('${ADMIN}','admin@example.com','{}');
    update public.profiles set role = 'admin' where id = '${ADMIN}';
  `);
}, 120_000);

describe("schema", () => {
  it("creates a profile for each new auth user from OAuth metadata", async () => {
    const rows = await q("select id, display_name, role from public.profiles order by id");
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.id === A)?.display_name).toBe("User A");
    expect(rows.find((r) => r.id === A)?.role).toBe("user");
  });
});

describe("RLS: private travel records", () => {
  it("lets a user write and read their own records", async () => {
    await as(A, async () => {
      await q(`insert into public.user_province_progress (user_id, province_slug, status) values ($1,'chiang-mai','visited')`, [A]);
      await q(`insert into public.user_place_visits (user_id, place_id, note, rating) values ($1,'wd-Q1','private note',5)`, [A]);
      await q(`insert into public.user_wishlist (user_id, place_id) values ($1,'wd-Q1')`, [A]);
      const trip = await q(`insert into public.user_trips (user_id, name) values ($1,'A trip') returning id`, [A]);
      await q(`insert into public.user_trip_items (trip_id, user_id, place_id) values ($1,$2,'wd-Q1')`, [trip[0].id, A]);
      expect(await q("select * from public.user_place_visits")).toHaveLength(1);
      expect(await q("select * from public.user_trip_items")).toHaveLength(1);
    });
  });

  it("hides another user's records", async () => {
    await as(B, async () => {
      expect(await q("select * from public.user_province_progress")).toHaveLength(0);
      expect(await q("select * from public.user_place_visits")).toHaveLength(0);
      expect(await q("select * from public.user_wishlist")).toHaveLength(0);
      expect(await q("select * from public.user_trips")).toHaveLength(0);
      expect(await q("select * from public.user_trip_items")).toHaveLength(0);
      expect(await q("select * from public.profiles")).toHaveLength(1); // only own profile
    });
  });

  it("rejects writing rows on behalf of another user (client-supplied user_id is not trusted)", async () => {
    await as(B, async () => {
      await expect(q(`insert into public.user_place_visits (user_id, place_id) values ($1,'wd-Q1')`, [A])).rejects.toThrow(/row-level security/);
      await expect(q(`insert into public.user_wishlist (user_id, place_id) values ($1,'wd-Q1')`, [A])).rejects.toThrow(/row-level security/);
    });
  });

  it("cannot update or delete another user's rows", async () => {
    await as(B, async () => {
      const upd = await db.query(`update public.user_place_visits set note = 'hacked' where user_id = $1`, [A]);
      expect(upd.affectedRows).toBe(0);
      const del = await db.query(`delete from public.user_wishlist where user_id = $1`, [A]);
      expect(del.affectedRows).toBe(0);
    });
    const rows = await q(`select note from public.user_place_visits where user_id = $1`, [A]);
    expect(rows[0].note).toBe("private note");
  });

  it("cannot attach items to another user's trip", async () => {
    const [{ id: tripA }] = await q(`select id from public.user_trips where user_id = $1`, [A]);
    await as(B, async () => {
      await expect(
        q(`insert into public.user_trip_items (trip_id, user_id, place_id) values ($1,$2,'wd-Q1')`, [tripA, B]),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("denies anonymous access to private tables", async () => {
    await as(null, async () => {
      await expect(q("select * from public.user_place_visits")).rejects.toThrow(/permission denied/);
      await expect(q("select * from public.profiles")).rejects.toThrow(/permission denied/);
    });
  });

  it("prevents users from making themselves admin", async () => {
    await as(A, async () => {
      await expect(q(`update public.profiles set role = 'admin' where id = $1`, [A])).rejects.toThrow(/admin/);
      await q(`update public.profiles set display_name = 'New name' where id = $1`, [A]);
    });
    expect((await q(`select role, display_name from public.profiles where id = $1`, [A]))[0]).toEqual({ role: "user", display_name: "New name" });
  });
});

describe("RLS: public catalog and admin", () => {
  it("anon sees only published places", async () => {
    await as(null, async () => {
      const rows = await q("select id from public.places order by id");
      expect(rows.map((r) => r.id)).toEqual(["wd-Q1"]);
      const hidden = await q("select * from public.unpublished_place_ids()");
      expect(hidden.map((r) => Object.values(r)[0])).toEqual(["wd-Q2"]);
    });
  });

  it("non-admins cannot write catalog data or read sync logs", async () => {
    await as(A, async () => {
      await expect(
        q(`insert into public.places (id, slug, province_slug, kind, category, name_en, lat, lng, provider, external_id) values ('manual-x','x','chiang-mai','attraction','temple','X',18,98,'manual','manual-x')`),
      ).rejects.toThrow(/row-level security/);
      const upd = await db.query(`update public.places set status = 'hidden' where id = 'wd-Q1'`);
      expect(upd.affectedRows).toBe(0);
      expect(await q("select * from public.data_sync_logs")).toHaveLength(0);
    });
  });

  it("admins can add and moderate places", async () => {
    await as(ADMIN, async () => {
      await q(
        `insert into public.places (id, slug, province_slug, kind, category, name_en, lat, lng, provider, external_id, status) values ('manual-y','y','chiang-mai','attraction','temple','Y',18,98,'manual','manual-y','draft')`,
      );
      const upd = await db.query(`update public.places set status = 'published' where id = 'manual-y'`);
      expect(upd.affectedRows).toBe(1);
      expect((await q("select id from public.places")).length).toBe(3); // admin sees hidden rows too
    });
  });

  it("enforces data constraints", async () => {
    await expect(
      q(`insert into public.places (id, slug, province_slug, kind, category, lat, lng, provider, external_id) values ('wd-Q9','z','chiang-mai','attraction','temple',18,98,'wikidata','Q9')`),
    ).rejects.toThrow(/places_name_present/);
    await expect(q(`insert into public.user_place_visits (user_id, place_id, rating) values ($1,'wd-Q1',9)`, [B])).rejects.toThrow();
  });
});
