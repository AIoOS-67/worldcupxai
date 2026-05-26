"use client";
import { useState } from "react";

type Message = { role: "user" | "agent"; text: string };

export default function Chat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Message[]>([
    { role: "agent", text: "Hi! I'm World Cup X AI. Where would you like to start?" }
  ]);

  async function send() {
    const userMsg = input.trim();
    if (!userMsg || busy) return;
    setLog((l) => [...l, { role: "user", text: userMsg }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      });
      const data = (await res.json()) as { reply?: string };
      setLog((l) => [
        ...l,
        { role: "agent", text: data.reply ?? "Sorry, no reply." }
      ]);
    } catch {
      setLog((l) => [
        ...l,
        { role: "agent", text: "Network error. Please try again." }
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-80 rounded-2xl border border-white/10 bg-pitch-900 p-4 text-white shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <strong>World Cup X AI</strong>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-slate-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {log.map((m, i) => (
              <div
                key={i}
                className={m.role === "agent" ? "text-slate-200" : "text-trophy-300"}
              >
                <span className="mr-1 font-semibold">
                  {m.role === "agent" ? "Agent" : "You"}:
                </span>
                {m.text}
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">Agent is typing…</div>}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask anything..."
              className="flex-1 rounded-md bg-pitch-950 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-trophy-500"
              disabled={busy}
            />
            <button
              onClick={send}
              disabled={busy}
              className="rounded-md bg-trophy-500 px-3 py-2 text-sm font-semibold text-pitch-950 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-trophy-500 px-5 py-3 font-semibold text-pitch-950 shadow-lg transition hover:bg-trophy-300"
        >
          Chat with the agent
        </button>
      )}
    </div>
  );
}
