// app/(dashboard)/usuarios/UsuariosPageClient.ts

"use client";

import { useState } from "react";
import {
  crearUsuario,
  editarUsuario,
  eliminarUsuario,
  generarLinkResetPassword,
} from "./actions";

import type { RolUsuario } from "./actions";

import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Shield, Pencil, Trash2, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export default function UsuariosPageClient({
  usuarios,
}: {
  usuarios: Usuario[];
}) {
  const [openCreate, setOpenCreate] = useState(false);
  const [rolCreate, setRolCreate] = useState<RolUsuario>("asesor");

  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editRol, setEditRol] = useState<RolUsuario>("asesor");

  const [openDelete, setOpenDelete] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [actionUser, setActionUser] = useState<Usuario | null>(null);

  return (
    <PageContainer
      title="Usuarios"
      description="Gestión de usuarios del sistema"
      actions={
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Usuario</DialogTitle>
            </DialogHeader>

            <form
              action={async (formData) => {
                try {
                  await crearUsuario(formData);
                  setOpenCreate(false);
                  setRolCreate("asesor");
                  alert("✅ Usuario creado");
                } catch (e: any) {
                  alert(e?.message ?? "Error");
                }
              }}
              className="space-y-3"
            >
              <Input name="nombre" placeholder="Nombre" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input
                name="password"
                type="password"
                placeholder="Contraseña"
                required
              />

              <Select
                value={rolCreate}
                onValueChange={(v) => setRolCreate(v as RolUsuario)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrador">
                    Administrador
                  </SelectItem>
                  <SelectItem value="asesor">Asesor</SelectItem>
                  <SelectItem value="asistente">Asistente</SelectItem>
                  <SelectItem value="comex">Comex</SelectItem>
                </SelectContent>
              </Select>

              <input type="hidden" name="rol" value={rolCreate} />

              <Button type="submit" className="w-full">
                Crear
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Nombre</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Rol</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-3">{u.nombre}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <Badge>
                    <Shield className="mr-1 h-3 w-3" />
                    {u.rol}
                  </Badge>
                </td>
                <td className="p-3 text-right space-x-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditId(u.id);
                      setEditNombre(u.nombre);
                      setEditRol(u.rol);
                      setOpenEdit(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setActionUser(u);
                      setOpenReset(true);
                    }}
                  >
                    <Key className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setActionUser(u);
                      setOpenDelete(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* EDITAR */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>

          <form
            action={async (formData) => {
              try {
                await editarUsuario(formData);
                setOpenEdit(false);
                alert("✅ Usuario actualizado");
              } catch (e: any) {
                alert(e?.message ?? "Error");
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="id" value={editId} />

            <Input
              name="nombre"
              value={editNombre}
              onChange={(e) => setEditNombre(e.target.value)}
              required
            />

            <Select
              value={editRol}
              onValueChange={(v) => setEditRol(v as RolUsuario)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="administrador">
                  Administrador
                </SelectItem>
                <SelectItem value="asesor">Asesor</SelectItem>
                <SelectItem value="asistente">Asistente</SelectItem>
                <SelectItem value="comex">Comex</SelectItem>
              </SelectContent>
            </Select>

            <input type="hidden" name="rol" value={editRol} />

            <Button type="submit" className="w-full">
              Guardar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ELIMINAR */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
          </DialogHeader>

          <form
            action={async (formData) => {
              try {
                await eliminarUsuario(formData);
                setOpenDelete(false);
                setActionUser(null);
                alert("🗑️ Usuario eliminado");
              } catch (e: any) {
                alert(e?.message ?? "Error");
              }
            }}
          >
            <input type="hidden" name="id" value={actionUser?.id ?? ""} />

            <Button variant="destructive" className="w-full" type="submit">
              Eliminar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* RESET PASSWORD */}
      <Dialog open={openReset} onOpenChange={setOpenReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
          </DialogHeader>

          <Button
            className="w-full"
            onClick={async () => {
              try {
                if (!actionUser?.email) return;

                const link = await generarLinkResetPassword(actionUser.email);
                if (!link) {
                  alert("No se pudo generar link");
                  return;
                }

                await navigator.clipboard.writeText(link);
                alert("🔑 Link copiado al portapapeles");
                setOpenReset(false);
              } catch (e: any) {
                alert(e?.message ?? "Error");
              }
            }}
          >
            Generar link
          </Button>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
