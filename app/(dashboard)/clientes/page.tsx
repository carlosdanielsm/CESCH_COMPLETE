"use client";

import { useState, useEffect } from "react";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Loader2, AlertCircle } from "lucide-react";
import { getClientes, createCliente } from "@/services/cliente";

interface Cliente {
  id: number; nombre: string; ruc: string | null;
  ciudad: string | null; telefono: string | null; email: string | null;
}

const EMPTY_FORM = {
  primer_nombre: "", segundo_nombre: "",
  primer_apellido: "", segundo_apellido: "",
  ruc: "", ciudad: "", telefono: "", email: "", direccion: "",
};

export default function ClientesPage() {
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  // Modal crear
  const [newOpen, setNewOpen]     = useState(false);
  const [newForm, setNewForm]     = useState(EMPTY_FORM);
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError]   = useState("");

  // Modal editar
  const [editOpen, setEditOpen]   = useState(false);
  const [editClient, setEditClient] = useState<Cliente | null>(null);
  const [editForm, setEditForm]   = useState(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState("");

  useEffect(() => {
    getClientes().then((data) => { setClientes(data as Cliente[]); setLoading(false); });
  }, []);

  const filtered = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.ruc ?? "").includes(search)
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setNewSaving(true); setNewError("");
    try {
      await createCliente(newForm);
      setClientes(await getClientes() as Cliente[]);
      setNewOpen(false);
      setNewForm(EMPTY_FORM);
    } catch (e: any) {
      setNewError(e.message ?? "Error al crear cliente");
    } finally {
      setNewSaving(false);
    }
  }

  function openEdit(c: Cliente) {
    const parts = c.nombre.split(/\s+/);
    setEditForm({
      primer_nombre:   parts[0] ?? "",
      segundo_nombre:  parts.length > 2 ? parts[1] : "",
      primer_apellido: parts.length > 2 ? parts[2] : (parts[1] ?? ""),
      segundo_apellido: parts.length > 3 ? parts.slice(3).join(" ") : "",
      ruc:      c.ruc      ?? "",
      ciudad:   c.ciudad   ?? "",
      telefono: c.telefono ?? "",
      email:    c.email    ?? "",
      direccion: "",
    });
    setEditClient(c);
    setEditError("");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editClient) return;
    setEditSaving(true); setEditError("");
    try {
      const nombre = [
        editForm.primer_nombre, editForm.segundo_nombre,
        editForm.primer_apellido, editForm.segundo_apellido,
      ].filter(Boolean).join(" ");

      const res = await fetch("/api/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editClient.id, nombre, ...editForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientes(await getClientes() as Cliente[]);
      setEditOpen(false);
    } catch (e: any) {
      setEditError(e.message ?? "Error al guardar");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <PageContainer
      title="Clientes"
      description="Gestión de clientes y contactos"
      actions={
        <Button onClick={() => { setNewForm(EMPTY_FORM); setNewError(""); setNewOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Nuevo Cliente
        </Button>
      }
    >
      {/* Buscador */}
      <div className="mb-4">
        <Input
          placeholder="Buscar por nombre o RUC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["ID", "Nombre", "RUC", "Ciudad", "Teléfono", "Email", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Cargando...
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                Sin clientes
              </td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground">#{c.id}</td>
                <td className="px-4 py-3 font-medium">{c.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.ruc ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.ciudad ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Editar cliente"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Nuevo cliente */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <ClienteForm form={newForm} onChange={setNewForm} />
            {newError && <ErrorBanner msg={newError} />}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={newSaving}>
                {newSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cliente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar cliente */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar — {editClient?.nombre}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleEdit}>
            <ClienteForm form={editForm} onChange={setEditForm} />
            {editError && <ErrorBanner msg={editError} />}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function ClienteForm({ form, onChange }: { form: typeof EMPTY_FORM; onChange: (f: typeof EMPTY_FORM) => void }) {
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-1.5">
          <Label>Primer nombre *</Label>
          <Input required value={form.primer_nombre} onChange={set("primer_nombre")} />
        </div>
        <div className="space-y-1.5">
          <Label>Segundo nombre</Label>
          <Input value={form.segundo_nombre} onChange={set("segundo_nombre")} />
        </div>
        <div className="space-y-1.5">
          <Label>Primer apellido *</Label>
          <Input required value={form.primer_apellido} onChange={set("primer_apellido")} />
        </div>
        <div className="space-y-1.5">
          <Label>Segundo apellido</Label>
          <Input value={form.segundo_apellido} onChange={set("segundo_apellido")} />
        </div>
        <div className="space-y-1.5">
          <Label>RUC / Cédula</Label>
          <Input value={form.ruc} onChange={set("ruc")} />
        </div>
        <div className="space-y-1.5">
          <Label>Ciudad</Label>
          <Input value={form.ciudad} onChange={set("ciudad")} />
        </div>
        <div className="space-y-1.5">
          <Label>Teléfono</Label>
          <Input value={form.telefono} onChange={set("telefono")} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={set("email")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Dirección</Label>
        <Input value={form.direccion} onChange={set("direccion")} />
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />{msg}
    </div>
  );
}
