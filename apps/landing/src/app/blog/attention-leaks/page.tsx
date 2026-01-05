import { PageLayout } from "@/components/PageLayout";

export default function AttentionLeaksPost() {
  return (
    <PageLayout
      title="Attention leaks: why your day disappears"
      description="The biggest drains aren’t always the obvious ones. They’re the tiny switches that add up."
    >
      <p className="text-[#52525b] leading-relaxed">
        Most people don’t lose time in one dramatic decision. They lose it in micro-transitions: one quick check, one
        extra scroll, one more tab. Today Matters helps you see those leaks clearly so you can protect what you care
        about.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Common leaks</h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-[#52525b] space-y-2">
            <li>“Just checking” messages between tasks</li>
            <li>Phone in hand during transitions</li>
            <li>Unplanned “quick” errands that sprawl</li>
            <li>Over-scheduling without buffer</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
          <h2 className="text-lg font-bold text-[#0a0a0a]">One fix that works</h2>
          <p className="mt-3 text-sm text-[#52525b] leading-relaxed">
            Add a 10-minute “transition block” between key parts of your day. It prevents cascading delays and lowers
            the urge to fill every gap with screens.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}


