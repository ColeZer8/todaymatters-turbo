import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function RoadmapPage() {
  return (
    <PageLayout
      title="Roadmap"
      description="What we’re building next for Today Matters—focused on clarity, follow-through, and calm."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Near-term</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-[#52525b] space-y-2">
            <li>More flexible planning templates (work, family, weekends)</li>
            <li>
              Better “why” tagging for activities (values, goals, callings)
            </li>
            <li>Cleaner weekly reviews and trend insights</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Later</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-[#52525b] space-y-2">
            <li>Deeper attention insights across devices</li>
            <li>More coaching styles (gentle, direct, structured)</li>
            <li>Optional integrations that reduce manual logging</li>
          </ul>
        </div>
      </div>

      <p className="text-sm text-[#52525b]">
        Want something on the roadmap?{" "}
        <Link
          href="/request-a-feature"
          className="font-semibold text-[#0a0a0a] hover:text-brand-primary transition-colors"
        >
          Request a feature
        </Link>
        .
      </p>
    </PageLayout>
  );
}
