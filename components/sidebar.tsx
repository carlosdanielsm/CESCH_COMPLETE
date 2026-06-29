"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Users, Tag, Scale,
  ClipboardList, Banknote, AlertTriangle, UserCog,
  PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";
import { useState } from "react";

interface SidebarProps {
  nombre: string;
  rol: string;
}

const navGroups = [
  {
    label: "Principal",
    items: [
      { name: "Dashboard",  href: "/dashboard",       icon: LayoutDashboard },
    ],
  },
  {
    label: "Comercial",
    items: [
      { name: "Proformas",         href: "/proformas",        icon: FileText },
      { name: "Clientes",          href: "/clientes",          icon: Users },
      { name: "Nombres Producto",  href: "/nombres-producto",  icon: Tag },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { name: "Aranceles",     href: "/aranceles",     icon: Scale },
      { name: "Buscar enlaces", href: "/busqueda-enlaces", icon: Search },
      { name: "Liquidaciones", href: "/liquidaciones", icon: ClipboardList },
      { name: "Tarifas",       href: "/tarifas",       icon: Banknote },
    ],
  },
  {
    label: "Soporte",
    items: [
      { name: "Incidencias", href: "/incidencias", icon: AlertTriangle },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Usuarios", href: "/usuarios", icon: UserCog },
    ],
  },
];

export function Sidebar({ nombre, rol }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 select-none",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* LOGO */}
      <div className={cn(
        "flex h-14 items-center border-b border-sidebar-border shrink-0",
        collapsed ? "justify-center px-0" : "gap-3 px-4"
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
          <span className="text-xs font-bold text-primary-foreground">CS</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">CESCH</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Platform</p>
          </div>
        )}
      </div>

      {/* NAV */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1 mx-3 border-t border-sidebar-border/40" />}

            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "relative flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r bg-primary" />
                  )}
                  <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* USER + COLLAPSE */}
      <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
        {!collapsed && (
          <div className="px-2 py-1.5 rounded-lg bg-sidebar-accent/40 flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary uppercase">
              {nombre?.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{nombre}</p>
              <p className="text-[10px] text-muted-foreground capitalize truncate">{rol}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4 mx-auto" />
            : <><PanelLeftClose className="h-4 w-4 shrink-0" /><span>Colapsar</span></>
          }
        </button>
      </div>
    </div>
  );
}
