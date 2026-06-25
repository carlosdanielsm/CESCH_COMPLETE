"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Eye,
  Copy,
  Trash2,
  RefreshCw,
  ImageIcon,
  TableIcon,
  ExternalLink,
  Loader2,
  FileImage,
} from "lucide-react"
import { toast } from "sonner"

type Img = {
  id: string
  uiId: string
  name: string
  webViewLink?: string | null
}

/**
 * NOTA: Estas columnas extra existen en tu BD (proforma_items):
 * modelo, cantidad_caja, cajas, cbm, peso_kg, etc.
 * Aquí las ponemos como opcionales para no romper nada si tu API aún no las manda.
 */
type Item = {
  id: number
  archivo_id: number
  modelo?: string | null
  cantidad_caja?: number | null
  cajas?: number | null

  nombre_comercial: string | null
  descripcion: string | null
  unidad_medida: string | null
  total_unidades: number | null
  valor_unitario_usd: number | null
  valor_total_usd: number | null

  raw_json: any
}

export default function ProformaRevisionPage() {
  const params = useParams()
  const proformaId = Number(params?.id)

  const [loading, setLoading] = useState(true)
  const [images, setImages] = useState<Img[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedImg, setSelectedImg] = useState<Img | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<"imagenes" | "items">("imagenes")

  const lastDeletedRef = useRef<{
    img: Img
    index: number
    prevSelectedUiId: string | null
  } | null>(null)

  const stats = useMemo(
    () => ({
      totalImages: images.length,
      totalItems: items.length,
    }),
    [images.length, items.length],
  )

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/proformas/revision?proforma_id=${proformaId}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      const imgs: Img[] = (data.images ?? []).map((img: any) => ({
        ...img,
        uiId: crypto.randomUUID(),
      }))

      setImages(imgs)
      setItems(data.items ?? [])
      setSelectedImg(imgs[0] ?? null)
    } catch (e: any) {
      toast.error(e.message || "Error cargando revisión")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!proformaId || Number.isNaN(proformaId)) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proformaId])

  function handleView(img: Img) {
    setSelectedImg(img)
  }

  function handleDuplicate(img: Img) {
    setImages((prev) => [
      ...prev,
      {
        ...img,
        uiId: crypto.randomUUID(),
        name: img.name.replace(/\.png$/i, "_copy.png"),
      },
    ])
    toast.success("Imagen duplicada")
  }

  function handleDelete(img: Img) {
    setImages((prev) => {
      const idx = prev.findIndex((i) => i.uiId === img.uiId)
      const prevSelectedUiId = selectedImg?.uiId ?? null

      if (idx !== -1) {
        lastDeletedRef.current = { img: prev[idx], index: idx, prevSelectedUiId }

        const next = prev.filter((i) => i.uiId !== img.uiId)

        if (selectedImg?.uiId === img.uiId) {
          const fallback = next[idx] ?? next[idx - 1] ?? next[0] ?? null
          setSelectedImg(fallback)
        }

        toast("Imagen eliminada", {
          action: {
            label: "Deshacer",
            onClick: () => {
              const pack = lastDeletedRef.current
              if (!pack) return

              setImages((cur) => {
                if (cur.some((x) => x.uiId === pack.img.uiId)) return cur
                const copy = cur.slice()
                const pos = Math.max(0, Math.min(pack.index, copy.length))
                copy.splice(pos, 0, pack.img)
                return copy
              })

              setSelectedImg((curSel) => {
                if (pack.prevSelectedUiId) return curSel ?? pack.img
                return pack.img
              })

              toast.success("Eliminación revertida")
              lastDeletedRef.current = null
            },
          },
        })
      }

      return prev.filter((i) => i.uiId !== img.uiId)
    })
  }

  async function saveItem(it: Item) {
    setSavingId(it.id)
    try {
      const res = await fetch("/api/proformas/revision/item", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(it),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success("Ítem guardado")
    } catch (e: any) {
      toast.error(e.message || "Error guardando item")
    } finally {
      setSavingId(null)
    }
  }

  function updateItem(id: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <div>
            <p className="text-lg font-semibold text-foreground">Cargando revisión…</p>
            <p className="text-sm text-muted-foreground">Proforma #{proformaId}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Revisión / edición antes de crear la hoja
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="font-mono">
                Proforma #{proformaId}
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <ImageIcon className="h-3 w-3" />
                {stats.totalImages} imágenes
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <TableIcon className="h-3 w-3" />
                {stats.totalItems} ítems
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border bg-muted p-1">
              <Button
                variant={activeTab === "imagenes" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("imagenes")}
                className="gap-2"
              >
                <ImageIcon className="h-4 w-4" />
                Imágenes
              </Button>
              <Button
                variant={activeTab === "items" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("items")}
                className="gap-2"
              >
                <TableIcon className="h-4 w-4" />
                Proforma
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="gap-2 bg-transparent">
              <RefreshCw className="h-4 w-4" />
              Recargar
            </Button>
          </div>
        </div>

        {/* IMÁGENES TAB */}
        {activeTab === "imagenes" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* PREVIEW */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Vista previa</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedImg ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate flex-1">{selectedImg.name}</p>
                      {selectedImg.webViewLink && (
                        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs shrink-0">
                          <a href={selectedImg.webViewLink} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            Drive
                          </a>
                        </Button>
                      )}
                    </div>
                    <div className="rounded-lg border bg-white overflow-hidden">
                      <img
                        src={`/api/drive/image?id=${selectedImg.id}`}
                        alt={selectedImg.name}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileImage className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No hay imágenes disponibles</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* GRID */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Imágenes / ítems detectados</CardTitle>
              </CardHeader>
              <CardContent>
                {images.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileImage className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No se detectaron imágenes</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                    {images.map((img) => (
                      <div
                        key={img.uiId}
                        className={`group relative rounded-lg overflow-hidden border bg-card cursor-pointer transition-all hover:shadow-md ${
                          selectedImg?.uiId === img.uiId
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : ""
                        }`}
                        onClick={() => handleView(img)}
                      >
                        <div className="aspect-[4/3] bg-white">
                          <img
                            src={`/api/drive/image?id=${img.id}`}
                            alt={img.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        {/* OVERLAY */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-9 w-9"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleView(img)
                            }}
                            title="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-9 w-9"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDuplicate(img)
                            }}
                            title="Duplicar"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>

                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-9 w-9"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(img)
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 pt-6">
                          <p className="text-xs text-white truncate">{img.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ITEMS TAB */}
        {activeTab === "items" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ítems extraídos (vista de liquidación)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <TableIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No se encontraron ítems</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Nombre comercial</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-center">Unidad</TableHead>
                        <TableHead className="text-right">Cant. x caja</TableHead>
                        <TableHead className="text-right">Cajas</TableHead>
                        <TableHead className="text-right">Total unidades</TableHead>
                        <TableHead className="text-right">Precio USD</TableHead>
                        <TableHead className="text-right">Total USD</TableHead>
                        <TableHead className="w-28">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, idx) => (
                        <TableRow key={it.id}>
                          <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>

                          <TableCell className="font-medium">
                            <input
                              className="w-full bg-transparent outline-none"
                              value={it.modelo ?? ""}
                              onChange={(e) => updateItem(it.id, { modelo: e.target.value || null })}
                              placeholder="Modelo"
                            />
                          </TableCell>

                          <TableCell className="font-medium">
                            <input
                              className="w-full bg-transparent outline-none"
                              value={it.nombre_comercial ?? ""}
                              onChange={(e) => updateItem(it.id, { nombre_comercial: e.target.value || null })}
                              placeholder="Nombre comercial"
                            />
                          </TableCell>

                          <TableCell className="text-muted-foreground max-w-xs">
                            <input
                              className="w-full bg-transparent outline-none"
                              value={it.descripcion ?? ""}
                              onChange={(e) => updateItem(it.id, { descripcion: e.target.value || null })}
                              placeholder="Descripción"
                            />
                          </TableCell>

                          <TableCell className="text-center">
                            <input
                              className="w-full text-center bg-transparent outline-none"
                              value={it.unidad_medida ?? ""}
                              onChange={(e) => updateItem(it.id, { unidad_medida: e.target.value || null })}
                              placeholder="pcs"
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono">
                            <input
                              className="w-full text-right bg-transparent outline-none"
                              value={it.cantidad_caja ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  cantidad_caja: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0"
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono">
                            <input
                              className="w-full text-right bg-transparent outline-none"
                              value={it.cajas ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  cajas: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0"
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono">
                            <input
                              className="w-full text-right bg-transparent outline-none"
                              value={it.total_unidades ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  total_unidades: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0"
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono">
                            <input
                              className="w-full text-right bg-transparent outline-none"
                              value={it.valor_unitario_usd ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  valor_unitario_usd: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0.00"
                            />
                          </TableCell>

                          <TableCell className="text-right font-mono font-medium">
                            <input
                              className="w-full text-right bg-transparent outline-none"
                              value={it.valor_total_usd ?? ""}
                              onChange={(e) =>
                                updateItem(it.id, {
                                  valor_total_usd: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              placeholder="0.00"
                            />
                          </TableCell>

                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={savingId === it.id}
                              onClick={() => saveItem(it)}
                              className="w-full"
                            >
                              {savingId === it.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                  Guardando
                                </>
                              ) : (
                                "Guardar"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
