/**
 * lib/guru/guruChat.ts
 * Port de guru_scraper.py (Python/Flask) → TypeScript/Next.js
 * Token: ROPC → AuthCode HTTP → Playwright headless → env var fallback
 */

const GURU_API    = "https://api.guruaranceles.com";
const AUTH_ORIGIN = "https://auth.guruaranceles.com";
const TOKEN_URL   = AUTH_ORIGIN + "/o/token/";
const OAUTH_CLIENT_ID = "VRcNhdjfPODy2rB3xudYPHqE4dAYNEuwAUlmWc8z";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

// Token en memoria — persiste entre requests en el mismo proceso
let _token     = process.env.GURU_BEARER_TOKEN ?? "";
let _expiresAt = _token ? Date.now() + 86_400_000 : 0;

// ─── Cookie helper ────────────────────────────────────────────────────────────

function mergeCookies(headers: Headers, existing = ""): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0) map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  // getSetCookie() disponible en Node 18.14+ / undici 5+
  const setCookies: string[] =
    typeof (headers as any).getSetCookie === "function"
      ? (headers as any).getSetCookie()
      : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);

  for (const sc of setCookies) {
    const main = sc.split(";")[0];
    const eq = main.indexOf("=");
    if (eq > 0) map.set(main.slice(0, eq).trim(), main.slice(eq + 1).trim());
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ─── Método 1: ROPC ───────────────────────────────────────────────────────────

async function tryRopc(): Promise<string | null> {
  const email = process.env.GURU_EMAIL;
  const pass  = process.env.GURU_PASSWORD;
  if (!email || !pass) return null;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: new URLSearchParams({
        grant_type: "password",
        username: email,
        password: pass,
        client_id: OAUTH_CLIENT_ID,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.access_token) { console.log("[GURU] ROPC OK"); return d.access_token; }
    }
    console.log("[GURU] ROPC falló:", res.status);
  } catch (e) { console.log("[GURU] ROPC error:", e); }
  return null;
}

// ─── Método 2: Authorization Code via HTTP (sin browser) ─────────────────────

async function tryAuthCode(): Promise<string | null> {
  const email = process.env.GURU_EMAIL;
  const pass  = process.env.GURU_PASSWORD;
  if (!email || !pass) return null;

  const AUTH_NEXT = `/o/authorize/?client_id=${OAUTH_CLIENT_ID}&state=abc&response_type=code`;
  const LOGIN_URL = `${AUTH_ORIGIN}/accounts/login/?next=${AUTH_NEXT}`;

  try {
    // 1) GET login page → CSRF + cookies
    const r1 = await fetch(LOGIN_URL, {
      headers: { "User-Agent": UA },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await r1.text();
    let cookies = mergeCookies(r1.headers);

    const csrfMatch = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
    if (!csrfMatch) { console.log("[GURU] AuthCode: sin CSRF token"); return null; }
    const csrf = csrfMatch[1];
    const jump = html.match(/name="jump_sessions"\s+value="([^"]*)"/)?.[1] ?? "";

    // 2) POST login
    const r2 = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": LOGIN_URL,
        "Cookie": cookies,
      },
      body: new URLSearchParams({
        csrfmiddlewaretoken: csrf,
        username: email,
        password: pass,
        next: AUTH_NEXT,
        jump_sessions: jump,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
    });
    cookies = mergeCookies(r2.headers, cookies);
    let location = r2.headers.get("location") ?? "";

    // 3) Seguir redirects buscando ?code=
    for (let i = 0; i < 12; i++) {
      if (!location) break;

      const codeMatch = location.match(/[?&]code=([^&\s]+)/);
      if (codeMatch) {
        const code = codeMatch[1];
        const redirectBase = location.split("?")[0];
        const r3 = await fetch(TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookies,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: redirectBase,
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (r3.ok) {
          const d = await r3.json();
          if (d.access_token) { console.log("[GURU] AuthCode OK"); return d.access_token; }
        }
        console.log("[GURU] AuthCode exchange falló:", r3.status);
        break;
      }

      if (location.startsWith("/")) location = AUTH_ORIGIN + location;
      const rn = await fetch(location, {
        headers: { "User-Agent": UA, "Cookie": cookies },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      cookies  = mergeCookies(rn.headers, cookies);
      location = rn.headers.get("location") ?? "";
    }

    console.log("[GURU] AuthCode: no se encontró code en redirects");
  } catch (e) { console.log("[GURU] AuthCode error:", e); }
  return null;
}

// ─── Método 3: Playwright headless (mismo flujo que Python) ──────────────────

async function tryPlaywright(): Promise<string | null> {
  const email = process.env.GURU_EMAIL;
  const pass  = process.env.GURU_PASSWORD;
  if (!email || !pass) return null;

  try {
    // Import dinámico — no falla si playwright no está instalado
    const { chromium } = await import("playwright");

    const AUTH_NEXT = `/o/authorize/?client_id=${OAUTH_CLIENT_ID}&state=random_state_string&response_type=code`;
    const AUTH_URL  = `${AUTH_ORIGIN}/accounts/login/?next=${AUTH_NEXT}`;

    let capturedToken: string | null = null;

    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();

    page.on("request", (req) => {
      const auth = req.headers()["authorization"] ?? "";
      if (auth.toLowerCase().startsWith("bearer ") && auth.length > 20) {
        capturedToken = auth.slice(7);
      }
    });

    await page.goto(AUTH_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(2000);

    for (const sel of ["input[name='username']", "input[type='email']"]) {
      try { await page.fill(sel, email, { timeout: 4000 }); break; } catch {}
    }
    for (const sel of ["input[name='password']", "input[type='password']"]) {
      try { await page.fill(sel, pass, { timeout: 4000 }); break; } catch {}
    }

    // Paso 1: click Ingresar (JS valida credenciales, puede abrir modal)
    await page.click("#loginForm button", { timeout: 5000 });
    console.log("[GURU] PW: paso 1 Ingresar OK");

    // Paso 2: si hay sesión activa aparece modal
    try {
      await page.waitForSelector("#closeSessionButton", { state: "visible", timeout: 8000 });
      await page.click("#closeSessionButton", { timeout: 5000 });
      console.log("[GURU] PW: paso 2 modal sesión OK");
    } catch {
      console.log("[GURU] PW: sin modal de sesión");
    }

    // Esperar que el SPA haga requests Bearer
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      if (capturedToken) break;
    }

    console.log("[GURU] PW url final:", page.url());
    await browser.close();

    if (capturedToken) console.log("[GURU] PW OK:", capturedToken.slice(0, 20) + "...");
    return capturedToken;
  } catch (e) {
    console.log("[GURU] PW error:", e);
    return null;
  }
}

// ─── Renovar token: ROPC → AuthCode → Playwright → fallback env var ──────────

async function refreshToken(): Promise<string> {
  console.log("[GURU] Renovando token...");
  let tok = await tryRopc();
  if (!tok) tok = await tryAuthCode();
  if (!tok) tok = await tryPlaywright();
  if (tok) {
    _token = tok;
    _expiresAt = Date.now() + 3_600_000;
    console.log("[GURU] Token renovado:", tok.slice(0, 20) + "...");
    return tok;
  }
  console.log("[GURU] No se pudo renovar, usando token anterior");
  return _token;
}

async function getToken(): Promise<string> {
  if (_token && Date.now() < _expiresAt - 300_000) return _token;
  return refreshToken();
}

async function apiGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const token = await getToken();
  const url = new URL(GURU_API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 401) {
    _expiresAt = 0;
    const t2 = await getToken();
    res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${t2}` },
      signal: AbortSignal.timeout(15_000),
    });
  }

  if (!res.ok) throw new Error(`Guru API ${res.status} en ${path}`);
  return res.json();
}

function formatSummary(digits: string): string {
  const d = digits.replace(/\./g, "");
  if (d.length >= 6) return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}`;
  if (d.length >= 4) return `${d.slice(0, 2)}.${d.slice(2, 4)}`;
  return d.slice(0, 2);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GuruItem {
  tariff_code: string;
  tariff_hash: string;
  description: string;
  tributos?: Record<string, string | null>;
  detalle?: { seccion: string; capitulo: string; nota_explicativa: string };
  acuerdos?: Agreement[];
  restriccion?: Restriction;
}

export interface Agreement {
  iso2: string;
  country: string;
  agr_code: string;
  to_pay: string | null;
  year_range: string;
}

export interface Restriction {
  restricciones: Array<{ entity: string; document_type: string; observation: string }>;
  inen: Array<{ code: string; title: string }>;
  tiene_alguna: boolean;
}

// ─── searchGuru ───────────────────────────────────────────────────────────────

export async function searchGuru(hsDigits: string): Promise<GuruItem[]> {
  const clean = hsDigits.replace(/\./g, "").slice(0, 8);

  const summaries: string[] = [];
  if (clean.length >= 6) summaries.push(formatSummary(clean.slice(0, 6)));
  if (clean.length >= 4) summaries.push(formatSummary(clean.slice(0, 4)));
  if (clean.slice(0, 2)) summaries.push(clean.slice(0, 2));

  for (const summary of summaries) {
    try {
      const raw = await apiGet("/tariffs/tariff/list/EC/", {
        page: "1",
        summary,
        from: "EC",
        tracking_id: "cesch-platform",
      });

      const arr: any[] = Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? []);
      if (!arr.length) continue;

      let leaves = arr.filter((x: any) => x.apply_info && x.linkable);
      if (!leaves.length) leaves = arr.filter((x: any) => x.apply_info);
      if (!leaves.length) leaves = arr;

      const seen = new Set<string>();
      const out: GuruItem[] = [];
      for (const item of leaves) {
        const key = (item.tariff_code ?? item.format ?? "").split("-")[0].trim();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            tariff_code: item.tariff_code ?? "",
            tariff_hash: item.tariff_hash ?? "",
            description: item.description ?? "",
          });
        }
      }

      if (out.length) return out;
    } catch (e) {
      console.error("[searchGuru]", summary, e);
    }
  }

  return [];
}

// ─── Enriquecer items ─────────────────────────────────────────────────────────

async function getCharges(hash: string): Promise<Record<string, string | null>> {
  try {
    const list: any[] = await apiGet("/tariffs/charges/EC/", { tariff: hash });
    const result: Record<string, string | null> = {};
    for (const c of Array.isArray(list) ? list : []) {
      const rawName: string = c.tax?.name ?? "";
      const cleanName = rawName.replace(/\s*\*+$/, "").trim();
      const val = c.value;
      if (cleanName === "ARANCEL ESPECIFICO") {
        result["ARANCEL ESPECIFICO"] = val && val !== "-" ? val : null;
      } else if (val && val !== "-") {
        result[rawName] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function getDetail(hash: string) {
  try {
    const data = await apiGet("/tariffs/tariff/detail/EC/", { tariff_hash: hash });
    return {
      seccion: data?.chapter?.section?.title ?? "",
      capitulo: data?.chapter?.title ?? "",
      nota_explicativa: data?.explanatory_note?.note ?? "",
    };
  } catch {
    return null;
  }
}

async function getAgreements(hash: string): Promise<Agreement[]> {
  try {
    const raw = await apiGet("/tariffs/agreements/EC/", { tariff: hash });
    const arr: any[] = Array.isArray(raw) ? raw : (raw.results ?? raw.data ?? []);

    const seen = new Map<string, Agreement>();
    for (const a of arr) {
      const country = a.agreement_country ?? {};
      const iso2: string = country.cod_iso2 ?? "?";
      const entry: Agreement = {
        iso2,
        country: country.name ?? iso2,
        agr_code: a.agreement?.code ?? "",
        to_pay: a.to_pay != null ? String(a.to_pay) : null,
        year_range: [
          a.effective_start_date?.slice(0, 4),
          a.effective_end_date?.slice(0, 4),
        ]
          .filter(Boolean)
          .join("–"),
      };
      if (!seen.has(iso2) || (entry.to_pay !== null && seen.get(iso2)?.to_pay === null)) {
        seen.set(iso2, entry);
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      if (a.iso2 === "CN") return -1;
      if (b.iso2 === "CN") return 1;
      return a.country.localeCompare(b.country);
    });
  } catch {
    return [];
  }
}

async function getRestrictions(hash: string): Promise<Restriction | null> {
  try {
    const data = await apiGet("/tariffs/restrictions/EC/", { tariff: hash });
    const restrList = (data.restrictions ?? []).map((r: any) => ({
      entity: r.entity?.description ?? "",
      document_type: r.document_type ?? "",
      observation: r.observation ?? "",
    }));
    const inenList = (data.rte_inens ?? []).map((i: any) => ({
      code: i.rte_inen ?? i.code ?? "",
      title: i.title ?? i.description ?? "",
    }));
    return {
      restricciones: restrList,
      inen: inenList,
      tiene_alguna: !!(
        restrList.length ||
        inenList.length ||
        data.inen_restrictions_vue?.length ||
        data.inen_restrictions_ecuapass?.length
      ),
    };
  } catch {
    return null;
  }
}

export async function enrichGuruItems(items: GuruItem[]): Promise<void> {
  await Promise.all(
    items.slice(0, 3).map(async (item) => {
      if (!item.tariff_hash) return;
      const [charges, detail, agreements, restriction] = await Promise.allSettled([
        getCharges(item.tariff_hash),
        getDetail(item.tariff_hash),
        getAgreements(item.tariff_hash),
        getRestrictions(item.tariff_hash),
      ]);
      if (charges.status === "fulfilled" && Object.keys(charges.value).length)
        item.tributos = charges.value;
      if (detail.status === "fulfilled" && detail.value)
        item.detalle = detail.value;
      if (agreements.status === "fulfilled" && agreements.value.length)
        item.acuerdos = agreements.value;
      if (restriction.status === "fulfilled" && restriction.value)
        item.restriccion = restriction.value;
    })
  );
}

// ─── Filter by numeric specs (port de _filter_by_specs) ───────────────────────

export interface UserSpecs {
  kw?: number;
  percent?: number;
  cc?: number;
  kg?: number;
}

export function extractUserSpecs(messages: { role: string; content: string }[]): UserSpecs {
  const text = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const specs: UserSpecs = {};

  for (const [val, unit] of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kw|kva|hp)\b/gi)) {
    const v = parseFloat(val.replace(",", "."));
    const u = unit.toLowerCase();
    if (!specs.kw) specs.kw = u === "hp" ? +(v * 0.7457).toFixed(4) : v;
  }

  for (const [val] of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|por\s+ciento)\b/gi)) {
    if (!specs.percent) specs.percent = parseFloat(val.replace(",", "."));
  }

  for (const [val] of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:cc|cm3|cm³)\b/gi)) {
    if (!specs.cc) specs.cc = parseFloat(val.replace(",", "."));
  }

  for (const [val, unit] of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|toneladas?|ton)\b/gi)) {
    if (!specs.kg) {
      const v = parseFloat(val.replace(",", "."));
      specs.kg = unit.toLowerCase().startsWith("ton") ? v * 1000 : v;
    }
  }

  return specs;
}

export function filterBySpecs(items: GuruItem[], specs: UserSpecs): GuruItem[] {
  if (!Object.keys(specs).length) return items;

  const UNIT_PATS: Record<keyof UserSpecs, RegExp> = {
    kw: /(kw|kva|w)\b/i,
    percent: /(%)/,
    cc: /(cc|cm3|cm³)\b/i,
    kg: /(kg|toneladas?|ton)\b/i,
  };

  function toBase(val: string, unit: string): number {
    const v = parseFloat(val.replace(",", "."));
    const u = unit.toLowerCase().replace(/s$/, "");
    if (u === "w") return v / 1000;
    if (u === "ton" || u === "tonelada") return v * 1000;
    return v;
  }

  function compatible(desc: string): boolean {
    const d = desc.toLowerCase();
    for (const [key, userVal] of Object.entries(specs) as [keyof UserSpecs, number][]) {
      const upat = UNIT_PATS[key];
      if (!upat) continue;

      const lePattern = new RegExp(
        `inferior\\s+o\\s+igual\\s+al?\\s+(\\d+(?:[.,]\\d+)?)\\s*${upat.source}`,
        "gi"
      );
      for (const m of d.matchAll(lePattern)) {
        if (userVal > toBase(m[1], m[2])) return false;
      }

      const ltPattern = new RegExp(
        `inferior\\s+(?!o\\s+igual)al?\\s+(\\d+(?:[.,]\\d+)?)\\s*${upat.source}`,
        "gi"
      );
      for (const m of d.matchAll(ltPattern)) {
        if (userVal >= toBase(m[1], m[2])) return false;
      }

      const gtPattern = new RegExp(
        `superior\\s+(?!o\\s+igual)a\\s+(\\d+(?:[.,]\\d+)?)\\s*${upat.source}`,
        "gi"
      );
      for (const m of d.matchAll(gtPattern)) {
        if (userVal <= toBase(m[1], m[2])) return false;
      }

      const gePattern = new RegExp(
        `superior\\s+o\\s+igual\\s+al?\\s+(\\d+(?:[.,]\\d+)?)\\s*${upat.source}`,
        "gi"
      );
      for (const m of d.matchAll(gePattern)) {
        if (userVal < toBase(m[1], m[2])) return false;
      }
    }
    return true;
  }

  const filtered = items.filter((it) => compatible(it.description));
  return filtered.length ? filtered : items;
}
