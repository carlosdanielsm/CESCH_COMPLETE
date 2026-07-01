export type ProductSearchInput = {
  descriptionEs: string;
  descriptionEn: string;
  totalUnits: number;
  expectedPrice: number;
  originalUrl: string;
};

export type ProductAlternative = {
  url: string;
  source: "Alibaba" | "Made-in-China";
  unitPrice: number | null;
  minOrder: number | null;
  reason: string;
};

export type ProductSource = ProductAlternative["source"];

export type ProductSearchResult = {
  found: boolean;
  newUrl: string;
  source: "Alibaba" | "Made-in-China" | "None";
  productTitle: string;
  unitPrice: number | null;
  currency: string;
  minOrder: number | null;
  quantityRange: string;
  priceDifferencePercent: number | null;
  confidence: number;
  matchSummary: string;
  warnings: string[];
  alternatives: ProductAlternative[];
  evidenceUrls: string[];
};

export const PRODUCT_RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    found: { type: "boolean" },
    newUrl: { type: "string" },
    source: { type: "string", enum: ["Alibaba", "Made-in-China", "None"] },
    productTitle: { type: "string" },
    unitPrice: { type: ["number", "null"] },
    currency: { type: "string" },
    minOrder: { type: ["number", "null"] },
    quantityRange: { type: "string" },
    priceDifferencePercent: { type: ["number", "null"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    matchSummary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    alternatives: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          source: {
            type: "string",
            enum: ["Alibaba", "Made-in-China"],
          },
          unitPrice: { type: ["number", "null"] },
          minOrder: { type: ["number", "null"] },
          reason: { type: "string" },
        },
        required: ["url", "source", "unitPrice", "minOrder", "reason"],
      },
    },
  },
  required: [
    "found",
    "newUrl",
    "source",
    "productTitle",
    "unitPrice",
    "currency",
    "minOrder",
    "quantityRange",
    "priceDifferencePercent",
    "confidence",
    "matchSummary",
    "warnings",
    "alternatives",
  ],
} as const;

export function productSearchSystemPrompt(source: ProductSource) {
  return `
Eres un analista de compras internacionales. Debes buscar un enlace NUEVO y vigente
para el mismo producto del enlace original, exclusivamente en ${source}.

Reglas obligatorias:
1. Haz varias consultas con combinaciones de modelo, material, dimensiones, capacidad,
   potencia, aplicación y sinónimos en inglés. Investiga solamente en ${source}.
2. Abre y analiza el enlace original cuando sea accesible. Si un CAPTCHA lo impide,
   usa su título, la información visible en la URL, fragmentos indexados y las
   descripciones suministradas.
3. El producto debe coincidir en tipo, material, modelo, dimensiones, capacidad,
   potencia, aplicación y demás especificaciones importantes. No basta con compartir
   palabras genéricas. La identidad del producto pesa más que el precio.
4. Evalúa el precio unitario que realmente corresponde a TOTAL UNIT. En precios por
   tramos, elige el tramo que contiene esa cantidad. Rechaza ofertas cuyo MOQ sea
   mayor que TOTAL UNIT.
5. Compara ese precio con PRICE. Prefiere la menor diferencia porcentual, pero nunca
   sacrifiques la identidad del producto por un precio parecido.
6. Devuelve enlaces directos a fichas de producto, nunca páginas de búsqueda,
   categorías, perfiles de proveedor ni URLs inventadas. No devuelvas el enlace
   original como enlace nuevo.
7. Si el precio, el MOQ o la identidad no pueden verificarse, indícalo en warnings y
   reduce confidence. Si no hay una opción suficientemente sustentada, found=false.
8. priceDifferencePercent = abs(unitPrice - PRICE) / PRICE * 100. Usa null cuando no
   exista precio verificable.
9. Incluye hasta tres fichas directas adicionales del mismo portal en alternatives.
10. Responde únicamente con el JSON solicitado.
`.trim();
}

export function isAllowedProductUrl(
  value: string,
  expectedSource?: ProductSearchResult["source"],
) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    const isAlibaba =
      (host === "alibaba.com" || host.endsWith(".alibaba.com")) &&
      /\/product-detail\//i.test(url.pathname);
    const isMadeInChina =
      (host === "made-in-china.com" || host.endsWith(".made-in-china.com")) &&
      !/\/products\//i.test(url.pathname) &&
      !/\/(?:search|category)\//i.test(url.pathname) &&
      (/\/product\//i.test(url.pathname) ||
        /product-detail/i.test(url.pathname) ||
        /\.html?$/i.test(url.pathname));

    if (expectedSource === "Alibaba") return isAlibaba;
    if (expectedSource === "Made-in-China") return isMadeInChina;
    return isAlibaba || isMadeInChina;
  } catch {
    return false;
  }
}

export function sameProductUrl(first: string, second: string) {
  try {
    const left = new URL(first);
    const right = new URL(second);
    const provider = (host: string) => {
      const normalized = host.toLowerCase();
      if (normalized === "alibaba.com" || normalized.endsWith(".alibaba.com")) {
        return "Alibaba";
      }
      if (
        normalized === "made-in-china.com" ||
        normalized.endsWith(".made-in-china.com")
      ) {
        return "Made-in-China";
      }
      return "Other";
    };
    const normalizePath = (path: string) =>
      decodeURIComponent(path).replace(/\/+$/, "").toLowerCase();

    const leftProvider = provider(left.hostname);
    const rightProvider = provider(right.hostname);
    if (leftProvider === "Other" || leftProvider !== rightProvider) return false;

    const alibabaId = (url: URL) =>
      normalizePath(url.pathname).match(/_(\d{8,})\.html?$/i)?.[1] ?? null;
    const leftId = alibabaId(left);
    const rightId = alibabaId(right);
    if (leftId && rightId) return leftId === rightId;

    return (
      normalizePath(left.pathname) === normalizePath(right.pathname)
    );
  } catch {
    return false;
  }
}

export function collectEvidenceUrls(response: unknown): string[] {
  const urls = new Set<string>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.url === "string" && isAllowedProductUrl(record.url)) {
      urls.add(record.url);
    }
    Object.values(record).forEach(visit);
  };

  visit(response);
  return [...urls];
}

export function getResponseText(response: unknown) {
  const record = response as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };

  if (typeof record.output_text === "string") return record.output_text;
  for (const item of record.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function candidateScore(result: ProductSearchResult) {
  if (!result.found) return Number.NEGATIVE_INFINITY;
  const priceDifference = result.priceDifferencePercent;
  const priceScore =
    priceDifference === null ? 0 : Math.max(0, 100 - priceDifference * 2);
  const verifiedPriceBonus = result.unitPrice === null ? 0 : 8;
  const verifiedMoqBonus = result.minOrder === null ? 0 : 4;
  const sourceBonus = result.source === "Alibaba" ? 4 : 0;
  return (
    result.confidence * 0.65 +
    priceScore * 0.35 +
    verifiedPriceBonus +
    verifiedMoqBonus +
    sourceBonus
  );
}

/**
 * Combina investigaciones independientes. Alibaba gana cuando su resultado es
 * comparable; Made-in-China puede ganar cuando su evidencia es materialmente mejor.
 */
export function selectBestProductResult(
  results: ProductSearchResult[],
): ProductSearchResult {
  const candidates = results
    .filter((result) => result.found)
    .sort((left, right) => candidateScore(right) - candidateScore(left));
  const best = candidates[0];
  const alibaba = candidates.find((result) => result.source === "Alibaba");
  const selected =
    best &&
    alibaba &&
    candidateScore(alibaba) >= candidateScore(best) - 8 &&
    alibaba.confidence >= 55
      ? alibaba
      : best;

  const allEvidence = uniqueStrings(
    results.flatMap((result) => result.evidenceUrls),
  );

  if (!selected) {
    const mostInformative = [...results].sort(
      (left, right) => right.confidence - left.confidence,
    )[0];
    return {
      found: false,
      newUrl: "",
      source: "None",
      productTitle: mostInformative?.productTitle ?? "",
      unitPrice: null,
      currency: "USD",
      minOrder: null,
      quantityRange: "",
      priceDifferencePercent: null,
      confidence: 0,
      matchSummary:
        mostInformative?.matchSummary ||
        "Ninguno de los dos portales produjo una coincidencia verificable.",
      warnings: uniqueStrings(
        results.flatMap((result) => result.warnings),
      ).slice(0, 8),
      alternatives: results
        .flatMap((result) => result.alternatives)
        .filter(
          (item, index, items) =>
            items.findIndex((candidate) =>
              sameProductUrl(candidate.url, item.url),
            ) === index,
        )
        .slice(0, 3),
      evidenceUrls: allEvidence,
    };
  }

  const alternatives = [
    ...candidates
      .filter((candidate) => candidate !== selected)
      .map((candidate) => ({
        url: candidate.newUrl,
        source: candidate.source as ProductSource,
        unitPrice: candidate.unitPrice,
        minOrder: candidate.minOrder,
        reason: `Candidato válido de ${candidate.source} con ${candidate.confidence}% de confianza.`,
      })),
    ...results.flatMap((result) => result.alternatives),
  ]
    .filter(
      (item) =>
        !sameProductUrl(item.url, selected.newUrl) &&
        isAllowedProductUrl(item.url, item.source),
    )
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) =>
          sameProductUrl(candidate.url, item.url),
        ) === index,
    )
    .slice(0, 3);

  return {
    ...selected,
    alternatives,
    evidenceUrls: allEvidence,
  };
}
