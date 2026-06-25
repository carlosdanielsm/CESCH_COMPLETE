"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Save, X, Loader2, AlertCircle } from "lucide-react";

const TIPOS = [
  { value: "aereo",        label: "Aéreo" },
  { value: "maritimo_lcl", label: "Marítimo LCL" },
  { value: "fcl",          label: "FCL" },
  { value: "pd",           label: "PD" },
  { value: "courier",      label: "Courier" },
];

const ESTADOS = [
  { value: "borrador",         label: "Borrador" },
  { value: "pendiente",        label: "Pendiente" },
  { value: "procesando",       label: "Procesando" },
  { value: "procesado",        label: "Procesado" },
  { value: "listo_asistente",  label: "Listo — Asistente" },
  { value: "listo_comex",      label: "Listo — Comex" },
  { value: "finalizada",       label: "Finalizada" },
  { value: "error",            label: "Error" },
];

export default function EditProformaPage() {
  const params = useParams();
  const router = useRouter();
  const proformaId = Number(params?.id);

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const [clienteNombre, setClienteNombre] = useState("");
  const [asesorNombre, setAsesorNombre]   = useState("");
  const [estado, setEstado]               = useState("");
  const [tipo, setTipo]                   = useState("");

  useEffect(() => {
    fetch(`/api/proformas/${proformaId}/meta`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setClienteNombre(d.cliente_nombre ?? "");
        setAsesorNombre(d.asesor_nombre ?? "");
        setEstado(d.estado ?? "borrador");
        setTipo(d.tipo_liquidacion ?? "");
      })
      .catch(() => setError("No se pudo cargar la proforma"))
      .finally(() => setLoading(false));
  }, [proformaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/proformas/${proformaId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, tipo_liquidacion: tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      router.push(`/proformas/${proformaId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <Breadcrumbs items={[
          { label: "Proformas", href: "/proformas" },
          { label: `Proforma #${proformaId}`, href: `/proformas/${proformaId}` },
          { label: "Editar" },
        ]} />
        <div className="mt-3">
          <h1 className="font-semibold text-2xl">Proforma #{proformaId}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clienteNombre || "—"}
            {asesorNombre ? <span className="ml-2 text-xs">· {asesorNombre}</span> : null}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la proforma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Tipo de liquidación */}
            <div className="space-y-2">
              <Label>Tipo de liquidación</Label>
              <div className="flex flex-wrap gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                      tipo === t.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estado */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="flex flex-wrap gap-2">
                {ESTADOS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setEstado(s.value)}
                    className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                      estado === s.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:border-primary/50 hover:bg-muted/40"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push(`/proformas/${proformaId}`)}>
            <X className="mr-2 h-4 w-4" />Cancelar
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saving || !tipo}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              : <><Save className="mr-2 h-4 w-4" />Guardar cambios</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
