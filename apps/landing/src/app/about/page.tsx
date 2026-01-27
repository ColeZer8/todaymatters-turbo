import { PageLayout } from "@/components/PageLayout";

export default function AboutPage() {
  return (
    <PageLayout
      title="About Today Matters"
      description="Today Matters is built by The Data Group to help you live intentionally by turning your plans, time, and attention into clarity you can act on."
    >
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Why we exist</h2>
        <p className="text-[#52525b] leading-relaxed">
          Most of us don’t need more hustle. We need alignment. Today Matters is
          built to help you see your day clearly, protect what matters most, and
          follow through—one plan, one log, one reflection at a time.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <p className="text-[#52525b] leading-relaxed">
          You set your priorities, make a realistic plan, and then compare
          planned vs actual. Over time, patterns become obvious—where your
          attention leaks, what drains you, and what actually moves your life
          forward.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">What you’ll get</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
            <h3 className="font-bold text-[#0a0a0a]">
              A plan you’ll actually keep
            </h3>
            <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
              Simple structure that doesn’t overwhelm—just enough to keep
              priorities visible and days realistic.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
            <h3 className="font-bold text-[#0a0a0a]">
              Planned vs actual insight
            </h3>
            <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
              See the gap between intention and reality without shame—so you can
              adjust with clarity.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
            <h3 className="font-bold text-[#0a0a0a]">
              Attention &amp; screen-time awareness
            </h3>
            <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
              Connect the dots between what you say matters and what you
              actually spend time on.
            </p>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
            <h3 className="font-bold text-[#0a0a0a]">A gentle coach</h3>
            <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
              Helpful nudges and reflection prompts that keep you
              aligned—without turning life into a spreadsheet.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">
          Built by The Data Group
        </h2>
        <p className="text-[#52525b] leading-relaxed">
          Today Matters is a product of{" "}
          <span className="font-semibold text-[#0a0a0a]">The Data Group</span>.
          We apply the same “own the truth, act on it” mindset from modern data
          work to the most important system you manage: your daily life.
        </p>
      </section>
    </PageLayout>
  );
}
