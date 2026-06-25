/**
 * app/api/guru/partidas/route.ts
 *
 * Endpoint interno: POST /api/guru/partidas
 *
 * Body:
 *   { "hs6": "850110", "descripcion": "motor corriente continua 39kW" }
 *
 * Response:
 *   {
 *     "partidas": [...],
 *     "fuente": "cache" | "api",
 *     "total": 5
 *   }
 *
 * Este endpoint NUNCA expone el token de Guru al frontend.
 * El token vive solo en variables de entorno del servidor.
 */

import { NextResponse } from "next/server";
import { buscarPartidas } from "@/lib/guru/guruAranceles";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hs6, descripcion } = body as {
      hs6?: string;
      descripcion?: string;
    };

    // ── Validación ──────────────────────────────────────────────────────────
    if (!hs6 || hs6.trim().length < 4) {
      return NextResponse.json(
        { error: "Se requiere un código HS de al menos 4 dígitos (ej: 8501)" },
        { status: 400 }
      );
    }

    const prefijoLimpio = hs6.replace(/[\.\s]/g, "").slice(0, 6);

    // ── Buscar partidas ─────────────────────────────────────────────────────
    const resultado = await buscarPartidas(prefijoLimpio);

    return NextResponse.json({
      ok: true,
      partidas: resultado.partidas,
      fuente: resultado.fuente,
      prefijo: resultado.prefijo_buscado,
      total: resultado.partidas.length,
    });
  } catch (error: any) {
    console.error("[/api/guru/partidas] Error:", error?.message);

    // Distinguir errores conocidos para dar mensajes útiles
    if (error?.message?.includes("401") || error?.message?.includes("Token")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Token de Guru Aranceles inválido o expirado",
          detalle: "Actualiza GURU_BEARER_TOKEN en las variables de entorno",
        },
        { status: 503 }
      );
    }

    if (error?.message?.includes("GURU_BEARER_TOKEN no configurado")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Guru Aranceles no está configurado",
          detalle: "Agrega GURU_BEARER_TOKEN a las variables de entorno",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Error al consultar Guru Aranceles",
        detalle: error?.message ?? "Error desconocido",
      },
      { status: 500 }
    );
  }
}

// ── GET: verificar estado del servicio ──────────────────────────────────────

export async function GET() {
  const tokenConfigurado = !!process.env.GURU_BEARER_TOKEN;

  let cacheStats = { total: 0, error: null as string | null };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { count } = await supabase
      .from("guru_partidas_cache")
      .select("*", { count: "exact", head: true });
    cacheStats.total = count ?? 0;
  } catch (e: any) {
    cacheStats.error = e?.message;
  }

  return NextResponse.json({
    ok: true,
    estado: {
      token_configurado: tokenConfigurado,
      cache_registros: cacheStats.total,
      cache_error: cacheStats.error,
    },
  });
}