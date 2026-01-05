import Link from "next/link";
import type { ReactNode } from "react";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

interface PageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export const PageLayout = ({ title, description, children }: PageLayoutProps) => {
  return (
    <main className="bg-white">
      <Navbar />
      <section className="pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10">
            <Link
              href="/"
              className="text-sm font-medium text-[#71717a] hover:text-[#0a0a0a] transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="mt-6 text-4xl md:text-5xl font-bold text-[#0a0a0a] tracking-[-0.04em] leading-[0.95]">
              {title}
            </h1>
            {description ? (
              <p className="mt-4 text-lg text-[#52525b] leading-relaxed max-w-2xl">
                {description}
              </p>
            ) : null}
          </div>

          <div className="text-[#0a0a0a] space-y-6">{children}</div>
        </div>
      </section>
      <Footer />
    </main>
  );
};


