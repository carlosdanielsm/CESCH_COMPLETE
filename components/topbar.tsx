"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":       "Dashboard",
  "/proformas":       "Proformas",
  "/clientes":        "Clientes",
  "/nombres-producto":"Nombres de Producto",
  "/aranceles":       "Aranceles",
  "/liquidaciones":   "Liquidaciones",
  "/tarifas":         "Tarifas",
  "/incidencias":     "Incidencias",
  "/usuarios":        "Usuarios",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "proformas" && segments[1]) {
    if (segments[2] === "edit")     return "Editar Proforma";
    if (segments[2] === "revision") return "Revisión IA";
    return `Proforma #${segments[1]}`;
  }
  const root = "/" + segments[0];
  return PAGE_TITLES[root] ?? "CESCH Platform";
}

interface TopbarProps {
  nombre: string;
  rol: string;
}

export function Topbar({ nombre, rol }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname ?? "");

  const initials =
    nombre
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  async function handleLogout() {
    await fetch("/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-sm shrink-0">
      {/* Page title */}
      <h1 className="text-base font-semibold text-foreground tracking-tight">{pageTitle}</h1>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="flex items-center gap-2 h-9 px-2 hover:bg-muted">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/20 text-primary text-[11px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden sm:block">{nombre || "—"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">{nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">{rol}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />Perfil
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />Configuración
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
