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

export const PRODUCT_SEARCH_SYSTEM_PROMPT = `
Eres un analista de compras internacionales. Debes buscar un enlace NUEVO y vigente
para el mismo producto del enlace original.

Reglas obligatorias:
1. Investiga primero en Alibaba. Usa Made-in-China solamente si no existe una opción
   viable de Alibaba. No devuelvas Amazon, AliExpress ni otros portales.
2. Abre y analiza el enlace original cuando sea accesible. Si un CAPTCHA lo impide,
   usa su título, fragmentos indexados y las descripciones suministradas.
3. El producto debe coincidir en tipo, material, modelo, dimensiones, capacidad,
   potencia, aplicación y demás especificaciones importantes. No basta con compartir
   palabras genéricas.
4. Evalúa el precio unitario que realmente corresponde a TOTAL UNIT. En precios por
   tramos, elige el tramo que contiene esa cantidad. Rechaza ofertas cuyo MOQ sea
   mayor que TOTAL UNIT.
5. Compara ese precio con PRICE. Prefiere la menor diferencia porcentual, pero nunca
   sacrifiques la identidad del producto por un precio parecido.
6. Devuelve enlaces directos a fichas de producto, nunca páginas de búsqueda,
   categorías, perfiles de proveedor ni URLs inventadas.
7. Si el precio, el MOQ o la identidad no pueden verificarse, indícalo en warnings y
   reduce confidence. Si no hay una opción suficientemente sustentada, found=false.
8. priceDifferencePercent = abs(unitPrice - PRICE) / PRICE * 100. Usa null cuando no
   exista precio verificable.
9. Responde únicamente con el JSON solicitado.
`.trim();

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
    const normalizeHost = (host: string) =>
      host.toLowerCase().replace(/^www\./, "");
    const normalizePath = (path: string) =>
      decodeURIComponent(path).replace(/\/+$/, "").toLowerCase();
    return (
      normalizeHost(left.hostname) === normalizeHost(right.hostname) &&
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
