import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "default" | "success" | "warning" | "error" | "info"
}

const statusColors = {
  // Proforma states
  borrador: "bg-muted text-muted-foreground",
  listo_asistente: "bg-accent text-accent-foreground",
  listo_comex: "bg-primary text-primary-foreground",
  finalizada: "bg-primary text-primary-foreground",

  // Liquidacion states
  enviado_cliente: "bg-accent text-accent-foreground",
  cerrada: "bg-muted text-muted-foreground",

  // Incidencia states
  abierta: "bg-destructive/10 text-destructive",
  en_proceso: "bg-accent text-accent-foreground",
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const colorClass = statusColors[status as keyof typeof statusColors] || "bg-muted text-muted-foreground"

  const displayText = status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")

  return (
    <Badge variant="secondary" className={cn("font-normal", colorClass)}>
      {displayText}
    </Badge>
  )
}
