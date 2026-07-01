import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  PRODUCT_RESULT_SCHEMA,
  collectEvidenceUrls,
  getResponseText,
  isAllowedProductUrl,
  productSearchSystemPrompt,
  sameProductUrl,
  selectBestProductResult,
  type ProductSearchInput,
  type ProductSearchResult,
  type ProductSource,
} from "@/lib/product-link-search";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_DESCRIPTION_LENGTH = 2_000;
const DEFAULT_MODEL = "gpt-4.1-mini";
const SECONDARY_MODEL = "gpt-5.4-mini";

type OpenAiPayload = Record<string, unknown>;

type SearchAttempt =
  | {
      ok: true;
      model: string;
      source: ProductSource;
      payload: OpenAiPayload;
      result: ProductSearchResult;
    }
  | {
      ok: false;
      model: string;
      source: ProductSource;
      payload: OpenAiPayload;
      status: number;
      reason: string;
      retryable: boolean;
    };

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
  expectedSource: ProductSource,
  evidenceUrls: string[],
): ProductSearchResult {
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map(String).slice(0, 8)
    : [];
  const directUrlIsValid =
    raw.found &&
    isAllowedProductUrl(raw.newUrl, expectedSource) &&
    !sameProductUrl(raw.newUrl, input.originalUrl);
  const hasEvidence =
    directUrlIsValid &&
    evidenceUrls.some((evidenceUrl) => sameProductUrl(evidenceUrl, raw.newUrl));
  const minOrder =
    typeof raw.minOrder === "number" && Number.isFinite(raw.minOrder)
      ? raw.minOrder
      : null;
  const moqIsValid = minOrder === null || minOrder <= input.totalUnits;

  if (!directUrlIsValid) {
    warnings.unshift(
      "No se pudo validar un enlace nuevo y directo de producto.",
    );
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
      directUrlIsValid && hasEvidence && moqIsValid ? expectedSource : "None",
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
          .filter(
            (item) =>
              item.source === expectedSource &&
              isAllowedProductUrl(item.url, expectedSource) &&
              !sameProductUrl(item.url, input.originalUrl),
          )
          .slice(0, 3)
      : [],
    evidenceUrls,
  };
}

function providerErrorMessage(payload: OpenAiPayload) {
  const error = payload.error as
    | { message?: unknown; code?: unknown; type?: unknown }
    | undefined;
  const message =
    typeof error?.message === "string" ? error.message : "Error sin detalle";
  const code =
    typeof error?.code === "string"
      ? error.code
      : typeof error?.type === "string"
        ? error.type
        : "";
  return code ? `${message} (${code})` : message;
}

function incompleteReason(payload: OpenAiPayload) {
  const status =
    typeof payload.status === "string" ? payload.status : "desconocido";
  const details = payload.incomplete_details as
    | { reason?: unknown }
    | null
    | undefined;
  const reason =
    typeof details?.reason === "string" ? details.reason : "sin texto de salida";
  return `OpenAI terminó con estado "${status}": ${reason}.`;
}

function requestBody(
  input: ProductSearchInput,
  model: string,
  source: ProductSource,
) {
  const supportsReasoning = /^(gpt-5|o\d)/i.test(model);
  const allowedDomain =
    source === "Alibaba" ? "alibaba.com" : "made-in-china.com";

  return {
    model,
    ...(supportsReasoning ? { reasoning: { effort: "low" } } : {}),
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        filters: {
          allowed_domains: [allowedDomain],
        },
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: productSearchSystemPrompt(source) },
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
    max_output_tokens: 8_000,
  };
}

async function runSearchAttempt(
  input: ProductSearchInput,
  model: string,
  source: ProductSource,
): Promise<SearchAttempt> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody(input, model, source)),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    const reason = isTimeout
      ? `${source}: el modelo ${model} tardó más de 55 segundos.`
      : `${source}: no se pudo conectar con OpenAI (${
          error instanceof Error ? error.message : "error de red"
        }).`;

    if (
      !isTimeout
    ) {
      console.error("[product-links/search] OpenAI network error", error);
    } else {
      console.error("[product-links/search] OpenAI attempt timeout", {
        model,
        source,
        reason,
      });
    }

    return {
      ok: false,
      model,
      source,
      payload: {},
      status: isTimeout ? 504 : 502,
      reason,
      retryable: true,
    };
  }

  const rawBody = await response.text();
  let payload: OpenAiPayload = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as OpenAiPayload) : {};
  } catch {
    payload = { raw_response_preview: rawBody.slice(0, 500) };
  }

  if (!response.ok) {
    const reason = providerErrorMessage(payload);
    console.error("[product-links/search] OpenAI request failed", {
      model,
      source,
      status: response.status,
      requestId: response.headers.get("x-request-id"),
      reason,
    });
    return {
      ok: false,
      model,
      source,
      payload,
      status: response.status,
      reason,
      retryable:
        response.status === 400 ||
        response.status === 404 ||
        response.status >= 500,
    };
  }

  const text = getResponseText(payload);
  if (!text) {
    const reason = incompleteReason(payload);
    console.error("[product-links/search] OpenAI returned no output text", {
      model,
      source,
      requestId: response.headers.get("x-request-id"),
      status: payload.status,
      incompleteDetails: payload.incomplete_details,
      outputTypes: Array.isArray(payload.output)
        ? payload.output.map((item) =>
            item && typeof item === "object" && "type" in item
              ? (item as { type: unknown }).type
              : "unknown",
          )
        : [],
    });
    return {
      ok: false,
      model,
      source,
      payload,
      status: 502,
      reason,
      retryable: true,
    };
  }

  try {
    return {
      ok: true,
      model,
      source,
      payload,
      result: JSON.parse(text) as ProductSearchResult,
    };
  } catch {
    console.error("[product-links/search] Invalid structured output", {
      model,
      source,
      outputPreview: text.slice(0, 500),
    });
    return {
      ok: false,
      model,
      source,
      payload,
      status: 502,
      reason: "OpenAI devolvió un JSON que no pudo interpretarse.",
      retryable: true,
    };
  }
}

async function searchPortal(
  input: ProductSearchInput,
  source: ProductSource,
  primaryModel: string,
  fallbackModel: string,
) {
  let attempt = await runSearchAttempt(input, primaryModel, source);
  if (
    !attempt.ok &&
    attempt.retryable &&
    fallbackModel !== primaryModel
  ) {
    console.warn("[product-links/search] Retrying portal with fallback model", {
      source,
      primaryModel,
      fallbackModel,
      reason: attempt.reason,
    });
    attempt = await runSearchAttempt(input, fallbackModel, source);
  }

  if (!attempt.ok) return { attempt };

  return {
    attempt,
    result: normalizeResult(
      attempt.result,
      input,
      source,
      collectEvidenceUrls(attempt.payload),
    ),
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

    const primaryModel =
      process.env.PRODUCT_SEARCH_MODEL?.trim() || DEFAULT_MODEL;
    const configuredFallback =
      process.env.PRODUCT_SEARCH_FALLBACK_MODEL?.trim() ||
      (primaryModel === DEFAULT_MODEL ? SECONDARY_MODEL : DEFAULT_MODEL);

    const portalSearches = await Promise.all(
      (["Alibaba", "Made-in-China"] as const).map((source) =>
        searchPortal(input, source, primaryModel, configuredFallback),
      ),
    );
    const successfulResults = portalSearches.flatMap((search) =>
      search.result ? [search.result] : [],
    );

    if (!successfulResults.length) {
      const attempts = portalSearches.map((search) => search.attempt);
      const firstAttempt = attempts[0];
      const isRateLimited = attempts.some(
        (attempt) => !attempt.ok && attempt.status === 429,
      );
      const isUnauthorized = attempts.some(
        (attempt) => !attempt.ok && attempt.status === 401,
      );
      const reasons = attempts
        .filter((attempt) => !attempt.ok)
        .map((attempt) => attempt.reason)
        .join(" | ");
      const publicStatus =
        isUnauthorized
          ? 401
          : isRateLimited
            ? 429
          : 502;
      return NextResponse.json(
        {
          error: `No se pudo completar la búsqueda paralela: ${reasons}`,
          model: firstAttempt.model,
        },
        { status: publicStatus },
      );
    }

    const failedPortalWarnings = portalSearches.flatMap((search) =>
      search.attempt.ok
        ? []
        : [`${search.attempt.source} no respondió: ${search.attempt.reason}`],
    );
    if (failedPortalWarnings.length) {
      successfulResults.forEach((result) => {
        result.warnings = [...failedPortalWarnings, ...result.warnings].slice(
          0,
          8,
        );
      });
    }

    return NextResponse.json(selectBestProductResult(successfulResults));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      console.error("[product-links/search] OpenAI timeout", error);
      return NextResponse.json(
        {
          error:
            "OpenAI tardó demasiado en responder. Intenta nuevamente con esta fila.",
        },
        { status: 504 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Error inesperado en la búsqueda.";
    console.error("[product-links/search]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
