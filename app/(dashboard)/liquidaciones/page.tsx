"use client"

import { PageContainer } from "@/components/page-container"
import { DataTable } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { FilterBar } from "@/components/filter-bar"
import { ExternalLink } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

// TODO: Replace with actual data from Supabase liquidaciones table
const mockLiquidaciones = [
  {
    id: 1,
    proforma_id: 1,
    cliente: "Importadora ABC S.A.",
    estado: "enviado_cliente",
    fecha_creacion: "2025-01-20",
    tipo: "maritimo_lcl",
    total: "$52,350.00",
    url_sheet: "https://docs.google.com/spreadsheets/...",
  },
  {
    id: 2,
    proforma_id: 3,
    cliente: "Distribuidora DEF",
    estado: "cerrada",
    fecha_creacion: "2025-01-18",
    tipo: "fcl",
    total: "$75,200.00",
    url_sheet: "https://docs.google.com/spreadsheets/...",
  },
  {
    id: 3,
    proforma_id: 2,
    cliente: "Comercial XYZ Ltda.",
    estado: "borrador",
    fecha_creacion: "2025-01-15",
    tipo: "aereo",
    total: "$38,900.00",
    url_sheet: null,
  },
]

const columns = [
  { key: "id", label: "ID" },
  { key: "proforma_id", label: "Proforma" },
  { key: "cliente", label: "Cliente" },
  {
    key: "estado",
    label: "Estado",
    render: (value: string) => <StatusBadge status={value} />,
  },
  { key: "tipo", label: "Tipo" },
  { key: "fecha_creacion", label: "Fecha" },
  { key: "total", label: "Total" },
  {
    key: "url_sheet",
    label: "Google Sheet",
    render: (value: string | null) =>
      value ? (
        <Button variant="ghost" size="sm" asChild>
          <a href={value} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      ),
  },
]

const filters = [
  {
    key: "estado",
    label: "Estado",
    options: [
      { value: "borrador", label: "Borrador" },
      { value: "enviado_cliente", label: "Enviado Cliente" },
      { value: "cerrada", label: "Cerrada" },
    ],
  },
]

export default function LiquidacionesPage() {
  const router = useRouter()
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const filteredData = mockLiquidaciones.filter((liquidacion) => {
    return Object.entries(activeFilters).every(([key, value]) => {
      if (!value) return true
      return liquidacion[key as keyof typeof liquidacion] === value
    })
  })

  const handleFilterChange = (key: string, value: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleClearFilters = () => {
    setActiveFilters({})
  }

  return (
    <PageContainer title="Liquidaciones" description="Gestión de liquidaciones de importación">
      <div className="space-y-4">
        <FilterBar
          filters={filters}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />
        <DataTable
          data={filteredData}
          columns={columns}
          searchable
          searchPlaceholder="Buscar por cliente..."
          onRowClick={(row) => router.push(`/liquidaciones/${row.id}`)}
          emptyMessage="No se encontraron liquidaciones"
        />
      </div>
    </PageContainer>
  )
}
