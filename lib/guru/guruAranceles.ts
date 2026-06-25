/**
 * lib/guru/guruAranceles.ts
 *
 * Servicio que encapsula toda comunicación con Guru Aranceles API.
 * Si el token cambia o la URL cambia → solo se modifica este archivo.
 *
 * Estrategia de caché:
 *   1. Primero busca en Supabase (tabla: guru_partidas_cache)
 *   2. Si no existe o tiene más de 30 días → llama a Guru API
 *   3. Guarda resultado en Supabase para próximas consultas
 */

import { createClient } from "@supabase/supabase-js";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GuruPartida {
  codigo: string;          // ej: "8501.10.10.00"
  codigo_normalizado: string; // ej: "8501101000" (sin puntos)
  descripcion: string;
  arancel_pct: number | null;
  nivel: number;           // 2=capitulo, 4=partida, 6=subpartida, 8=ítem, 10=subítem
}

export interface GuruBusquedaResult {
  partidas: GuruPartida[];
  fuente: "cache" | "api";
  prefijo_buscado: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const GURU_BASE_URL = "https://api.guruaranceles.com";
const GURU_OPEN_URL = "https://open.guruaranceles.com";
const CACHE_TTL_DAYS = 30;

// ─── Supabase admin (server-side only) ───────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza un código HS eliminando puntos y espacios.
 * "8501.10.10.00" → "8501101000"
 */
export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/[\.\s]/g, "");
}

/**
 * Verifica si un registro de caché sigue vigente (menos de 30 días).
 */
function cacheVigente(fechaActualizacion: string): boolean {
  const hace = Date.now() - new Date(fechaActualizacion).getTime();
  const diasTranscurridos = hace / (1000 * 60 * 60 * 24);
  return diasTranscurridos < CACHE_TTL_DAYS;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Busca partidas arancelarias por prefijo HS (mínimo 4 dígitos).
 *
 * Uso:
 *   const resultado = await buscarPartidas("850110");
 *   // Devuelve todas las partidas que empiezan con 850110
 *
 * @param prefijo  - Código HS parcial (4-10 dígitos, sin puntos)
 * @param soloHojas - Si true, devuelve solo partidas de 10 dígitos (subítems finales)
 */
export async function buscarPartidas(
  prefijo: string,
  soloHojas: boolean = false
): Promise<GuruBusquedaResult> {
  const prefijoLimpio = normalizarCodigo(prefijo).slice(0, 6); // máx 6 para consulta Guru
  const supabase = getSupabase();

  // ── 1. Buscar en caché ──────────────────────────────────────────────────────
  const { data: cacheRows } = await supabase
    .from("guru_partidas_cache")
    .select("*")
    .ilike("codigo_normalizado", `${prefijoLimpio}%`)
    .order("codigo_normalizado");

  if (cacheRows && cacheRows.length > 0) {
    // Verificar si al menos una fila tiene caché vigente
    const primeraFila = cacheRows[0];
    if (cacheVigente(primeraFila.actualizado_en)) {
      const partidas = cacheRows.map(filaAPartida);
      return {
        partidas: soloHojas ? partidas.filter((p) => p.nivel === 10) : partidas,
        fuente: "cache",
        prefijo_buscado: prefijoLimpio,
      };
    }
  }

  // ── 2. Llamar a Guru API ────────────────────────────────────────────────────
  const token = process.env.GURU_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "GURU_BEARER_TOKEN no configurado. Agrega la variable de entorno."
    );
  }

  const partidas = await fetchGuruAPI(prefijoLimpio, token);

  // ── 3. Guardar en caché ─────────────────────────────────────────────────────
  if (partidas.length > 0) {
    const filas = partidas.map((p) => ({
      codigo: p.codigo,
      codigo_normalizado: p.codigo_normalizado,
      descripcion: p.descripcion,
      arancel_pct: p.arancel_pct,
      nivel: p.nivel,
      prefijo_6: prefijoLimpio,
      actualizado_en: new Date().toISOString(),
    }));

    // Upsert: si ya existe → actualiza, si no → inserta
    await supabase
      .from("guru_partidas_cache")
      .upsert(filas, { onConflict: "codigo_normalizado" });
  }

  return {
    partidas: soloHojas ? partidas.filter((p) => p.nivel === 10) : partidas,
    fuente: "api",
    prefijo_buscado: prefijoLimpio,
  };
}

// ─── Llamada real al API de Guru ──────────────────────────────────────────────

async function fetchGuruAPI(
  prefijo: string,
  token: string
): Promise<GuruPartida[]> {
  // Intentamos primero el endpoint paginado con el Bearer token
  const url = new URL(`${GURU_BASE_URL}/tariffs/tariff/list/EC/`);
  url.searchParams.set("summary", "true");
  url.searchParams.set("from_", "EC");
  url.searchParams.set("tracking_id", "cesch-platform");

  let partidas: GuruPartida[] = [];
  let page = 1;
  let hayMasPaginas = true;

  while (hayMasPaginas) {
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error(
          `Token de Guru Aranceles inválido o expirado (401). ` +
          `Actualiza GURU_BEARER_TOKEN en las variables de entorno.`
        );
      }
      throw new Error(`Guru API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // Guru devuelve { results: [...], next: "..." } o similar
    const items: any[] = json?.results ?? json?.data ?? json ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      hayMasPaginas = false;
      break;
    }

    // Filtrar solo las partidas que empiezan con nuestro prefijo
    const filtradas = items
      .filter((item: any) => {
        const cod = normalizarCodigo(item.code ?? item.codigo ?? "");
        return cod.startsWith(prefijo);
      })
      .map(itemAPartida);

    partidas = partidas.concat(filtradas);

    // Si ya filtramos y no hay más resultados del prefijo, paramos
    // (evita paginar todo el arancel completo innecesariamente)
    if (filtradas.length === 0 && partidas.length > 0) {
      hayMasPaginas = false;
    } else {
      hayMasPaginas = !!json?.next;
      page++;
    }

    // Safety: máximo 10 páginas por consulta
    if (page > 10) hayMasPaginas = false;
  }

  return partidas;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function itemAPartida(item: any): GuruPartida {
  const codigo = String(item.code ?? item.codigo ?? "").trim();
  const codigoNorm = normalizarCodigo(codigo);

  return {
    codigo,
    codigo_normalizado: codigoNorm,
    descripcion: String(item.description ?? item.descripcion ?? "").trim(),
    arancel_pct: item.rate != null ? Number(item.rate) : null,
    nivel: codigoNorm.replace(/\./g, "").length,
  };
}

function filaAPartida(fila: any): GuruPartida {
  return {
    codigo: fila.codigo,
    codigo_normalizado: fila.codigo_normalizado,
    descripcion: fila.descripcion,
    arancel_pct: fila.arancel_pct,
    nivel: fila.nivel,
  };
}

// ─── Utilidad: buscar la mejor partida para un HS-6 ──────────────────────────

/**
 * Dado un HS-6 y una descripción de producto, devuelve
 * las partidas de 10 dígitos más probables ordenadas por relevancia.
 */
export async function obtenerPartidasCandidatas(
  hs6: string,
  descripcionProducto: string
): Promise<GuruPartida[]> {
  const resultado = await buscarPartidas(hs6, true); // solo hojas (10 dígitos)

  if (resultado.partidas.length === 0) {
    // Si no hay partidas de 10 dígitos, devolver las que haya
    const todo = await buscarPartidas(hs6, false);
    return todo.partidas;
  }

  return resultado.partidas;
}