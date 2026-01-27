import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function GettingStartedPage() {
  return (
    <PageLayout
      title="Getting started"
      description="A simple first week with Today Matters—built to reduce overwhelm and build momentum."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <ol className="list-decimal pl-5 text-sm text-[#52525b] space-y-2">
          <li>
            Pick your top priorities (the things you want your life to reflect).
          </li>
          <li>Plan your day with breathing room.</li>
          <li>Log what actually happens—especially transitions.</li>
          <li>Review planned vs actual once per day.</li>
          <li>Make one small adjustment tomorrow.</li>
        </ol>
      </div>

      <p className="text-sm text-[#52525b]">
        Want help getting set up?{" "}
        <Link
          href="/contact"
          className="font-semibold text-[#0a0a0a] hover:text-brand-primary transition-colors"
        >
          Contact us
        </Link>
        .
      </p>
    </PageLayout>
  );
}
