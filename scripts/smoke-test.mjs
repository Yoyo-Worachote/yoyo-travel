// HTTP smoke test against a running server (default http://localhost:3000).
// Usage: npm run build && npm start   (in another terminal)
//        npm run test:smoke  [BASE_URL=https://your-deployment]
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}\n    ${e.message}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const get = (path, headers = {}) => fetch(BASE + path, { headers, redirect: "manual" });
const html = async (path, headers) => {
  const res = await get(path, headers);
  return { res, body: await res.text() };
};

console.log(`Smoke testing ${BASE}`);

await check("home loads in Thai by default", async () => {
  const { res, body } = await html("/");
  assert(res.status === 200, `status ${res.status}`);
  assert(body.includes('<html lang="th"'), "html lang is not th");
  assert(body.includes("สำรวจประเทศไทย"), "Thai nav missing");
});

await check("English via NEXT_LOCALE cookie", async () => {
  const { res, body } = await html("/", { cookie: "NEXT_LOCALE=en" });
  assert(res.status === 200, `status ${res.status}`);
  assert(body.includes('<html lang="en"'), "html lang is not en");
  assert(body.includes("Explore Thailand"), "English nav missing");
});

await check("security headers are set", async () => {
  const res = await get("/");
  for (const h of ["content-security-policy", "x-content-type-options", "referrer-policy", "x-frame-options"]) {
    assert(res.headers.get(h), `missing ${h}`);
  }
});

await check("explore page + boundary GeoJSON (77 provinces)", async () => {
  assert((await get("/explore")).status === 200, "explore not 200");
  const geo = await (await get("/geo/thailand-provinces.geojson")).json();
  assert(geo.features.length === 77, `features: ${geo.features.length}`);
});

for (const [path, text] of [
  ["/thailand/chiang-mai", "เชียงใหม่"],
  ["/thailand/bangkok", "กรุงเทพมหานคร"],
  ["/thailand/narathiwat", "นราธิวาส"],
]) {
  await check(`province route ${path}`, async () => {
    const { res, body } = await html(path);
    assert(res.status === 200, `status ${res.status}`);
    assert(body.includes(text), `missing ${text}`);
  });
}

await check("province route in English", async () => {
  const { body } = await html("/thailand/chiang-mai", { cookie: "NEXT_LOCALE=en" });
  assert(body.includes("Places in Chiang Mai"), "English province heading missing");
});

await check("unknown province → 404", async () => {
  assert((await get("/thailand/atlantis")).status === 404, "expected 404");
});

await check("place route with source + attribution", async () => {
  const search = await (await get("/api/search?q=Doi%20Inthanon&limit=1")).json();
  const p = search.places[0];
  assert(p, "no search result");
  const { res, body } = await html(`/thailand/${p.provinceSlug}/${p.slug}`);
  assert(res.status === 200, `status ${res.status}`);
  assert(body.includes("wikidata.org/wiki/"), "source link missing");
  if (p.image) assert(body.includes("commons.wikimedia.org/wiki/File:"), "image attribution missing");
});

await check("search API (Thai + English)", async () => {
  const th = await (await get(`/api/search?q=${encodeURIComponent("ภูเก็ต")}`)).json();
  assert(th.provinces[0]?.slug === "phuket", "Thai province search failed");
  const en = await (await get("/api/search?q=phuket")).json();
  assert(en.provinces[0]?.slug === "phuket", "English province search failed");
  assert((await get("/api/search?q=" + "x".repeat(200))).status === 400, "long query not rejected");
});

await check("random API respects filters and returns real records", async () => {
  const r = await (
    await fetch(`${BASE}/api/random`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "province", regions: ["south"], interests: ["beach"] }),
    })
  ).json();
  assert(r.result?.province?.region === "south", "not a southern province");
  const place = await (
    await fetch(`${BASE}/api/random`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "place", provinceSlug: "nan" }),
    })
  ).json();
  assert(place.result?.place?.provinceSlug === "nan", "place not in Nan");
  const ids = await (await get(`/api/places?ids=${place.result.place.id}`)).json();
  assert(ids.places.length === 1, "random place id is not a real record");
});

await check("chat API: validates input and is honest without credentials", async () => {
  const bad = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert(bad.status === 400, `invalid body → ${bad.status}`);
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "วัดในเชียงใหม่" }], locale: "th" }),
  });
  const json = await res.json();
  assert(["ok", "not_configured", "provider_error"].includes(json.status), `status ${json.status}`);
  for (const s of json.sources) {
    if (s.kind === "internal") assert(s.url.startsWith("/thailand/"), `bad internal url ${s.url}`);
  }
  if (json.status === "not_configured") assert(json.webSearched === false, "claimed web search without provider");
});

await check("admin is protected", async () => {
  const res = await get("/admin");
  if (res.status === 307 || res.status === 308) {
    assert((res.headers.get("location") ?? "").includes("/login"), "redirect is not to login");
  } else {
    const body = await res.text();
    assert(!body.includes("admin.addPlace") && !body.includes('name="sourceUrl"'), "admin form rendered for anonymous user");
  }
});

await check("private pages are noindex", async () => {
  const { body } = await html("/passport");
  assert(body.includes('name="robots" content="noindex'), "passport not noindex");
});

console.log(failures ? `\n${failures} check(s) failed` : "\nAll smoke checks passed");
process.exit(failures ? 1 : 0);
