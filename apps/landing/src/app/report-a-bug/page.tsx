import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function ReportABugPage() {
  return (
    <PageLayout
      title="Report a bug"
      description="If something feels off, we want to know—so we can make Today Matters smoother and more reliable."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <p className="text-sm text-[#52525b] leading-relaxed">
          Please include: what you expected, what happened, and the device/browser you’re using.
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


