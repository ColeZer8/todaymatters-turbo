import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function RequestAFeaturePage() {
  return (
    <PageLayout
      title="Request a feature"
      description="Tell us what would make Today Matters more useful in your real day."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <p className="text-sm text-[#52525b] leading-relaxed">
          We’re keeping this simple: send us what you want, why it matters, and
          what “done” looks like.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0a0a0a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#171717] transition-colors"
        >
          Contact us
        </Link>
      </div>
    </PageLayout>
  );
}
