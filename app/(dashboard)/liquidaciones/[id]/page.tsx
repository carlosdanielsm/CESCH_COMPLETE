"use client"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { DataTable } from "@/components/data-table"
import { ExternalLink, Download } from "lucide-react"
import { useParams } from "next/navigation"

// TODO: Fetch from Supabase based on ID
const mockLiquidacion = {
  id: 1,
  proforma_id: 1,
  cliente: "Importadora ABC S.A.",
  estado: "enviado_cliente",
  fecha_creacion: "2025-01-20",
  tipo: "maritimo_lcl",
  url_sheet: "https://docs.google.com/spreadsheets/...",
  items: [
    {
      id: 1,
      modelo: "ABC-001",
      nombre: "Producto de Ejemplo",
      valor_usd: 11000.0,
      gastos_internos_china: 450.0,
      flete_maritimo: 2300.0,
      seguro: 220.0,
      salida_divisas: 110.0,
      arancel: 550.0,
      fodinfa: 55.0,
      ice: 0.0,
      iva: 1680.0,
      servicios_logisticos: 850.0,
      gastos_aduana: 320.0,
      total: 17535.0,
    },
    {
      id: 2,
      modelo: "XYZ-002",
      nombre: "Otro Producto",
      valor_usd: 15750.0,
      gastos_internos_china: 620.0,
      flete_maritimo: 3200.0,
      seguro: 315.0,
      salida_divisas: 157.5,
      arancel: 1575.0,
      fodinfa: 78.75,
      ice: 0.0,
      iva: 3150.0,
      servicios_logisticos: 1200.0,
      gastos_aduana: 450.0,
      total: 26496.25,
    },
  ],
  calculos: [
    {
      rubro: "Agente de Aduana",
      subtotal: 850.0,
      iva: 102.0,
      total: 952.0,
    },
    {
      rubro: "Transporte Local",
      subtotal: 450.0,
      iva: 54.0,
      total: 504.0,
    },
  ],
}

const itemColumns = [
  { key: "modelo", label: "Modelo" },
  { key: "nombre", label: "Nombre" },
  { key: "valor_usd", label: "Valor FOB", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "flete_maritimo", label: "Flete", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "arancel", label: "Arancel", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "iva", label: "IVA", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "total", label: "Total", render: (value: number) => `$${value.toFixed(2)}` },
]

const calculosColumns = [
  { key: "rubro", label: "Rubro" },
  { key: "subtotal", label: "Subtotal", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "iva", label: "IVA", render: (value: number) => `$${value.toFixed(2)}` },
  { key: "total", label: "Total", render: (value: number) => `$${value.toFixed(2)}` },
]

export default function LiquidacionDetailPage() {
  const params = useParams()

  // TODO: Fetch liquidacion data from Supabase using params.id

  const totalGeneral = mockLiquidacion.items.reduce((sum, item) => sum + item.total, 0)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <Breadcrumbs
          items={[{ label: "Liquidaciones", href: "/liquidaciones" }, { label: `Liquidación #${mockLiquidacion.id}` }]}
        />
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="font-semibold text-2xl text-foreground">Liquidación #{mockLiquidacion.id}</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              Proforma #{mockLiquidacion.proforma_id} - {mockLiquidacion.cliente}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={mockLiquidacion.estado} />
            {mockLiquidacion.url_sheet && (
              <Button variant="outline" size="sm" asChild>
                <a href={mockLiquidacion.url_sheet} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver en Google Sheets
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-xs">Tipo de Liquidación</p>
              <p className="mt-1 font-semibold text-xl capitalize">{mockLiquidacion.tipo.replace("_", " ")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-xs">Fecha de Creación</p>
              <p className="mt-1 font-semibold text-xl">{mockLiquidacion.fecha_creacion}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-xs">Total General</p>
              <p className="mt-1 font-semibold text-primary text-xl">${totalGeneral.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Items Liquidados */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Items</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={mockLiquidacion.items}
              columns={itemColumns}
              emptyMessage="No hay items en esta liquidación"
            />
          </CardContent>
        </Card>

        {/* Cálculos Adicionales */}
        <Card>
          <CardHeader>
            <CardTitle>Cálculos de Tarifas</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={mockLiquidacion.calculos}
              columns={calculosColumns}
              emptyMessage="No hay cálculos adicionales"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
