export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { spawn } from "child_process";
import path from "path";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const proformaId = Number(id);

  /* ── Proforma + items ── */
  const [{ data: proforma }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("proformas")
      .select("id, tipo_liquidacion, fecha_creacion, clientes(nombre), usuarios(nombre)")
      .eq("id", proformaId)
      .single(),
    supabaseAdmin
      .from("proforma_items")
      .select("*")
      .eq("proforma_id", proformaId)
      .order("id", { ascending: true }),
  ]);

  if (!proforma) {
    return NextResponse.json({ error: "Proforma no encontrada" }, { status: 404 });
  }

  const clienteNombre =
    ((proforma as any).clientes as any)?.nombre ?? "CLIENTE";
  const asesorNombre =
    ((proforma as any).usuarios as any)?.nombre ?? "ASESOR";
  const tipo = ((proforma as any).tipo_liquidacion ?? "MARITIMA").toUpperCase();
  const fecha = new Date((proforma as any).fecha_creacion)
    .toLocaleDateString("es-EC")
    .replace(/\//g, "-");

  const templatePath = path.join(
    process.cwd(),
    "scripts",
    "templates",
    "MARITIMA_TEMPLATE.xlsx"
  );

  const proformaUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/proformas/${proformaId}`;

  const payload = {
    proforma_id: proformaId,
    template_path: templatePath,
    cliente_nombre: clienteNombre,
    asesor_nombre: asesorNombre,
    tipo,
    fecha,
    items: ((items as any[]) ?? []).map((item: any) => ({
      link_cotizador: proformaUrl,
      modelo: item.modelo ?? "",
      nombre_comercial: item.nombre_comercial ?? "",
      descripcion: item.descripcion ?? item.nombre_comercial ?? "",
      unidad_medida: item.unidad_medida ?? "PZA",
      cantidad_x_caja: item.cantidad_x_caja ?? 1,
      cajas: item.cajas ?? 1,
      total_unidades: item.total_unidades ?? null,
      valor_unitario_usd: item.valor_unitario_usd ?? null,
      valor_total_usd: item.valor_total_usd ?? null,
      imagen_drive_id: item.raw_json?.imagen_drive_id ?? null,
      partida: item.raw_json?.partida ?? "",
      tnan: item.raw_json?.tnan ?? "0000",
      arancel: 0.3,
      arancel_tlc: 0.3,
    })),
  };

  /* ── Ejecutar script Python ── */
  const scriptPath = path.join(process.cwd(), "scripts", "export_proforma.py");

  return new Promise<Response>((resolve) => {
    const proc = spawn("python", [scriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.stderr.on("data", (c: Buffer) => errChunks.push(c));

    proc.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString();
        console.error("[export] Python error:", errMsg);
        resolve(NextResponse.json({ error: "Error al generar Excel", detail: errMsg }, { status: 500 }));
        return;
      }

      const buffer = Buffer.concat(chunks);
      const apellidos = clienteNombre
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .join(".");
      const filename = `${tipo}_${proformaId}_${apellidos}.${fecha}.xlsx`;

      resolve(
        new Response(buffer, {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })
      );
    });
  });
}
