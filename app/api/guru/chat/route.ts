export const runtime = "nodejs";

import { NextResponse } from "next/server";

const FLASK_API = "https://arancelesecuador2026en-start-cokmmand.onrender.com/api/chat";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: { role: string; content: string }[] = body.messages ?? [];

    if (!messages.length) {
      return NextResponse.json({ error: "Sin mensajes" }, { status: 400 });
    }

    const flaskRes = await fetch(FLASK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!flaskRes.ok) {
      const text = await flaskRes.text();
      console.error("[/api/guru/chat] Flask error:", flaskRes.status, text);
      return NextResponse.json(
        { error: `Flask API error ${flaskRes.status}` },
        { status: 502 }
      );
    }

    const data = await flaskRes.json();
    return NextResponse.json(data);
  } catch (e: any) {
    console.error("[/api/guru/chat]", e);
    return NextResponse.json(
      { error: e.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
