"use client"

import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2 } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"

// TODO: Replace with actual data from Supabase nombres_producto table
const mockNombresProducto = [
  {
    id: 1,
    nombre_normalizado: "Tira LED",
    palabras_clave: "led, strip, luz, iluminación, rgb",
    categorias: "Electrónica, Iluminación",
    descripcion_modelo_base: "Tira LED flexible con diferentes configuraciones",
    imagen_referencia_url: "/led-strip.jpg",
    hs_sugerido: "850440",
    sinonimos: ["LED Strip", "Cinta LED", "Tira de luces LED", "LED Tape"],
  },
  {
    id: 2,
    nombre_normalizado: "Cable USB",
    palabras_clave: "usb, cable, cargador, datos, tipo c",
    categorias: "Electrónica, Accesorios",
    descripcion_modelo_base: "Cable USB para carga y transferencia de datos",
    imagen_referencia_url: "/usb-cable.jpg",
    hs_sugerido: "854442",
    sinonimos: ["USB Cable", "Cable de carga", "Data cable", "Charging cable"],
  },
  {
    id: 3,
    nombre_normalizado: "Audífonos Bluetooth",
    palabras_clave: "audifonos, bluetooth, inalambrico, wireless, earbuds",
    categorias: "Electrónica, Audio",
    descripcion_modelo_base: "Audífonos inalámbricos con tecnología Bluetooth",
    imagen_referencia_url: "/earbuds.jpg",
    hs_sugerido: "851830",
    sinonimos: ["Earbuds", "Auriculares", "Wireless earphones", "TWS"],
  },
]

const columns = [
  { key: "id", label: "ID" },
  { key: "nombre_normalizado", label: "Nombre" },
  {
    key: "categorias",
    label: "Categorías",
    render: (value: string) =>
      value.split(",").map((cat: string, i: number) => (
        <Badge key={i} variant="secondary" className="mr-1">
          {cat.trim()}
        </Badge>
      )),
  },
  { key: "hs_sugerido", label: "HS Sugerido" },
  {
    key: "sinonimos",
    label: "Sinónimos",
    render: (value: string[]) => <Badge variant="outline">{value.length} sinónimos</Badge>,
  },
]

export default function NombresProductoPage() {
  const [selectedProducto, setSelectedProducto] = useState<(typeof mockNombresProducto)[0] | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [sinonimos, setSinonimos] = useState<string[]>([])
  const [nuevoSinonimo, setNuevoSinonimo] = useState("")

  const handleRowClick = (row: (typeof mockNombresProducto)[0]) => {
    setSelectedProducto(row)
    setSinonimos(row.sinonimos)
    setIsDialogOpen(true)
  }

  const handleAddSinonimo = () => {
    if (nuevoSinonimo.trim()) {
      setSinonimos([...sinonimos, nuevoSinonimo.trim()])
      setNuevoSinonimo("")
    }
  }

  const handleRemoveSinonimo = (index: number) => {
    setSinonimos(sinonimos.filter((_, i) => i !== index))
  }

  return (
    <PageContainer
      title="Nombres de Producto"
      description="Catálogo de nombres normalizados y sinónimos para clasificación automática"
      actions={
        <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Nombre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuevo Nombre de Producto</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                // TODO: Save to Supabase
                setIsNewDialogOpen(false)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre Normalizado *</Label>
                <Input id="nombre" placeholder="Ej: Tira LED" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="palabras_clave">Palabras Clave</Label>
                <Input id="palabras_clave" placeholder="led, strip, luz, iluminación" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categorias">Categorías</Label>
                <Input id="categorias" placeholder="Electrónica, Iluminación" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción Base</Label>
                <Textarea id="descripcion" placeholder="Descripción general del tipo de producto..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hs_sugerido">HS Code Sugerido</Label>
                <Input id="hs_sugerido" placeholder="850440" />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsNewDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <DataTable
        data={mockNombresProducto}
        columns={columns}
        searchable
        searchPlaceholder="Buscar por nombre o categoría..."
        onRowClick={handleRowClick}
        emptyMessage="No se encontraron nombres de producto"
      />

      {/* Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle del Nombre de Producto</DialogTitle>
          </DialogHeader>
          {selectedProducto && (
            <div className="space-y-6">
              {/* Image and basic info */}
              <div className="flex gap-4">
                <img
                  src={selectedProducto.imagen_referencia_url || "/placeholder.svg"}
                  alt={selectedProducto.nombre_normalizado}
                  className="h-32 w-32 rounded-lg border border-border object-cover"
                />
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Nombre Normalizado</p>
                    <h3 className="font-semibold text-foreground text-xl">{selectedProducto.nombre_normalizado}</h3>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">HS Code Sugerido</p>
                    <p className="font-mono font-medium">{selectedProducto.hs_sugerido}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Categorías</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedProducto.categorias.split(",").map((cat, i) => (
                        <Badge key={i} variant="secondary">
                          {cat.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <h4 className="mb-2 font-semibold text-foreground text-sm">Palabras Clave</h4>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-1">
                      {selectedProducto.palabras_clave.split(",").map((palabra, i) => (
                        <Badge key={i} variant="outline">
                          {palabra.trim()}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Description */}
              <div>
                <h4 className="mb-2 font-semibold text-foreground text-sm">Descripción Base</h4>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm">{selectedProducto.descripcion_modelo_base}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Synonyms */}
              <div>
                <h4 className="mb-2 font-semibold text-foreground text-sm">Sinónimos</h4>
                <Card>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Agregar sinónimo..."
                        value={nuevoSinonimo}
                        onChange={(e) => setNuevoSinonimo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddSinonimo()
                          }
                        }}
                      />
                      <Button type="button" size="sm" onClick={handleAddSinonimo}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {sinonimos.map((sinonimo, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-2"
                        >
                          <span className="text-sm">{sinonimo}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveSinonimo(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cerrar
                </Button>
                <Button>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
