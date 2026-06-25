"use client";

import { useState } from "react";
import { loginAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError("");
    const res = await loginAction(formData);
    if (res?.ok === false) {
      setError(res.message ?? "Error al iniciar sesión");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25">
            <span className="text-lg font-bold text-primary-foreground">CS</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">CESCH Platform</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Inicia sesión para continuar</p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
          <form className="space-y-4" action={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                name="email"
                type="email"
                placeholder="tu@email.com"
                autoComplete="email"
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contraseña</label>
              <Input
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-10"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={loading}
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
                : "Iniciar sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
