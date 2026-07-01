import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedProductUrl,
  sameProductUrl,
  selectBestProductResult,
} from "../lib/product-link-search.ts";

const alibabaUrl =
  "https://www.alibaba.com/product-detail/Industrial-Pump_1601234567890.html";
const madeInChinaUrl =
  "https://supplier.made-in-china.com/product/Example-Industrial-Pump.html";

function result(overrides = {}) {
  return {
    found: true,
    newUrl: alibabaUrl,
    source: "Alibaba",
    productTitle: "Industrial pump",
    unitPrice: 3.5,
    currency: "USD",
    minOrder: 10,
    quantityRange: "10-29",
    priceDifferencePercent: 5,
    confidence: 80,
    matchSummary: "Coinciden modelo, material y capacidad.",
    warnings: [],
    alternatives: [],
    evidenceUrls: [alibabaUrl],
    ...overrides,
  };
}

test("acepta fichas directas y rechaza páginas de búsqueda", () => {
  assert.equal(isAllowedProductUrl(alibabaUrl, "Alibaba"), true);
  assert.equal(isAllowedProductUrl(madeInChinaUrl, "Made-in-China"), true);
  assert.equal(
    isAllowedProductUrl(
      "https://www.alibaba.com/trade/search?SearchText=pump",
      "Alibaba",
    ),
    false,
  );
});

test("reconoce el mismo producto de Alibaba aunque cambie el subdominio", () => {
  assert.equal(
    sameProductUrl(
      alibabaUrl,
      "https://spanish.alibaba.com/product-detail/Other-Slug_1601234567890.html?spm=test",
    ),
    true,
  );
});

test("prefiere Alibaba cuando los resultados son comparables", () => {
  const selected = selectBestProductResult([
    result(),
    result({
      newUrl: madeInChinaUrl,
      source: "Made-in-China",
      unitPrice: 3.45,
      priceDifferencePercent: 3,
      confidence: 82,
      evidenceUrls: [madeInChinaUrl],
    }),
  ]);

  assert.equal(selected.source, "Alibaba");
  assert.equal(selected.alternatives[0]?.source, "Made-in-China");
});

test("elige Made-in-China cuando la coincidencia es materialmente mejor", () => {
  const selected = selectBestProductResult([
    result({
      unitPrice: null,
      priceDifferencePercent: null,
      confidence: 56,
    }),
    result({
      newUrl: madeInChinaUrl,
      source: "Made-in-China",
      unitPrice: 3.5,
      priceDifferencePercent: 1,
      confidence: 92,
      evidenceUrls: [madeInChinaUrl],
    }),
  ]);

  assert.equal(selected.source, "Made-in-China");
});

test("combina advertencias y evidencias cuando no hay coincidencia", () => {
  const selected = selectBestProductResult([
    result({
      found: false,
      newUrl: "",
      source: "None",
      confidence: 0,
      warnings: ["Alibaba sin coincidencias"],
    }),
    result({
      found: false,
      newUrl: "",
      source: "None",
      confidence: 0,
      warnings: ["Made-in-China sin coincidencias"],
      evidenceUrls: [madeInChinaUrl],
    }),
  ]);

  assert.equal(selected.found, false);
  assert.deepEqual(selected.warnings, [
    "Alibaba sin coincidencias",
    "Made-in-China sin coincidencias",
  ]);
  assert.equal(selected.evidenceUrls.length, 2);
});
