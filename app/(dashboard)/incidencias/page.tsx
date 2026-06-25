"use client"

import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { StatusBadge } from "@/components/status-badge"
import { FilterBar } from "@/components/filter-bar"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useRouter } from "next/navigation"

// TODO: Replace with actual data from Supabase incidencias table
const mockIncidencias = [
  {
    id: 1,
    entidad_tipo: "proforma",
    entidad_id: 1,
    referencia: "Proforma #1",
    descripcion: "Error en cálculo de aranceles para el item ABC-001",
    estado: "abierta",
    creado_por: "Juan Pérez",
    fecha_creacion: "2025-01-22",
  },
  {
    id: 2,
    entidad_tipo: "liquidacion",
    entidad_id: 2,
    referencia: "Liquidación #2",
    descripcion: "Cliente solicita revisión de tarifas de transporte",
    estado: "en_proceso",
    creado_por: "María González",
    fecha_creacion: "2025-01-21",
  },
  {
    id: 3,
    entidad_tipo: "cliente",
    entidad_id: 5,
    referencia: "Cliente: Importadora ABC",
    descripcion: "Actualizar información de contacto y dirección",
    estado: "cerrada",
    creado_por: "Carlos Ramírez",
    fecha_creacion: "2025-01-20",
  },
]

const columns = [
  { key: "id", label: "ID" },
  { key: "referencia", label: "Referencia" },
  { key: "descripcion", label: "Descripción" },
  {
    key: "estado",
    label: "Estado",
    render: (value: string) => <StatusBadge status={value} />,
  },
  { key: "creado_por", label: "Creado por" },
  { key: "fecha_creacion", label: "Fecha" },
]

const filters = [
  {
    key: "estado",
    label: "Estado",
    options: [
      { value: "abierta", label: "Abierta" },
      { value: "en_proceso", label: "En Proceso" },
      { value: "cerrada", label: "Cerrada" },
    ],
  },
  {
    key: "entidad_tipo",
    label: "Tipo",
    options: [
      { value: "proforma", label: "Proforma" },
      { value: "liquidacion", label: "Liquidación" },
      { value: "cliente", label: "Cliente" },
    ],
  },
]

export default function IncidenciasPage() {
  const router = useRouter()
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

  const filteredData = mockIncidencias.filter((incidencia) => {
    return Object.entries(activeFilters).every(([key, value]) => {
      if (!value) return true
      return incidencia[key as keyof typeof incidencia] === value
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
    <PageContainer
      title="Incidencias"
      description="Seguimiento de incidencias y problemas"
      actions={
        <Button onClick={() => router.push("/incidencias/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Incidencia
        </Button>
      }
    >
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
          searchPlaceholder="Buscar incidencias..."
          onRowClick={(row) => router.push(`/incidencias/${row.id}`)}
          emptyMessage="No se encontraron incidencias"
        />
      </div>
    </PageContainer>
  )
}
