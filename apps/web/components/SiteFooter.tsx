export default function SiteFooter() {
  return (
    <footer className="bg-pitch-950 text-slate-400">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm">
        <p>© {new Date().getFullYear()} World Cup X AI · Part of the AIoOS family.</p>
        <p className="mt-2">
          Built for the Google Cloud Rapid Agent Hackathon — Elastic Partner Track.
        </p>
      </div>
    </footer>
  );
}
