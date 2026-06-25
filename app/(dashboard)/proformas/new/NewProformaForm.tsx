// app/(dashboard)/proformas/new/NewProformaForm
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProformaAction } from "../actions";
import { getSupabaseClient } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Cliente {
  id: number;
  nombre: string;
}

interface Props {
  clientes: Cliente[];
}

export default function NewProformaForm({ clientes }: Props) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [clienteId, setClienteId] = useState("");
  const [tipoLiquidacion, setTipoLiquidacion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clienteId || !tipoLiquidacion) {
      alert("Selecciona cliente y tipo de liquidación");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Sesión no válida");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("cliente_id", clienteId);
      formData.append("asesor_id", user.id); // UUID ✔
      formData.append("tipo_liquidacion", tipoLiquidacion);

      const res = await createProformaAction(formData);

      router.push(`/proformas/${res.proformaId}`);
    } catch (error) {
      console.error(error);
      alert("Error al crear la proforma");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Nueva Proforma</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={String(cliente.id)}>
                      {cliente.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Liquidación</Label>
              <Select
                value={tipoLiquidacion}
                onValueChange={setTipoLiquidacion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                  <SelectItem value="maritimo_lcl">Marítimo LCL</SelectItem>
                  <SelectItem value="fcl">FCL</SelectItem>
                  <SelectItem value="pd">PD</SelectItem>
                  <SelectItem value="courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/proformas")}
              >
                Cancelar
              </Button>

              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Guardar Proforma"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
