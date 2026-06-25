"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createProformaAction } from "./actions";
import { deleteProformaAction } from "./actions";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  Eye, Trash2, Plus, Loader2, UserPlus,
  Check, ChevronDown, Upload, FileText, X, AlertCircle, CheckCircle2,
} from "lucide-react";

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

interface Cliente { id: number; nombre: string; ruc: string | null }
interface Proforma {
  id: number; cliente_nombre: string; asesor_nombre: string;
  estado: string; tipo_liquidacion: string; fecha_creacion: string;
}

const TIPOS = [
  { value: "aereo",        label: "Aéreo" },
  { value: "maritimo_lcl", label: "Marítimo LCL" },
  { value: "fcl",          label: "FCL" },
  { value: "pd",           label: "PD" },
  { value: "courier",      label: "Courier" },
];

/* ─── Combobox de clientes ───────────────────────────────────────────────── */

function ClienteCombobox({ clientes, value, onChange }: {
  clientes: Cliente[]; value: Cliente | null; onChange: (c: Cliente) => void;
}) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoRuc, setNuevoRuc]       = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length >= 2
    ? clientes.filter((c) =>
        c.nombre.toLowerCase().includes(query.toLowerCase()) ||
        (c.ruc ?? "").includes(query)
      )
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setCreando(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [createError, setCreateError] = useState("");

  async function crearCliente() {
    if (!nuevoNombre.trim()) return;
    setSaving(true); setCreateError("");
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevoNombre.trim(), ruc: nuevoRuc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChange(data.cliente);
      setQuery(data.cliente.nombre);
      setOpen(false); setCreando(false);
      setNuevoNombre(""); setNuevoRuc("");
    } catch (e: any) { setCreateError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-text"
        onClick={() => setOpen(true)}
      >
        <input
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          placeholder="Buscar o crear cliente..."
          value={value && !open ? value.nombre : query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setCreando(false); }}
          onFocus={() => { setOpen(true); if (value) setQuery(""); }}
        />
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <ul className="max-h-44 overflow-y-auto">
            {query.trim().length < 2 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Escribe al menos 2 letras para buscar...</li>
            )}
            {query.trim().length >= 2 && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
            )}
            {filtered.map((c) => (
              <li key={c.id}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                onClick={() => { onChange(c); setQuery(c.nombre); setOpen(false); setCreando(false); }}
              >
                {value?.id === c.id && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                <span className={value?.id === c.id ? "font-medium" : ""}>{c.nombre}</span>
                {c.ruc && <span className="ml-auto text-xs text-muted-foreground">{c.ruc}</span>}
              </li>
            ))}
          </ul>
          {!creando && (
            <button type="button"
              className="w-full flex items-center gap-2 border-t border-border px-3 py-2 text-sm text-emerald-500 hover:bg-emerald-500/5 text-left"
              onClick={() => { setCreando(true); setNuevoNombre(query); }}
            >
              <UserPlus className="h-3.5 w-3.5" />
              {query ? `Crear "${query}" como cliente` : "Crear nuevo cliente"}
            </button>
          )}
          {creando && (
            <div className="border-t border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nuevo cliente</p>
              <Input autoFocus placeholder="Nombre completo *" value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="RUC (opcional)" value={nuevoRuc}
                onChange={(e) => setNuevoRuc(e.target.value)} className="h-8 text-sm" />
              {createError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{createError}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                  disabled={!nuevoNombre.trim() || saving} onClick={crearCliente}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setCreando(false); setCreateError(""); }}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Modal nueva proforma ───────────────────────────────────────────────── */

type ModalStep = "idle" | "creando" | "subiendo" | "procesando" | "listo";

const STEPS_CON_ARCHIVO = [
  { key: "creando",    label: "Crear proforma" },
  { key: "subiendo",   label: "Subir archivo"  },
  { key: "procesando", label: "Procesar con IA" },
  { key: "listo",      label: "Completado"     },
];
const STEPS_SIN_ARCHIVO = [
  { key: "creando", label: "Crear proforma" },
  { key: "listo",   label: "Completado"    },
];

function ProgressSteps({ step, hasFile }: { step: ModalStep; hasFile: boolean }) {
  const steps = hasFile ? STEPS_CON_ARCHIVO : STEPS_SIN_ARCHIVO;
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-6 py-5">
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done    = i < currentIdx || step === "listo";
          const active  = i === currentIdx && step !== "listo";
          const pending = i > currentIdx;

          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              {/* Círculo */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300
                  ${done   ? "border-emerald-500 bg-emerald-500 text-white"
                  : active  ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                  : "border-border bg-background text-muted-foreground"}`}>
                  {done
                    ? <CheckCircle2 className="h-5 w-5" />
                    : active
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <span className="text-xs font-semibold">{i + 1}</span>}
                </div>
                <span className={`text-[11px] font-medium text-center leading-tight whitespace-nowrap
                  ${done ? "text-emerald-500" : active ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>

              {/* Línea conectora */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-2 mb-5">
                  <div className={`h-0.5 w-full rounded-full transition-all duration-500
                    ${i < currentIdx || step === "listo" ? "bg-emerald-500" : "bg-border"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NuevaProformaModal({ clientes, open, onClose }: {
  clientes: Cliente[]; open: boolean; onClose: () => void;
}) {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo]       = useState("");
  const [file, setFile]       = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep]       = useState<ModalStep>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [modalError, setModalError] = useState("");

  function reset() {
    setCliente(null); setTipo(""); setFile(null);
    setStep("idle"); setStepLabel(""); setModalError("");
  }

  function handleClose() { reset(); onClose(); }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const busy = step !== "idle";

  async function handleCrear() {
    if (!cliente || !tipo) return;
    setModalError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setModalError("Sesión no válida. Recarga la página."); return; }

      /* 1) Crear proforma */
      setStep("creando"); setStepLabel("Creando proforma y carpeta en Drive...");
      const fd = new FormData();
      fd.append("cliente_id", String(cliente.id));
      fd.append("asesor_id", user.id);
      fd.append("tipo_liquidacion", tipo);
      const { proformaId } = await createProformaAction(fd);

      if (file) {
        /* 2) Subir archivo */
        setStep("subiendo"); setStepLabel(`Subiendo "${file.name}"...`);
        const upFd = new FormData();
        upFd.append("proforma_id", String(proformaId));
        upFd.append("file", file);
        const upRes = await fetch("/api/proformas/upload", { method: "POST", body: upFd });
        if (!upRes.ok) throw new Error((await upRes.json()).error || "Error al subir");

        /* 3) Obtener ID del archivo recién subido */
        const archivosRes = await fetch(`/api/proformas/archivos?proforma_id=${proformaId}`);
        const archivosData = await archivosRes.json();
        const pendiente = (archivosData.archivos ?? []).find(
          (a: any) => a.nombre_original === file.name && a.estado === "pendiente"
        );

        if (pendiente) {
          /* 4) Procesar */
          setStep("procesando"); setStepLabel("Extrayendo datos con OCR e IA...");
          await fetch("/api/proformas/process-file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archivo_id: pendiente.id }),
          });
        }
      }

      setStep("listo"); setStepLabel("¡Listo!");
      router.push(`/proformas/${proformaId}`);
    } catch (e: any) {
      setStep("idle"); setStepLabel("");
      setModalError(e.message || "Error inesperado");
    }
  }

  const canCreate = !!cliente && !!tipo && !busy;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) handleClose(); }}>
      <DialogContent className="sm:max-w-4xl min-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nueva Proforma</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-5 pt-2">
          {/* Cliente */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cliente</label>
            <ClienteCombobox clientes={clientes} value={cliente} onChange={setCliente} />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tipo de liquidación</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button key={t.value} type="button" onClick={() => !busy && setTipo(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    tipo === t.value
                      ? "border-emerald-600 bg-emerald-600/10 text-emerald-500 font-medium"
                      : "border-border hover:border-emerald-600/50 hover:bg-muted/40"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dropzone — opcional */}
          <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
            <label className="text-sm font-medium">
              Proforma del proveedor <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <div
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors min-h-[200px]
                ${busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                ${dragOver ? "border-emerald-500 bg-emerald-500/5"
                  : file ? "border-emerald-600/50 bg-emerald-600/5"
                  : "border-border hover:border-emerald-600/40 hover:bg-muted/20"}`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx"
                className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />

              {file ? (
                <>
                  <FileText className="h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="text-base font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  {!busy && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="absolute top-3 right-3 rounded-full p-1.5 hover:bg-muted">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-muted-foreground/50" />
                  <div>
                    <p className="text-base font-medium">Arrastra el PDF aquí</p>
                    <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar · PDF, Excel, JPG hasta 50 MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Barra de progreso */}
          {busy && <ProgressSteps step={step} hasFile={!!file || step !== "creando"} />}

          {/* Error */}
          {modalError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />{modalError}
            </div>
          )}

          {/* Botón */}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 h-11 text-base font-medium"
            disabled={!canCreate}
            onClick={handleCrear}
          >
            {busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{stepLabel}</>
              : file ? "Crear y Procesar" : "Crear Proforma"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Página principal ───────────────────────────────────────────────────── */

export default function ProformasClient({ proformas, clientes }: {
  proformas: Proforma[]; clientes: Cliente[];
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Proformas</h1>
            <p className="text-sm text-muted-foreground">Gestión de proformas del sistema</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Nueva Proforma
          </Button>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["ID","Cliente","Asesor","Estado","Tipo","Fecha",""].map((h, i) => (
                  <th key={i} className={`px-5 py-4 text-left font-medium ${i === 6 ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proformas.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-4 font-medium">#{p.id}</td>
                  <td className="px-5 py-4">{p.cliente_nombre}</td>
                  <td className="px-5 py-4 text-muted-foreground">{p.asesor_nombre}</td>
                  <td className="px-5 py-4">
                    {(() => {
                      const cls: Record<string, string> = {
                        borrador:   "bg-muted/60 text-muted-foreground",
                        pendiente:  "bg-amber-500/15 text-amber-400",
                        procesando: "bg-accent/15 text-accent",
                        procesado:  "bg-primary/15 text-primary",
                        error:      "bg-destructive/15 text-destructive",
                      };
                      return (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls[p.estado] ?? "bg-muted/60 text-muted-foreground"}`}>
                          {p.estado}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
                      {p.tipo_liquidacion}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {new Date(p.fecha_creacion).toLocaleDateString("es-EC")}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link href={`/proformas/${p.id}`}>
                        <Button size="icon" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </Link>

                      <form action={deleteProformaAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <Button size="icon" variant="ghost" type="submit">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {proformas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    No hay proformas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NuevaProformaModal clientes={clientes} open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
