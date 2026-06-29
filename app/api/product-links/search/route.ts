import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  PRODUCT_RESULT_SCHEMA,
  PRODUCT_SEARCH_SYSTEM_PROMPT,
  collectEvidenceUrls,
  getResponseText,
  isAllowedProductUrl,
  sameProductUrl,
  type ProductSearchInput,
  type ProductSearchResult,
} from "@/lib/product-link-search";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_DESCRIPTION_LENGTH = 2_000;

function finitePositive(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function cleanInput(value: unknown): ProductSearchInput | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const descriptionEs = String(body.descriptionEs ?? "")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
  const descriptionEn = String(body.descriptionEn ?? "")
    .trim()
    .slice(0, MAX_DESCRIPTION_LENGTH);
  const originalUrl = String(body.originalUrl ?? "").trim();
  const totalUnits = finitePositive(body.totalUnits);
  const expectedPrice = finitePositive(body.expectedPrice);

  if (
    (!descriptionEs && !descriptionEn) ||
    !totalUnits ||
    !expectedPrice ||
    !isAllowedProductUrl(originalUrl)
  ) {
    return null;
  }

  return {
    descriptionEs,
    descriptionEn,
    originalUrl,
    totalUnits,
    expectedPrice,
  };
}

function normalizeResult(
  raw: ProductSearchResult,
  input: ProductSearchInput,
  evidenceUrls: string[],
): ProductSearchResult {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map(String).slice(0, 8)
    : [];
  const directUrlIsValid =
    raw.found && isAllowedProductUrl(raw.newUrl, raw.source);
  const hasEvidence =
    directUrlIsValid &&
    evidenceUrls.some((evidenceUrl) => sameProductUrl(evidenceUrl, raw.newUrl));
  const minOrder =
    typeof raw.minOrder === "number" && Number.isFinite(raw.minOrder)
      ? raw.minOrder
      : null;
  const moqIsValid = minOrder === null || minOrder <= input.totalUnits;

  if (!directUrlIsValid) {
    warnings.unshift("No se pudo validar un enlace directo de producto.");
  }
  if (directUrlIsValid && !hasEvidence) {
    warnings.unshift(
      "El enlace propuesto no apareció entre las fuentes consultadas y fue descartado.",
    );
  }
  if (directUrlIsValid && !moqIsValid) {
    warnings.unshift(
      `El MOQ (${minOrder}) supera la cantidad solicitada (${input.totalUnits}).`,
    );
  }

  const unitPrice =
    typeof raw.unitPrice === "number" && Number.isFinite(raw.unitPrice)
      ? raw.unitPrice
      : null;
  const calculatedDifference =
    unitPrice === null
      ? null
      : Math.round(
          (Math.abs(unitPrice - input.expectedPrice) / input.expectedPrice) *
            10_000,
        ) / 100;
  const configuredMaxDifference = finitePositive(
    process.env.PRODUCT_MAX_PRICE_DIFFERENCE_PERCENT,
  );
  const maxDifference = configuredMaxDifference ?? 35;
  const priceIsClose =
    calculatedDifference !== null && calculatedDifference <= maxDifference;

  if (unitPrice === null) {
    warnings.push("No fue posible verificar el precio unitario para la cantidad.");
  } else if (!priceIsClose) {
    warnings.push(
      `La diferencia de precio (${calculatedDifference}%) supera el máximo recomendado (${maxDifference}%).`,
    );
  }

  const proposedConfidence = Math.max(
    0,
    Math.min(100, Math.round(Number(raw.confidence) || 0)),
  );

  return {
    found: Boolean(directUrlIsValid && hasEvidence && moqIsValid),
    newUrl: directUrlIsValid && hasEvidence && moqIsValid ? raw.newUrl : "",
    source:
      directUrlIsValid && hasEvidence && moqIsValid ? raw.source : "None",
    productTitle: String(raw.productTitle ?? ""),
    unitPrice,
    currency: String(raw.currency || "USD"),
    minOrder,
    quantityRange: String(raw.quantityRange ?? ""),
    priceDifferencePercent: calculatedDifference,
    confidence:
      directUrlIsValid && hasEvidence && moqIsValid
        ? priceIsClose
          ? proposedConfidence
          : Math.min(proposedConfidence, 49)
        : 0,
    matchSummary: String(raw.matchSummary ?? ""),
    warnings,
    alternatives: Array.isArray(raw.alternatives)
      ? raw.alternatives
          .filter((item) => isAllowedProductUrl(item.url, item.source))
          .slice(0, 3)
      : [],
    evidenceUrls,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Sesión no autorizada." }, { status: 401 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta configurar OPENAI_API_KEY en el servidor." },
        { status: 503 },
      );
    }

    const input = cleanInput(await request.json());
    if (!input) {
      return NextResponse.json(
        {
          error:
            "Fila inválida. Verifica descripciones, TOTAL UNIT, PRICE y el enlace original.",
        },
        { status: 400 },
      );
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.PRODUCT_SEARCH_MODEL || "gpt-5.4-mini",
        reasoning: { effort: "medium" },
        tools: [
          {
            type: "web_search",
            search_context_size: "high",
            filters: {
              allowed_domains: ["alibaba.com", "made-in-china.com"],
            },
          },
        ],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        input: [
          { role: "system", content: PRODUCT_SEARCH_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify(
              {
                DESCRIPTION_NUEVA_ESPANOL: input.descriptionEs,
                DESCRIPTION_NUEVA_INGLES: input.descriptionEn,
                TOTAL_UNIT: input.totalUnits,
                PRICE_USD: input.expectedPrice,
                LINK_ORIGINAL: input.originalUrl,
              },
              null,
              2,
            ),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "product_link_result",
            strict: true,
            schema: PRODUCT_RESULT_SCHEMA,
          },
        },
        max_output_tokens: 2_500,
      }),
      signal: AbortSignal.timeout(110_000),
    });

    const payload = (await openAiResponse.json()) as Record<string, unknown>;
    if (!openAiResponse.ok) {
      const apiError = payload.error as { message?: string } | undefined;
      console.error("[product-links/search] OpenAI error", payload);
      return NextResponse.json(
        { error: apiError?.message || "OpenAI no pudo completar la búsqueda." },
        { status: openAiResponse.status >= 500 ? 502 : openAiResponse.status },
      );
    }

    const text = getResponseText(payload);
    if (!text) {
      return NextResponse.json(
        { error: "La búsqueda terminó sin un resultado estructurado." },
        { status: 502 },
      );
    }

    let rawResult: ProductSearchResult;
    try {
      rawResult = JSON.parse(text) as ProductSearchResult;
    } catch {
      return NextResponse.json(
        { error: "OpenAI devolvió un resultado que no pudo interpretarse." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      normalizeResult(rawResult, input, collectEvidenceUrls(payload)),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en la búsqueda.";
    console.error("[product-links/search]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
