import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function FaqPage() {
  return (
    <PageLayout title="FAQ" description="Quick answers about Today Matters.">
      <div className="space-y-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0a0a0a]">
            Is Today Matters a to‑do list?
          </h2>
          <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
            Not really. It’s a plan + reality loop. You’ll see planned vs
            actual, learn patterns, and adjust your week without overwhelm.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0a0a0a]">
            Does it track screen time?
          </h2>
          <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
            Yes—where available. The goal isn’t shame. It’s clarity so your
            attention matches your values.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0a0a0a]">
            How do I get support?
          </h2>
          <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
            Reach out any time via{" "}
            <Link
              href="/contact"
              className="font-semibold text-[#0a0a0a] hover:text-brand-primary transition-colors"
            >
              contact
            </Link>
            .
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
