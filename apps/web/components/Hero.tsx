export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-pitch-950">
      <div className="absolute inset-0 bg-gradient-to-b from-pitch-900 to-pitch-950" />
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 text-center">
        <p className="inline-block rounded-full border border-trophy-500/40 px-3 py-1 text-xs uppercase tracking-widest text-trophy-300">
          2026 FIFA World Cup · Elastic Partner Track
        </p>
        <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">
          Your AI Concierge for the{" "}
          <span className="text-trophy-500">2026 World Cup</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Plan. Predict. Play — in one conversation. World Cup X AI unifies
          fixtures, travel, fan zones, fantasy, and media briefs into a single
          agent.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#chat"
            className="rounded-md bg-trophy-500 px-6 py-3 font-semibold text-pitch-950 transition hover:bg-trophy-300"
          >
            Talk to the agent
          </a>
          <a
            href="https://github.com/AIoOS-67/worldcupxai"
            className="rounded-md border border-white/20 px-6 py-3 font-semibold transition hover:bg-white/10"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
