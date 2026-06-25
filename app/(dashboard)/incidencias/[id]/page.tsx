"use client"

import type React from "react"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import { useParams } from "next/navigation"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// TODO: Fetch from Supabase based on ID
const mockIncidencia = {
  id: 1,
  entidad_tipo: "proforma",
  entidad_id: 1,
  referencia: "Proforma #1 - Importadora ABC",
  descripcion: "Error en cálculo de aranceles para el item ABC-001. El código HS aplicado no corresponde al producto.",
  estado: "abierta",
  creado_por: {
    nombre: "Juan Pérez",
    email: "juan@cesch.com",
  },
  fecha_creacion: "2025-01-22 10:30",
  comentarios: [
    {
      id: 1,
      usuario: "Juan Pérez",
      comentario: "He revisado el catálogo y el código correcto debería ser 850440",
      fecha: "2025-01-22 10:35",
    },
    {
      id: 2,
      usuario: "María González",
      comentario: "Confirmo, estoy actualizando la proforma con el código correcto.",
      fecha: "2025-01-22 11:20",
    },
  ],
}

export default function IncidenciaDetailPage() {
  const params = useParams()
  const [nuevoComentario, setNuevoComentario] = useState("")

  // TODO: Fetch incidencia data from Supabase using params.id

  const handleSubmitComentario = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save comment to Supabase
    console.log("Nuevo comentario:", nuevoComentario)
    setNuevoComentario("")
  }

  const handleChangeEstado = (nuevoEstado: string) => {
    // TODO: Update estado in Supabase
    console.log("Cambiando estado a:", nuevoEstado)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <Breadcrumbs
          items={[{ label: "Incidencias", href: "/incidencias" }, { label: `Incidencia #${mockIncidencia.id}` }]}
        />
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="font-semibold text-2xl text-foreground">Incidencia #{mockIncidencia.id}</h1>
            <p className="mt-1 text-muted-foreground text-sm">{mockIncidencia.referencia}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={mockIncidencia.estado} />
            <Select defaultValue={mockIncidencia.estado} onValueChange={handleChangeEstado}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abierta">Abierta</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Incidencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-muted-foreground text-xs">Descripción</p>
              <p className="mt-1 text-sm">{mockIncidencia.descripcion}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Creado por</p>
                <p className="mt-1 font-medium text-sm">{mockIncidencia.creado_por.nombre}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Fecha de creación</p>
                <p className="mt-1 font-medium text-sm">{mockIncidencia.fecha_creacion}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tipo de entidad</p>
                <p className="mt-1 font-medium text-sm capitalize">{mockIncidencia.entidad_tipo}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">ID de entidad</p>
                <p className="mt-1 font-medium text-sm">#{mockIncidencia.entidad_id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comentarios */}
        <Card>
          <CardHeader>
            <CardTitle>Comentarios ({mockIncidencia.comentarios.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {mockIncidencia.comentarios.map((comentario) => {
                const initials = comentario.usuario
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)

                return (
                  <div key={comentario.id} className="flex gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 rounded-lg border border-border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium text-sm">{comentario.usuario}</p>
                        <p className="text-muted-foreground text-xs">{comentario.fecha}</p>
                      </div>
                      <p className="text-sm">{comentario.comentario}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <form onSubmit={handleSubmitComentario} className="flex gap-3 border-t border-border pt-4">
              <Textarea
                placeholder="Escribe un comentario..."
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                rows={3}
                className="flex-1"
              />
              <Button type="submit" size="sm">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
