"use client"

import type React from "react"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Save, X } from "lucide-react"
import { useRouter } from "next/navigation"

export default function NewIncidenciaPage() {
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save to Supabase
    console.log("Saving incidencia...")
    router.push("/incidencias")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <Breadcrumbs items={[{ label: "Incidencias", href: "/incidencias" }, { label: "Nueva Incidencia" }]} />
        <h1 className="mt-3 font-semibold text-2xl text-foreground">Nueva Incidencia</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Información de la Incidencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entidad_tipo">Tipo de Entidad *</Label>
                <Select>
                  <SelectTrigger id="entidad_tipo">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proforma">Proforma</SelectItem>
                    <SelectItem value="liquidacion">Liquidación</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entidad_id">ID de Entidad *</Label>
                <Input id="entidad_id" type="number" placeholder="123" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea id="descripcion" placeholder="Describe el problema o incidencia..." rows={5} required />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/incidencias")}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button type="submit">
            <Save className="mr-2 h-4 w-4" />
            Crear Incidencia
          </Button>
        </div>
      </form>
    </div>
  )
}
