import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { ScrollShowcase } from "@/components/ScrollShowcase";
import { AIPreview } from "@/components/AIPreview";
import { DailyLifeGrid } from "@/components/DailyLifeGrid";
import { Testimonials } from "@/components/Testimonials";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="bg-white">
      <Navbar />
      <Hero />
      <ScrollShowcase />
      <AIPreview />
      <DailyLifeGrid />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </main>
  );
}
