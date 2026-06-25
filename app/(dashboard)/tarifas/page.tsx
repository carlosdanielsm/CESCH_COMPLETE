"use client"

import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Plus } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

// TODO: Replace with actual data from Supabase tarifas table
const mockTarifas = [
  {
    id: 1,
    rubro: "Agente de Aduana",
    pvp: 850.0,
    minimo: 500.0,
    base_calculo: "Por BL",
    iva_pct: 12.0,
    categoria: "Servicios Logísticos",
    activo: true,
  },
  {
    id: 2,
    rubro: "Transporte Local",
    pvp: 2.5,
    minimo: 450.0,
    base_calculo: "Por kg",
    iva_pct: 12.0,
    categoria: "Transporte",
    activo: true,
  },
  {
    id: 3,
    rubro: "Almacenaje",
    pvp: 0.15,
    minimo: 200.0,
    base_calculo: "Por kg/día",
    iva_pct: 12.0,
    categoria: "Almacenaje",
    activo: true,
  },
  {
    id: 4,
    rubro: "Servicio de Custodia",
    pvp: 350.0,
    minimo: 350.0,
    base_calculo: "Por contenedor",
    iva_pct: 12.0,
    categoria: "Seguridad",
    activo: false,
  },
]

const columns = [
  { key: "rubro", label: "Rubro" },
  { key: "pvp", label: "PVP", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "minimo", label: "Mínimo", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "base_calculo", label: "Base de Cálculo" },
  { key: "categoria", label: "Categoría", render: (value: string) => <Badge variant="secondary">{value}</Badge> },
  {
    key: "activo",
    label: "Estado",
    render: (value: boolean) => (
      <Badge variant={value ? "default" : "secondary"} className={value ? "bg-primary" : ""}>
        {value ? "Activo" : "Inactivo"}
      </Badge>
    ),
  },
]

export default function TarifasPage() {
  const [isNewTarifaOpen, setIsNewTarifaOpen] = useState(false)
  const [editingTarifa, setEditingTarifa] = useState<(typeof mockTarifas)[0] | null>(null)

  return (
    <PageContainer
      title="Tarifas"
      description="Gestión de tarifas y precios de servicios"
      actions={
        <Dialog open={isNewTarifaOpen} onOpenChange={setIsNewTarifaOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Tarifa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nueva Tarifa</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                // TODO: Save to Supabase
                setIsNewTarifaOpen(false)
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rubro">Rubro *</Label>
                  <Input id="rubro" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Select>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servicios">Servicios Logísticos</SelectItem>
                      <SelectItem value="transporte">Transporte</SelectItem>
                      <SelectItem value="almacenaje">Almacenaje</SelectItem>
                      <SelectItem value="seguridad">Seguridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pvp">PVP *</Label>
                  <Input id="pvp" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimo">Mínimo</Label>
                  <Input id="minimo" type="number" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base_calculo">Base de Cálculo *</Label>
                  <Input id="base_calculo" placeholder="Ej: Por kg, Por BL" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iva_pct">IVA %</Label>
                  <Input id="iva_pct" type="number" step="0.01" defaultValue="12" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="activo" defaultChecked />
                <Label htmlFor="activo">Tarifa activa</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsNewTarifaOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Tarifa</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <DataTable
        data={mockTarifas}
        columns={columns}
        searchable
        searchPlaceholder="Buscar por rubro, categoría..."
        emptyMessage="No se encontraron tarifas"
      />
    </PageContainer>
  )
}
