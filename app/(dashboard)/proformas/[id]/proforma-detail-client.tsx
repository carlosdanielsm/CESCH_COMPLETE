"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";

import {
  Upload, ExternalLink,
  Play, RotateCcw, FileText, X, Loader2,
  CheckCircle2, ImageOff, ChevronDown, ChevronUp, Trash2, Check, FileSpreadsheet,
} from "lucide-react";

const TIPOS = [
  { value: "aereo",        label: "Aéreo" },
  { value: "maritimo_lcl", label: "Marítimo LCL" },
  { value: "fcl",          label: "FCL" },
  { value: "pd",           label: "PD" },
  { value: "courier",      label: "Courier" },
];

const ESTADOS = [
  { value: "borrador",        label: "Borrador" },
  { value: "pendiente",       label: "Pendiente" },
  { value: "procesando",      label: "Procesando" },
  { value: "procesado",       label: "Procesado" },
  { value: "listo_asistente", label: "Listo — Asistente" },
  { value: "listo_comex",     label: "Listo — Comex" },
  { value: "finalizada",      label: "Finalizada" },
  { value: "error",           label: "Error" },
];

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

interface Proforma {
  id: number; estado: string; tipo_liquidacion: string; fecha_creacion: string;
  clientes: { nombre: string; ruc: string; ciudad: string; email: string } | null;
  usuarios: { nombre: string } | null;
}
interface ProformaArchivo {
  id: number; nombre_original: string; tipo_archivo: string;
  ruta_archivo: string;
  estado: "pendiente" | "procesando" | "procesado" | "error";
  procesado_en: string | null;
}
interface ProformaItem {
  id: number; modelo: string | null; nombre_comercial: string | null;
  total_unidades: number | null; valor_unitario_usd: number | null;
  valor_total_usd: number | null;
  raw_json?: { imagen_drive_id?: string; [k: string]: any } | null;
}
interface DriveImage { id: string; name: string; webViewLink?: string | null }

interface Props { proforma: Proforma; archivos: ProformaArchivo[]; items: ProformaItem[] }

type UploadStatus = "idle" | "uploading" | "processing" | "done" | "error";
type EditingCell = { itemId: number; field: string } | null;

/* ─── Tabla de items editable ────────────────────────────────────────────── */

function ItemsTable({ initialItems, images, onCountChange }: {
  initialItems: ProformaItem[];
  images: DriveImage[];
  onCountChange?: (current: number) => void;
}) {
  const totalOriginal = useRef(initialItems.length);
  const [rows, setRows] = useState<ProformaItem[]>(initialItems);
  const [editing, setEditing]   = useState<EditingCell>(null);
  const [editVal, setEditVal]   = useState("");
  const [saving, setSaving]     = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setRows(initialItems); }, [initialItems]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function startEdit(item: ProformaItem, field: string) {
    const raw = (item as any)[field];
    setEditVal(raw != null ? String(raw) : "");
    setEditing({ itemId: item.id, field });
  }

  async function saveEdit() {
    if (!editing) return;
    const key = `${editing.itemId}-${editing.field}`;
    setSaving((s) => new Set(s).add(key));
    try {
      await fetch("/api/proformas/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.itemId, field: editing.field, value: editVal }),
      });
      setRows((prev) => prev.map((r) => {
        if (r.id !== editing.itemId) return r;
        const numericFields = ["total_unidades", "valor_unitario_usd", "valor_total_usd"];
        const parsed = numericFields.includes(editing.field)
          ? editVal === "" ? null : Number(editVal)
          : editVal || null;
        return { ...r, [editing.field]: parsed };
      }));
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(key); return n; });
      setEditing(null);
    }
  }

  async function deleteRow(id: number) {
    setDeleting((s) => new Set(s).add(id));
    try {
      await fetch(`/api/proformas/items?id=${id}`, { method: "DELETE" });
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        onCountChange?.(next.length);
        return next;
      });
    } finally {
      setDeleting((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }


  function EditableCell({ item, field, children }: { item: ProformaItem; field: string; children: React.ReactNode }) {
    const isEditing = editing?.itemId === item.id && editing?.field === field;
    const key = `${item.id}-${field}`;
    const isSaving = saving.has(key);

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") setEditing(null);
          }}
          className="w-full min-w-[80px] bg-muted border border-primary/60 rounded px-2 py-0.5 text-sm outline-none ring-1 ring-primary/40"
        />
      );
    }

    return (
      <div
        onDoubleClick={() => startEdit(item, field)}
        title="Doble clic para editar"
        className={`cursor-text rounded px-1 py-0.5 hover:bg-muted/60 transition-colors ${isSaving ? "opacity-50" : ""}`}
      >
        {isSaving ? <Loader2 className="h-3 w-3 animate-spin inline" /> : children}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aún no hay items. Sube y procesa la proforma para extraerlos automáticamente.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Foto", "Código", "Descripción", "Cant.", "Precio Unit.", "Total USD", ""].map((h, i) => (
              <th key={i} className={`px-3 py-3 text-left text-xs font-medium text-muted-foreground ${i === 6 ? "w-8" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => {
            const driveId = item.raw_json?.imagen_drive_id ?? images[idx]?.id ?? null;
            const imgLink = images.find((i) => i.id === driveId)?.webViewLink
              ?? (driveId ? `https://drive.google.com/file/d/${driveId}/view` : null);
            const isDeleting = deleting.has(item.id);

            return (
              <tr
                key={item.id}
                className={`border-b border-border/50 last:border-0 transition-colors ${isDeleting ? "opacity-40" : "hover:bg-muted/20"}`}
              >
                {/* Foto */}
                <td className="px-3 py-2">
                  {driveId ? (
                    <a href={imgLink ?? "#"} target="_blank" rel="noreferrer">
                      <img
                        src={`/api/drive/image?id=${driveId}`}
                        alt="producto"
                        className="h-12 w-16 rounded object-cover border border-border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ) : (
                    <div className="flex h-12 w-16 items-center justify-center rounded border border-border bg-muted/30">
                      <ImageOff className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                  )}
                </td>

                {/* Código */}
                <td className="px-3 py-2 max-w-[140px]">
                  <EditableCell item={item} field="modelo">
                    {item.modelo
                      ? <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{item.modelo}</span>
                      : <span className="text-muted-foreground/40">—</span>}
                  </EditableCell>
                </td>

                {/* Descripción */}
                <td className="px-3 py-2">
                  <EditableCell item={item} field="nombre_comercial">
                    {item.nombre_comercial || <span className="text-muted-foreground/40">—</span>}
                  </EditableCell>
                </td>

                {/* Cant. */}
                <td className="px-3 py-2 w-24">
                  <EditableCell item={item} field="total_unidades">
                    {item.total_unidades != null
                      ? <span className="font-medium">{item.total_unidades.toLocaleString()}</span>
                      : <span className="text-muted-foreground/40">—</span>}
                  </EditableCell>
                </td>

                {/* Precio Unit. */}
                <td className="px-3 py-2 w-28">
                  <EditableCell item={item} field="valor_unitario_usd">
                    {item.valor_unitario_usd != null
                      ? `$${item.valor_unitario_usd.toFixed(4)}`
                      : <span className="text-muted-foreground/40">—</span>}
                  </EditableCell>
                </td>

                {/* Total USD */}
                <td className="px-3 py-2 w-28">
                  <EditableCell item={item} field="valor_total_usd">
                    {item.valor_total_usd != null
                      ? <span className="font-semibold">${item.valor_total_usd.toFixed(2)}</span>
                      : <span className="text-muted-foreground/40">—</span>}
                  </EditableCell>
                </td>

                {/* Eliminar */}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => deleteRow(item.id)}
                    disabled={isDeleting}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Eliminar fila"
                  >
                    {isDeleting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────────────────── */

export default function ProformaDetailClient({ proforma, archivos, items }: Props) {
  const router = useRouter();
  const cliente = proforma?.clientes ?? null;
  const safeArchivos = Array.isArray(archivos) ? archivos : [];

  const [images, setImages]             = useState<DriveImage[]>([]);
  const [itemCount, setItemCount]       = useState(items.length);
  const itemTotal                        = items.length;
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError]   = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [showUpload, setShowUpload]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [sheetOpening, setSheetOpening] = useState(false);
  const [sheetError, setSheetError]     = useState("");

  async function handleOpenSheet() {
    setSheetOpening(true); setSheetError("");
    try {
      const res  = await fetch(`/api/proformas/${proforma.id}/open-sheet`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al abrir el Sheet");
      window.open(data.url, "_blank");
    } catch (e: any) {
      setSheetError(e.message);
    } finally {
      setSheetOpening(false);
    }
  }

  // Estado y tipo editables inline
  const [estado, setEstado]     = useState(proforma.estado);
  const [tipo, setTipo]         = useState(proforma.tipo_liquidacion ?? "");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaved, setMetaSaved]   = useState(false);

  async function saveMeta(newEstado: string, newTipo: string) {
    setMetaSaving(true); setMetaSaved(false);
    try {
      await fetch(`/api/proformas/${proforma.id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: newEstado, tipo_liquidacion: newTipo }),
      });
      setMetaSaved(true);
      setTimeout(() => setMetaSaved(false), 2000);
    } finally {
      setMetaSaving(false);
    }
  }

  function handleTipo(val: string) {
    if (tipo) return; // ya asignado, bloqueado
    setTipo(val);
    saveMeta(estado, val);
  }

  function handleEstado(val: string) {
    setEstado(val);
    saveMeta(val, tipo);
  }

  useEffect(() => {
    fetch(`/api/proformas/revision?proforma_id=${proforma.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setImages(d.images ?? []); })
      .catch(() => {});
  }, [proforma.id]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setSelectedFile(f);
  }, []);

  async function handleUploadAndProcess() {
    if (!selectedFile) return;
    setUploadError("");
    try {
      setUploadStatus("uploading");
      const fd = new FormData();
      fd.append("proforma_id", String(proforma.id));
      fd.append("file", selectedFile);
      const upRes = await fetch("/api/proformas/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "Error al subir");

      setUploadStatus("processing");
      const archRes = await fetch(`/api/proformas/archivos?proforma_id=${proforma.id}`);
      const archData = await archRes.json();
      const pendiente = (archData.archivos ?? []).find(
        (a: any) => a.nombre_original === selectedFile.name && a.estado === "pendiente"
      );
      if (pendiente) {
        await fetch("/api/proformas/process-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivo_id: pendiente.id }),
        });
      }

      setUploadStatus("done");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setShowUpload(false);

      const rd = await (await fetch(`/api/proformas/revision?proforma_id=${proforma.id}`)).json();
      if (rd.success) setImages(rd.images ?? []);
      router.refresh();
    } catch (e: any) {
      setUploadStatus("error");
      setUploadError(e.message ?? "Error inesperado");
    }
  }

  async function procesarArchivo(archivoId: number) {
    setProcessingId(archivoId);
    try {
      await fetch("/api/proformas/process-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo_id: archivoId }),
      });
      const rd = await (await fetch(`/api/proformas/revision?proforma_id=${proforma.id}`)).json();
      if (rd.success) setImages(rd.images ?? []);
      router.refresh();
    } catch { setUploadError("Error al procesar archivo"); setUploadStatus("error"); }
    finally { setProcessingId(null); }
  }

  const archivoColumns = [
    {
      key: "nombre_original", label: "Archivo",
      render: (_: any, row: ProformaArchivo) => (
        <a href={`https://drive.google.com/file/d/${row.ruta_archivo}/view`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-2 text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5" />{row.nombre_original}
        </a>
      ),
    },
    { key: "tipo_archivo", label: "Tipo" },
    {
      key: "estado", label: "Estado",
      render: (v: ProformaArchivo["estado"]) => {
        const cls = { pendiente: "text-amber-400", procesando: "text-accent", procesado: "text-primary", error: "text-destructive" };
        const lbl = { pendiente: "Pendiente", procesando: "Procesando", procesado: "Procesado", error: "Error" };
        return <span className={cls[v] ?? ""}>{lbl[v] ?? v}</span>;
      },
    },
    { key: "procesado_en", label: "Fecha",
      render: (v: string | null) => v ? new Date(v).toLocaleString("es-EC") : "—" },
    {
      key: "acciones", label: "",
      render: (_: any, row: ProformaArchivo) => {
        if (row.estado !== "pendiente" && row.estado !== "error") return null;
        return (
          <Button size="sm" variant="outline" disabled={processingId === row.id}
            onClick={() => procesarArchivo(row.id)}>
            {processingId === row.id
              ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              : row.estado === "error"
              ? <RotateCcw className="h-3 w-3 mr-1.5" />
              : <Play className="h-3 w-3 mr-1.5" />}
            {row.estado === "error" ? "Reprocesar" : "Procesar"}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* HEADER */}
      <div className="border-b border-border bg-card px-8 py-5 space-y-4">
        <Breadcrumbs items={[{ label: "Proformas", href: "/proformas" }, { label: `Proforma #${proforma.id}` }]} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Proforma #{proforma.id}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {cliente?.nombre || "—"}
              {cliente?.ruc ? <span className="ml-2 text-xs">· RUC {cliente.ruc}</span> : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline" size="sm"
              onClick={handleOpenSheet}
              disabled={sheetOpening}
            >
              {sheetOpening
                ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Actualizando...</>
                : <><FileSpreadsheet className="mr-1.5 h-4 w-4" />Abrir en Google Sheets</>}
            </Button>
            {sheetError && (
              <p className="text-xs text-destructive">{sheetError}</p>
            )}
          </div>
        </div>

        {/* Tipo de liquidación */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de liquidación</p>
          {tipo ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm border border-primary/40 bg-primary/10 text-primary font-medium">
              {TIPOS.find((t) => t.value === tipo)?.label ?? tipo}
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTipo(t.value)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-border hover:border-primary/50 hover:bg-muted/40 text-muted-foreground transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Estado */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</p>
          <div className="flex flex-wrap gap-2 items-center">
            {ESTADOS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => handleEstado(s.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  estado === s.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
            {metaSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
            {metaSaved  && <Check   className="h-4 w-4 text-primary ml-1" />}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* ITEMS */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Items de la Proforma</CardTitle>
              <span className="text-sm font-medium tabular-nums">
                <span className={itemCount < itemTotal ? "text-amber-400" : "text-primary"}>
                  {itemCount}
                </span>
                <span className="text-muted-foreground">/{itemTotal} productos</span>
                {itemCount < itemTotal && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({itemTotal - itemCount} eliminados)
                  </span>
                )}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Doble clic en cualquier celda para editar · papelera para eliminar fila</p>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ItemsTable initialItems={items} images={images} onCountChange={setItemCount} />
          </CardContent>
        </Card>

        {/* ARCHIVOS ADJUNTOS */}
        {safeArchivos.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Archivos adjuntos</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable data={safeArchivos} columns={archivoColumns} emptyMessage="Sin archivos" />
            </CardContent>
          </Card>
        )}

        {/* AGREGAR ARCHIVO */}
        <div className="rounded-xl border border-border bg-card">
          <button
            type="button"
            onClick={() => { setShowUpload((v) => !v); setUploadStatus("idle"); setSelectedFile(null); }}
            className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium hover:bg-muted/40 transition-colors rounded-xl"
          >
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              Agregar otro archivo
            </span>
            {showUpload ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showUpload && (
            <div className="px-6 pb-6 space-y-3 border-t border-border pt-4">
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                  ${dragOver ? "border-emerald-500 bg-emerald-500/5"
                    : selectedFile ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/20"}`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                  className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSelectedFile(f); }} />
                {selectedFile ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm">Arrastra aquí o haz clic · PDF, Excel, JPG</p>
                  </>
                )}
              </div>

              {uploadStatus === "error" && <p className="text-sm text-destructive">{uploadError}</p>}
              {uploadStatus === "done" && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" />Procesamiento completado
                </div>
              )}
              {(uploadStatus === "uploading" || uploadStatus === "processing") && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {uploadStatus === "uploading" ? "Subiendo a Drive..." : "Procesando con IA..."}
                </div>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90"
                disabled={!selectedFile || uploadStatus === "uploading" || uploadStatus === "processing"}
                onClick={handleUploadAndProcess}
              >
                {uploadStatus === "uploading" || uploadStatus === "processing"
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
                  : <><Upload className="mr-2 h-4 w-4" />Subir y Procesar</>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
