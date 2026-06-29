"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ProductSearchInput,
  ProductSearchResult,
} from "@/lib/product-link-search";

type RowStatus = "pending" | "searching" | "done" | "error";

type SheetRow = ProductSearchInput & {
  id: number;
  status: RowStatus;
  result?: ProductSearchResult;
  error?: string;
  original: Record<string, unknown>;
};

const REQUIRED_COLUMNS = [
  "DESCRIPTION NUEVA ESPAÑOL",
  "DESCRIPTION NUEVA INGLES",
  "TOTAL UNIT",
  "PRICE",
  "LINKS ORIGINAL",
];

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  let text = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!text) return NaN;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma > dot) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (dot > comma && comma >= 0) {
    text = text.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    text =
      decimals > 0 && decimals <= 2
        ? text.replace(",", ".")
        : text.replace(/,/g, "");
  }
  return Number(text);
}

function getValue(row: Record<string, unknown>, expectedHeader: string) {
  const target = normalizeHeader(expectedHeader);
  const key = Object.keys(row).find((candidate) => normalizeHeader(candidate) === target);
  return key ? row[key] : undefined;
}

function displayPrice(value: number | null | undefined, currency = "USD") {
  if (value == null) return "No verificado";
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 4,
  }).format(value);
}

function statusBadge(row: SheetRow) {
  if (row.status === "searching") {
    return (
      <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30">
        <Loader2 className="animate-spin" /> Buscando
      </Badge>
    );
  }
  if (row.status === "done" && row.result?.found) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        <CheckCircle2 /> Encontrado
      </Badge>
    );
  }
  if (row.status === "done") return <Badge variant="secondary">Sin resultado</Badge>;
  if (row.status === "error") return <Badge variant="destructive">Error</Badge>;
  return <Badge variant="outline">Pendiente</Badge>;
}

export default function BusquedaEnlacesPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef(false);
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const summary = useMemo(
    () => ({
      total: rows.length,
      done: rows.filter((row) => row.status === "done").length,
      found: rows.filter((row) => row.result?.found).length,
      errors: rows.filter((row) => row.status === "error").length,
    }),
    [rows],
  );

  async function loadFile(file: File) {
    setLoadError("");
    stopRef.current = false;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("El archivo no contiene hojas.");
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[firstSheet],
        { defval: "", raw: true },
      );
      if (!rawRows.length) throw new Error("La primera hoja está vacía.");

      const headers = Object.keys(rawRows[0]).map(normalizeHeader);
      const missing = REQUIRED_COLUMNS.filter(
        (required) => !headers.includes(normalizeHeader(required)),
      );
      if (missing.length) {
        throw new Error(`Faltan columnas requeridas: ${missing.join(", ")}.`);
      }

      const parsed = rawRows
        .map((original, index): SheetRow | null => {
          const descriptionEs = String(
            getValue(original, "DESCRIPTION NUEVA ESPAÑOL") ?? "",
          ).trim();
          const descriptionEn = String(
            getValue(original, "DESCRIPTION NUEVA INGLES") ?? "",
          ).trim();
          const totalUnits = parseNumber(getValue(original, "TOTAL UNIT"));
          const expectedPrice = parseNumber(getValue(original, "PRICE"));
          const originalUrl = String(
            getValue(original, "LINKS ORIGINAL") ?? "",
          ).trim();

          if (
            !descriptionEs &&
            !descriptionEn &&
            !originalUrl &&
            !Number.isFinite(totalUnits) &&
            !Number.isFinite(expectedPrice)
          ) {
            return null;
          }

          const invalid =
            (!descriptionEs && !descriptionEn) ||
            !Number.isFinite(totalUnits) ||
            totalUnits <= 0 ||
            !Number.isFinite(expectedPrice) ||
            expectedPrice <= 0 ||
            !originalUrl;

          return {
            id: index + 2,
            descriptionEs,
            descriptionEn,
            totalUnits,
            expectedPrice,
            originalUrl,
            original,
            status: invalid ? "error" : "pending",
            error: invalid ? "Datos requeridos inválidos o incompletos." : undefined,
          };
        })
        .filter((row): row is SheetRow => row !== null);

      setRows(parsed);
      setFileName(file.name);
      setSheetName(firstSheet);
    } catch (error) {
      setRows([]);
      setFileName("");
      setSheetName("");
      setLoadError(
        error instanceof Error ? error.message : "No se pudo leer el archivo.",
      );
    }
  }

  async function searchRow(row: SheetRow) {
    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? { ...item, status: "searching", error: undefined }
          : item,
      ),
    );

    try {
      const response = await fetch("/api/product-links/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriptionEs: row.descriptionEs,
          descriptionEn: row.descriptionEn,
          totalUnits: row.totalUnits,
          expectedPrice: row.expectedPrice,
          originalUrl: row.originalUrl,
        } satisfies ProductSearchInput),
      });
      const payload = (await response.json()) as ProductSearchResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Falló la búsqueda.");

      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, status: "done", result: payload, error: undefined }
            : item,
        ),
      );
    } catch (error) {
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: "error",
                error: error instanceof Error ? error.message : "Error inesperado.",
              }
            : item,
        ),
      );
    }
  }

  async function runAll() {
    const pending = rows.filter(
      (row) => row.status === "pending" || row.status === "error",
    );
    if (!pending.length) return;
    stopRef.current = false;
    setIsRunning(true);
    for (const row of pending) {
      if (stopRef.current) break;
      if (
        !row.originalUrl ||
        !Number.isFinite(row.totalUnits) ||
        !Number.isFinite(row.expectedPrice)
      ) {
        continue;
      }
      await searchRow(row);
    }
    setIsRunning(false);
  }

  function stop() {
    stopRef.current = true;
  }

  function exportResults() {
    const exported = rows.map((row) => ({
      ...row.original,
      "NUEVO LINK": row.result?.newUrl ?? "",
      "NUEVA FUENTE": row.result?.source ?? "",
      "NUEVO PRECIO UNITARIO": row.result?.unitPrice ?? "",
      "NUEVO MOQ": row.result?.minOrder ?? "",
      "RANGO CANTIDAD APLICADO": row.result?.quantityRange ?? "",
      "DIFERENCIA PRECIO %": row.result?.priceDifferencePercent ?? "",
      "CONFIANZA %": row.result?.confidence ?? "",
      "RESUMEN COINCIDENCIA": row.result?.matchSummary ?? "",
      ADVERTENCIAS: row.result?.warnings.join(" | ") ?? row.error ?? "",
      "ENLACES ALTERNATIVOS":
        row.result?.alternatives.map((item) => item.url).join(" | ") ?? "",
      "FUENTES CONSULTADAS": row.result?.evidenceUrls.join(" | ") ?? "",
      "ESTADO BUSQUEDA": row.status,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(exported),
      sheetName.slice(0, 31) || "Resultados",
    );
    XLSX.writeFile(
      workbook,
      `${fileName.replace(/\.(xlsx?|csv)$/i, "") || "productos"}_nuevos_enlaces.xlsx`,
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Búsqueda de nuevos enlaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compara el producto, el precio por tramo y el MOQ para la cantidad
            solicitada. Alibaba tiene prioridad; Made-in-China funciona como respaldo.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="text-primary" />
              Cargar hoja de productos
            </CardTitle>
            <CardDescription>
              Acepta .xlsx, .xls y .csv exportados desde Google Sheets. Se procesa la
              primera hoja y el archivo permanece en el navegador.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => fileRef.current?.click()} disabled={isRunning}>
                <Upload /> Seleccionar archivo
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground">
                  {fileName} · {sheetName} · {rows.length} filas
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_COLUMNS.map((column) => (
                <Badge key={column} variant="outline">
                  {column}
                </Badge>
              ))}
            </div>
            {loadError && (
              <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-red-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {loadError}
              </div>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Filas", summary.total],
                ["Procesadas", summary.done],
                ["Encontradas", summary.found],
                ["Errores", summary.errors],
              ].map(([label, value]) => (
                <Card key={label} className="gap-1 py-4">
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {!isRunning ? (
                <Button onClick={() => void runAll()}>
                  <Play /> Buscar pendientes
                </Button>
              ) : (
                <Button variant="destructive" onClick={stop}>
                  Detener después de esta fila
                </Button>
              )}
              <Button
                variant="outline"
                onClick={exportResults}
                disabled={!summary.done && !summary.errors}
              >
                <Download /> Exportar resultados
              </Button>
            </div>

            <Card className="py-0">
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Fila</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Precio base</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Coincidencia</TableHead>
                      <TableHead className="pr-4">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="pl-4">{row.id}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal">
                          <p className="line-clamp-2 font-medium">
                            {row.descriptionEs || row.descriptionEn}
                          </p>
                          <a
                            href={row.originalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-blue-300 hover:underline"
                          >
                            Original <ExternalLink className="size-3" />
                          </a>
                        </TableCell>
                        <TableCell>{row.totalUnits}</TableCell>
                        <TableCell>{displayPrice(row.expectedPrice)}</TableCell>
                        <TableCell>{statusBadge(row)}</TableCell>
                        <TableCell className="max-w-[280px] whitespace-normal">
                          {row.result?.found ? (
                            <div>
                              <a
                                href={row.result.newUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-blue-300 hover:underline"
                              >
                                {row.result.source} <ExternalLink className="size-3" />
                              </a>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {displayPrice(
                                  row.result.unitPrice,
                                  row.result.currency,
                                )}{" "}
                                · MOQ {row.result.minOrder ?? "N/D"} · diferencia{" "}
                                {row.result.priceDifferencePercent?.toFixed(1) ?? "N/D"}%
                              </p>
                              {row.result.warnings[0] && (
                                <p className="mt-1 text-xs text-amber-300">
                                  {row.result.warnings[0]}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {row.error ||
                                row.result?.warnings[0] ||
                                "Aún no procesado"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.result && (
                            <Badge
                              variant={
                                row.result.confidence >= 75
                                  ? "default"
                                  : row.result.confidence >= 50
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {row.result.confidence}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isRunning || row.status === "searching"}
                            onClick={() => void searchRow(row)}
                            title="Buscar nuevamente"
                          >
                            {row.status === "pending" ? (
                              <Play />
                            ) : (
                              <RefreshCw />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageContainer>
  );
}
