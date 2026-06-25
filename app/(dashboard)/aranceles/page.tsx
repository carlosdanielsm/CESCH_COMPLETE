"use client";

import { useState, useRef, useEffect } from "react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  result?: ChatResult;
}

interface ChatResult {
  hs_code: string;
  message: string;
  guru_results: GuruItem[];
  guru_validated: boolean;
}

interface GuruItem {
  tariff_code: string;
  description: string;
  tributos?: Record<string, string | null>;
  detalle?: { seccion: string; capitulo: string; nota_explicativa: string };
  acuerdos?: Agreement[];
  restriccion?: Restriction;
}

interface Agreement {
  iso2: string;
  country: string;
  agr_code: string;
  to_pay: string | null;
  year_range: string;
}

interface Restriction {
  restricciones: Array<{ entity: string; document_type: string; observation: string }>;
  inen: Array<{ code: string; title: string }>;
  tiene_alguna: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHs(hs: string): string {
  const d = hs.replace(/[^0-9]/g, "");
  if (d.length >= 10)
    return `${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6,8)}.${d.slice(8,10)}`;
  if (d.length >= 6) return `${d.slice(0,4)}.${d.slice(4,6)}`;
  return d;
}

function pctClass(val: string | null | undefined): string {
  if (!val) return "text-muted-foreground";
  const n = parseFloat(val.replace("%", "")) || 0;
  if (n <= 0) return "text-emerald-400";
  if (n <= 10) return "text-yellow-400";
  return "text-red-400";
}

function pctBg(val: string | null | undefined): string {
  if (!val) return "bg-muted/30 text-muted-foreground border-border";
  const n = parseFloat(val.replace("%", "")) || 0;
  if (n <= 0) return "bg-emerald-900/20 text-emerald-400 border-emerald-800/40";
  if (n <= 10) return "bg-yellow-900/20 text-yellow-400 border-yellow-800/40";
  return "bg-red-900/20 text-red-400 border-red-800/40";
}

const TRIBUTO_LABELS: Record<string, string> = {
  "AD VALOREM": "Ad Valorem",
  "IVA": "IVA",
  "FONDO INNFA": "FODINFA",
  "ICE AD VALOREM": "ICE",
  "SALVAGUARDIA": "Salvag.",
  "ARANCEL ESPECIFICO": "Aran. Esp.",
  "ANTIDUMPING": "Antidump.",
};

const EXAMPLES = [
  "motor eléctrico",
  "camisetas de algodón",
  "laptops",
  "repuestos de freno",
  "fideos instantáneos",
  "cremas faciales",
];

// ─── Componente TariffCard ────────────────────────────────────────────────────

function TariffCard({ item, isBest }: { item: GuruItem; isBest: boolean }) {
  const china = item.acuerdos?.find((a) => a.iso2 === "CN");

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        isBest
          ? "border-emerald-700/60 bg-emerald-900/10"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-bold text-emerald-400 text-sm">
          {item.tariff_code}
        </span>
        {isBest && (
          <span className="text-[10px] font-semibold bg-emerald-600 text-white rounded px-2 py-0.5">
            ✓ Mejor coincidencia
          </span>
        )}
      </div>

      {/* Descripción */}
      <p className="text-sm font-medium text-foreground leading-snug">
        {item.description}
      </p>

      {/* Sección / Capítulo */}
      {item.detalle && (item.detalle.seccion || item.detalle.capitulo) && (
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          {item.detalle.seccion && <span><b>Sección:</b> {item.detalle.seccion} · </span>}
          {item.detalle.capitulo && <span><b>Capítulo:</b> {item.detalle.capitulo}</span>}
        </div>
      )}

      {/* Tributos */}
      {item.tributos && Object.keys(item.tributos).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(TRIBUTO_LABELS).map(([key, label]) => {
            const val = item.tributos![key];
            if (val === undefined) return null;
            const display = val === null ? "N/A" : val.includes("%") ? val : `${val}%`;
            return (
              <div
                key={key}
                className={`border rounded px-2.5 py-1.5 text-center font-mono text-xs font-semibold min-w-[60px] ${pctBg(val)}`}
              >
                <div className="text-[9px] uppercase tracking-wide font-sans opacity-70 mb-0.5">
                  {label}
                </div>
                {display}
              </div>
            );
          })}
        </div>
      )}

      {/* TLC China */}
      {china && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            TLC Ecuador — China
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-800/40 rounded px-2 py-0.5 text-[10px] font-semibold">
              CN — China
            </span>
            {china.to_pay !== null && (
              <span className="text-emerald-400 font-bold">
                {china.to_pay}% AD VALOREM
              </span>
            )}
            {china.year_range && (
              <span className="text-muted-foreground">{china.agr_code} ({china.year_range})</span>
            )}
          </div>
        </div>
      )}

      {/* Restricciones */}
      {item.restriccion?.tiene_alguna && (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-yellow-500 font-semibold">
            Restricciones de importación
          </p>
          {item.restriccion.restricciones.slice(0, 2).map((r, i) => (
            <div
              key={i}
              className="text-[11px] bg-yellow-900/10 border border-yellow-800/30 rounded px-2 py-1.5 text-yellow-300"
            >
              {r.entity && <b>{r.entity}</b>}
              {r.document_type && <span className="text-muted-foreground"> · {r.document_type}</span>}
              {r.observation && <div className="text-muted-foreground mt-0.5">{r.observation.slice(0, 120)}</div>}
            </div>
          ))}
          {item.restriccion.inen.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              <b>INEN:</b>{" "}
              {item.restriccion.inen
                .map((i) => `RTE ${i.code}${i.title ? " — " + i.title : ""}`)
                .join("; ")}
            </div>
          )}
        </div>
      )}
      {item.restriccion?.tiene_alguna === false && (
        <p className="text-[11px] text-emerald-500 font-medium">✓ Sin restricciones</p>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ArancelesPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [apiMessages, setApiMessages] = useState<{ role: string; content: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function reset() {
    setMessages([]);
    setInput("");
    setLoading(false);
    setDone(false);
    setApiMessages([]);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function send(text?: string) {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setInput("");
    setLoading(true);

    const newApiMessages = [...apiMessages, { role: "user", content: userText }];
    setApiMessages(newApiMessages);
    setMessages((prev) => [...prev, { role: "user", content: userText }]);

    try {
      const res = await fetch("/api/guru/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newApiMessages }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error del servidor");

      const aiContent = JSON.stringify(data);
      setApiMessages((prev) => [...prev, { role: "assistant", content: aiContent }]);

      if (data.done && data.hs_code) {
        setDone(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            content: data.message,
            result: {
              hs_code: data.hs_code,
              message: data.message,
              guru_results: data.guru_results ?? [],
              guru_validated: data.guru_validated ?? false,
            },
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", content: data.message ?? "Sin respuesta" }]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `Error: ${e.message ?? "Error de conexión"}` },
      ]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  const showWelcome = messages.length === 0 && !loading;

  return (
    <div className="flex h-full flex-col bg-background">

      {/* Topbar interno */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <h1 className="font-semibold text-sm tracking-wide">
            Clasificador Arancelario NANDINA
          </h1>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 transition-colors hover:bg-muted/40"
          >
            + Nueva búsqueda
          </button>
        )}
      </div>

      {/* Área de mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">

        {/* Welcome */}
        {showWelcome && (
          <div className="max-w-xl mx-auto px-6 pt-16 pb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              ¿Qué quieres{" "}
              <span className="text-emerald-400">importar</span>?
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              Describe el producto y encontramos la partida arancelaria NANDINA exacta con tributos y TLC China.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => send(ex)}
                  className="rounded-full border border-border bg-card hover:bg-muted/40 hover:border-emerald-700/50 px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensajes */}
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="bg-emerald-700 text-white rounded-xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                    Clasificador
                  </p>

                  {msg.result ? (
                    <div className="space-y-3">
                      {/* Código NANDINA */}
                      <div className="flex items-start gap-4 bg-emerald-900/10 border border-emerald-800/40 rounded-xl px-4 py-3">
                        <div className="flex-shrink-0">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                            Código NANDINA
                            {msg.result.guru_validated && (
                              <span className="ml-2 text-emerald-500">✓ validado en Guru</span>
                            )}
                          </p>
                          <p className="font-mono font-bold text-emerald-400 text-2xl tracking-widest">
                            {formatHs(msg.result.hs_code)}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                          {msg.result.message}
                        </p>
                      </div>

                      {/* Tariff cards */}
                      {msg.result.guru_results.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                            Partidas en GuruAranceles
                          </p>
                          {msg.result.guru_results.map((item, idx) => (
                            <TariffCard key={idx} item={item} isBest={idx === 0} />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No se encontraron partidas en GuruAranceles.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground leading-relaxed max-w-2xl">
                      {msg.content}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Clasificador
              </p>
              <div className="bg-card border border-border rounded-xl px-4 py-3 inline-flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div
            className={`flex items-end gap-2 border rounded-xl px-4 py-2 transition-colors ${
              done
                ? "border-border opacity-50 cursor-not-allowed"
                : "border-border focus-within:border-emerald-700"
            } bg-background`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              disabled={loading || done}
              placeholder={
                done
                  ? "Clasificación completa. Usa 'Nueva búsqueda' para continuar."
                  : "Describe el producto a importar..."
              }
              className="flex-1 bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground max-h-28 leading-relaxed"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || done || !input.trim()}
              className="w-8 h-8 flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-default rounded-lg flex items-center justify-center transition-colors"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
                className="text-white"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-1.5">
            Clasificación por NANDINA · SENAE Ecuador
          </p>
        </div>
      </div>
    </div>
  );
}
