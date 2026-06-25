// app/(dashboard)/proformas/[id]/page.tsx
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import ProformaDetailClient from "./proforma-detail-client";

/* ======================
   TIPOS RAW (DB)
====================== */
type ClienteRaw = {
  nombre: string | null;
  ruc: string | null;
  ciudad: string | null;
  email: string | null;
};

type UsuarioRaw = {
  nombre: string | null;
};

interface ProformaRaw {
  id: number;
  estado: string;
  tipo_liquidacion: string;
  fecha_creacion: string;
  clientes: ClienteRaw | ClienteRaw[] | null;
  usuarios: UsuarioRaw | UsuarioRaw[] | null;
}

interface ProformaArchivoDB {
  id: number;
  nombre_original: string;
  tipo_archivo: string;
  ruta_archivo: string;
  estado: "pendiente" | "procesando" | "procesado" | "error" | string | null;
  procesado_en: string | null;
}

/* ======================
   TIPOS UI (CLIENT)
====================== */
interface ProformaUI {
  id: number;
  estado: string;
  tipo_liquidacion: string;
  fecha_creacion: string;
  clientes: {
    nombre: string;
    ruc: string;
    ciudad: string;
    email: string;
  } | null;
  usuarios: {
    nombre: string;
  } | null;
}

interface ProformaItemDB {
  id: number;
  modelo: string | null;
  nombre_comercial: string | null;
  total_unidades: number | null;
  valor_unitario_usd: number | null;
  valor_total_usd: number | null;
  raw_json: { imagen_drive_id?: string } | null;
}

interface Props {
  params: Promise<{ id: string }>;
}

/* ======================
   HELPERS
====================== */
function normalizeOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeCliente(cliente: ClienteRaw | null) {
  if (!cliente) return null;

  return {
    nombre: cliente.nombre ?? "",
    ruc: cliente.ruc ?? "",
    ciudad: cliente.ciudad ?? "",
    email: cliente.email ?? "",
  };
}

function normalizeArchivoEstado(
  estado: string | null
): "pendiente" | "procesando" | "procesado" | "error" {
  const value = (estado ?? "").toLowerCase();

  if (value === "pendiente") return "pendiente";
  if (value === "procesando") return "procesando";
  if (value === "procesado") return "procesado";
  if (value === "error") return "error";

  // fallback seguro
  return "pendiente";
}

/* ======================
   PAGE
====================== */
export default async function ProformaDetailPage({ params }: Props) {
  const { id } = await params;
  const proformaId = Number(id);

  if (Number.isNaN(proformaId)) {
    return <div className="p-6">ID de proforma inválido</div>;
  }

  const supabase = await getSupabaseServerClient();

  /* ========= PROFORMA ========= */
  const { data: raw } = await supabase
    .from("proformas")
    .select(
      `
        id,
        estado,
        tipo_liquidacion,
        fecha_creacion,
        clientes ( nombre, ruc, ciudad, email ),
        usuarios ( nombre )
      `
    )
    .eq("id", proformaId)
    .single<ProformaRaw>();

  if (!raw) {
    return <div className="p-6">Proforma no encontrada</div>;
  }

  const clienteRaw = normalizeOne(raw.clientes);
  const usuarioRaw = normalizeOne(raw.usuarios);

  const proforma: ProformaUI = {
    id: raw.id,
    estado: raw.estado,
    tipo_liquidacion: raw.tipo_liquidacion,
    fecha_creacion: raw.fecha_creacion,
    clientes: normalizeCliente(clienteRaw),
    usuarios: usuarioRaw ? { nombre: usuarioRaw.nombre ?? "" } : null,
  };

  /* ========= ARCHIVOS ========= */
  const { data: archivosRaw } = await supabase
    .from("proforma_archivos")
    .select(
      `
        id,
        nombre_original,
        tipo_archivo,
        ruta_archivo,
        estado,
        procesado_en
      `
    )
    .eq("proforma_id", proformaId)
    .order("procesado_en", { ascending: false, nullsFirst: true });

  const archivos = (archivosRaw ?? []).map((a: ProformaArchivoDB) => ({
    ...a,
    estado: normalizeArchivoEstado(a.estado ?? null),
  }));

  /* ========= ITEMS ========= */
  const { data: itemsRaw } = await supabase
    .from("proforma_items")
    .select("id, modelo, nombre_comercial, total_unidades, valor_unitario_usd, valor_total_usd, raw_json")
    .eq("proforma_id", proformaId)
    .order("id", { ascending: true });

  const items: ProformaItemDB[] = itemsRaw ?? [];

  return (
    <ProformaDetailClient
      proforma={proforma}
      archivos={archivos as any}
      items={items}
    />
  );
}
