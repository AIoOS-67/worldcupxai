const steps = [
  {
    n: "01",
    t: "You speak intent",
    b: "Team you support, budget, origin, dates — in any language."
  },
  {
    n: "02",
    t: "Gemini 3 plans",
    b: "Selects tools and sub-agents to satisfy the goal."
  },
  {
    n: "03",
    t: "Elastic acts",
    b: "Hybrid search + ES|QL + workflows over fixtures, places, reviews, and memory."
  },
  {
    n: "04",
    t: "Agent remembers",
    b: "Insights are written back to Elastic so the next chat starts smarter."
  }
];

export default function HowItWorks() {
  return (
    <section className="bg-pitch-950">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold sm:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-white/10 bg-pitch-900 p-6"
            >
              <div className="text-sm font-semibold text-trophy-500">{s.n}</div>
              <div className="mt-3 text-lg font-semibold">{s.t}</div>
              <p className="mt-2 text-sm text-slate-300">{s.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
