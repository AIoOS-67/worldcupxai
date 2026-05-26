const items = [
  {
    emoji: "⚽",
    title: "Match IQ",
    body: "Real-time schedules, line-ups, injuries, and multilingual recaps."
  },
  {
    emoji: "🧳",
    title: "Fan Logistics",
    body: "Cross-city trip planning with conflict detection across flights, hotels, and fan zones."
  },
  {
    emoji: "🍽",
    title: "Local Pulse",
    body: "Fan-side and merchant-side intelligence over multilingual reviews and social chatter."
  },
  {
    emoji: "🎮",
    title: "Fantasy Coach",
    body: "Line-up optimization driven by fixtures, injuries, and form."
  },
  {
    emoji: "📰",
    title: "Media Brief",
    body: "One-click match recaps and daily global sentiment briefs."
  },
  {
    emoji: "🧠",
    title: "Memory Layer",
    body: "Elastic-backed memory remembers your team, budget, and prior decisions."
  }
];

export default function Features() {
  return (
    <section className="bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold sm:text-4xl">
          One agent. Five jobs. One memory.
        </h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          Built on Gemini 3 and Elastic Agent Builder, World Cup X AI reasons,
          plans, and acts on your behalf.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div
              key={i.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="text-3xl">{i.emoji}</div>
              <h3 className="mt-4 text-lg font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{i.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
