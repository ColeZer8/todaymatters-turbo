import { PageLayout } from "@/components/PageLayout";

export default function DataIsHonestPost() {
  return (
    <PageLayout
      title="Data is honest (when it’s your own)"
      description="Inspired by The Data Group’s “data is honest” idea—applied to time, attention, and habits."
    >
      <p className="text-[#52525b] leading-relaxed">
        The Data Group says data is honest—because it’s one of the few unbiased
        sources of truth. Today Matters brings that same idea down to earth:
        your calendar, your screen time, and your daily logs don’t lie.
      </p>

      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">
          The goal isn’t guilt
        </h2>
        <p className="mt-3 text-sm text-[#52525b] leading-relaxed">
          Truth is useful when it leads to action. Planned vs actual helps you
          adjust your week with compassion: protect your priorities, reduce
          noise, and build days you can repeat.
        </p>
      </div>
    </PageLayout>
  );
}
