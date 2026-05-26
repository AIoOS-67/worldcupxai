import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://worldcupxai.com"),
  title: "World Cup X AI — Your AI Concierge for the 2026 FIFA World Cup",
  description:
    "Plan. Predict. Play — in one conversation. World Cup X AI is the agent that unifies fixtures, travel, fan zones, fantasy, and media briefs for the 2026 FIFA World Cup.",
  openGraph: {
    title: "World Cup X AI",
    description: "Your AI Concierge for the 2026 FIFA World Cup.",
    url: "https://worldcupxai.com",
    siteName: "World Cup X AI",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup X AI",
    description: "Your AI Concierge for the 2026 FIFA World Cup."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-display">{children}</body>
    </html>
  );
}
