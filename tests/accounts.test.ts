/**
 * Accounts / trips migration (20261015000000) on PGlite with Supabase stand-ins.
 * The migration is applied on top of a database that already holds data, to
 * prove it is non-destructive.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUBS } from "./helpers/supabase-stubs";

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b1";
const OLD = "00000000-0000-4000-8000-0000000000c1";
let db: PGlite;

const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];
async function as<T>(role: "anon" | "authenticated" | "service_role", uid: string | null, fn: () => Promise<T>) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs.readdirSync(dir).sort();
  const [newest, ...older] = [files.at(-1)!, ...files.slice(0, -1)];
  for (const f of older) await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  // Existing data created before the new migration.
  await db.exec(`
    insert into public.countries values ('TH','ประเทศไทย','Thailand');
    insert into public.regions values ('north','TH','ภาคเหนือ','Northern');
    insert into public.provinces (slug, iso_code, country_code, region_id, name_th, name_en) values ('nan','TH-55','TH','north','น่าน','Nan');
    insert into public.place_categories values ('temple','ศาสนสถาน','Religious site');
    insert into public.places (id, slug, province_slug, kind, category, name_en, lat, lng, provider, external_id)
      values ('wd-Q1','wat-q1','nan','attraction','temple','Wat',18.7,100.7,'wikidata','Q1');
    insert into auth.users (id, email, raw_user_meta_data) values ('${OLD}','old@example.com','{"full_name":"Old User"}');
    insert into public.user_trips (id, user_id, name) values ('11111111-1111-4111-8111-111111111111','${OLD}','Old trip');
    insert into public.user_trip_items (trip_id, user_id, place_id) values ('11111111-1111-4111-8111-111111111111','${OLD}','wd-Q1');
  `);
  await db.exec(fs.readFileSync(path.join(dir, newest), "utf8"));
  expect(newest).toContain("accounts_trips_places");
}, 120_000);

describe("migration is non-destructive", () => {
  it("keeps existing trips/items/profiles and fills defaults", async () => {
    const [trip] = await q("select name, traveler_count, currency, status, travel_styles from public.user_trips");
    expect(trip).toMatchObject({ name: "Old trip", traveler_count: 1, currency: "THB", status: "planning" });
    expect(await q("select * from public.user_trip_items")).toHaveLength(1);
    const [profile] = await q(`select display_name, username from public.profiles where id = $1`, [OLD]);
    expect(profile).toEqual({ display_name: "Old User", username: null });
  });
});

describe("usernames", () => {
  it("are taken from sign-up metadata, lower-cased", async () => {
    await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1,'a@example.com','{"username":"Yoyo_Trip"}')`, [A]);
    expect((await q(`select username, display_name from public.profiles where id = $1`, [A]))[0]).toEqual({
      username: "yoyo_trip",
      display_name: "yoyo_trip",
    });
  });

  it("reject a duplicate username atomically (no auth user is created)", async () => {
    await expect(
      q(`insert into auth.users (id, email, raw_user_meta_data) values ($1,'b@example.com','{"username":"YOYO_trip"}')`, [B]),
    ).rejects.toThrow(/duplicate key|unique/);
    expect(await q(`select id from auth.users where id = $1`, [B])).toHaveLength(0);
  });

  it("ignore invalid usernames from metadata", async () => {
    await q(`insert into auth.users (id, email, raw_user_meta_data) values ($1,'b@example.com','{"username":"x y!"}')`, [B]);
    expect((await q(`select username from public.profiles where id = $1`, [B]))[0].username).toBeNull();
  });

  it("enforce format and uniqueness on profile updates", async () => {
    await as("authenticated", B, async () => {
      await expect(q(`update public.profiles set username = 'Bad Name' where id = $1`, [B])).rejects.toThrow(/username_format/);
      await expect(q(`update public.profiles set username = 'yoyo_trip' where id = $1`, [B])).rejects.toThrow(/duplicate|unique/);
      await q(`update public.profiles set username = 'second_user' where id = $1`, [B]);
    });
  });

  it("username_available is callable anonymously and reveals only a boolean", async () => {
    await as("anon", null, async () => {
      expect((await q(`select public.username_available('YOYO_TRIP') as v`))[0].v).toBe(false);
      expect((await q(`select public.username_available('free_name') as v`))[0].v).toBe(true);
      expect((await q(`select public.username_available('no') as v`))[0].v).toBe(false); // too short
    });
  });

  it("username → email lookup is server-only (service role)", async () => {
    await as("anon", null, async () => {
      await expect(q(`select public.auth_email_for_username('yoyo_trip')`)).rejects.toThrow(/permission denied/);
    });
    await as("authenticated", B, async () => {
      await expect(q(`select public.auth_email_for_username('yoyo_trip')`)).rejects.toThrow(/permission denied/);
    });
    await as("service_role", null, async () => {
      expect((await q(`select public.auth_email_for_username('Yoyo_Trip') as e`))[0].e).toBe("a@example.com");
    });
  });
});

describe("trip budget data", () => {
  it("stores new trip fields with validation", async () => {
    await as("authenticated", A, async () => {
      await q(
        `insert into public.user_trips (id, user_id, name, traveler_count, travel_styles, transport_mode, budget)
         values ('22222222-2222-4222-8222-222222222222',$1,'Nan 3 days',4,'{nature,food}','car',12000)`,
        [A],
      );
      await expect(
        q(`insert into public.user_trips (user_id, name, traveler_count) values ($1,'x',0)`, [A]),
      ).rejects.toThrow(/extra_checks/);
      await q(
        `insert into public.user_trip_items (trip_id, user_id, place_id, start_time, end_time, cost_category, estimated_cost)
         values ('22222222-2222-4222-8222-222222222222',$1,'wd-Q1','09:00','10:30','activity',100)`,
        [A],
      );
      await expect(
        q(`update public.user_trip_items set start_time = '11:00', end_time = '10:00' where user_id = $1`, [A]),
      ).rejects.toThrow(/extra_checks/);
      await q(
        `insert into public.user_trip_expenses (trip_id, user_id, category, label, amount, cost_type)
         values ('22222222-2222-4222-8222-222222222222',$1,'transport','Fuel',1500,'estimated')`,
        [A],
      );
      expect(await q("select * from public.user_trip_expenses")).toHaveLength(1);
    });
  });

  it("expenses are private and cannot be attached to someone else's trip", async () => {
    await as("authenticated", B, async () => {
      expect(await q("select * from public.user_trip_expenses")).toHaveLength(0);
      await expect(
        q(
          `insert into public.user_trip_expenses (trip_id, user_id, category, label, amount)
           values ('22222222-2222-4222-8222-222222222222',$1,'other','x',1)`,
          [B],
        ),
      ).rejects.toThrow(/row-level security/);
    });
    await as("anon", null, async () => {
      await expect(q("select * from public.user_trip_expenses")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("delete_my_account", () => {
  it("is not available to anonymous users", async () => {
    await as("anon", null, async () => {
      await expect(q("select public.delete_my_account()")).rejects.toThrow(/permission denied/);
    });
  });

  it("deletes only the caller and cascades their private data", async () => {
    await as("authenticated", A, async () => {
      await q("select public.delete_my_account()");
    });
    expect(await q(`select id from auth.users where id = $1`, [A])).toHaveLength(0);
    expect(await q(`select id from public.profiles where id = $1`, [A])).toHaveLength(0);
    expect(await q(`select id from public.user_trips where user_id = $1`, [A])).toHaveLength(0);
    expect(await q(`select id from public.user_trip_expenses where user_id = $1`, [A])).toHaveLength(0);
    // other users untouched
    expect(await q(`select id from public.user_trips where user_id = $1`, [OLD])).toHaveLength(1);
    expect(await q(`select id from public.profiles where id = $1`, [B])).toHaveLength(1);
  });
});
