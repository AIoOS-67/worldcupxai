import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";
import SiteFooter from "@/components/SiteFooter";
import Chat from "@/components/Chat";

export default function Page() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <SiteFooter />
      <Chat />
    </main>
  );
}
