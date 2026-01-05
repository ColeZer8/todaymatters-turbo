import { PageLayout } from "@/components/PageLayout";

export default function PlannedVsActualPost() {
  return (
    <PageLayout
      title="Planned vs actual: the clarity loop"
      description="The fastest way to improve your week isn’t more effort—it’s better feedback."
    >
      <p className="text-[#52525b] leading-relaxed">
        Today Matters is built around a simple loop: plan your day, live it, then reflect on what actually happened.
        Not to judge yourself—just to learn.
      </p>

      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Try this for 7 days</h2>
        <ol className="mt-3 list-decimal pl-5 text-sm text-[#52525b] space-y-2">
          <li>Pick your “Big 3” for the day (the things that matter most).</li>
          <li>Make a realistic plan (leave breathing room).</li>
          <li>Log what actually happens—especially transitions.</li>
          <li>At night, compare planned vs actual and note one pattern.</li>
          <li>Adjust tomorrow based on the pattern (one small change).</li>
        </ol>
      </div>
    </PageLayout>
  );
}


