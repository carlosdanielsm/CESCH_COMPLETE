import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PageContainer } from "@/components/page-container";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, DollarSign, Clock } from "lucide-react";
import Link from "next/link";

const ESTADO_STYLES: Record<string, string> = {
  borrador:   "bg-muted/60 text-muted-foreground",
  pendiente:  "bg-amber-500/15 text-amber-400",
  procesando: "bg-accent/15 text-accent",
  procesado:  "bg-primary/15 text-primary",
  error:      "bg-destructive/15 text-destructive",
};

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();

  const [
    { count: totalProformas },
    { count: totalClientes },
    { count: totalLiquidaciones },
    { count: enProceso },
    { data: recentRaw },
  ] = await Promise.all([
    supabase.from("proformas").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("liquidaciones").select("*", { count: "exact", head: true }),
    supabase.from("proformas").select("*", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("proformas")
      .select("id, estado, fecha_creacion, tipo_liquidacion, clientes(nombre)")
      .order("id", { ascending: false })
      .limit(8),
  ]);

  const recentProformas = (recentRaw ?? []) as unknown as Array<{
    id: number;
    estado: string;
    fecha_creacion: string;
    tipo_liquidacion: string;
    clientes: { nombre: string } | null;
  }>;

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Proformas"
            value={totalProformas ?? 0}
            icon={FileText}
            description="Total registradas"
          />
          <KpiCard
            title="Clientes"
            value={totalClientes ?? 0}
            icon={Users}
            description="Clientes activos"
          />
          <KpiCard
            title="Liquidaciones"
            value={totalLiquidaciones ?? 0}
            icon={DollarSign}
            description="Total registradas"
          />
          <KpiCard
            title="En espera"
            value={enProceso ?? 0}
            icon={Clock}
            description="Proformas pendientes"
          />
        </div>

        {/* Últimas proformas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Últimas Proformas</CardTitle>
            <Link href="/proformas" className="text-xs text-primary hover:underline">
              Ver todas →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Estado</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentProformas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No hay proformas registradas
                    </td>
                  </tr>
                )}
                {recentProformas.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <Link href={`/proformas/${p.id}`} className="hover:text-primary transition-colors">
                        #{p.id}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{p.clientes?.nombre ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground capitalize">{p.tipo_liquidacion}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_STYLES[p.estado] ?? "bg-muted/60 text-muted-foreground"}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(p.fecha_creacion).toLocaleDateString("es-EC")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
