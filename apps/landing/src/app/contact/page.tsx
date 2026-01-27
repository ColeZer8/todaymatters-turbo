import { PageLayout } from "@/components/PageLayout";

export default function ContactPage() {
  return (
    <PageLayout
      title="Contact"
      description="Start a conversation. Tell us what you’re trying to change, and we’ll help you find the next step."
    >
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Email</h2>
        <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
          For now, reach us at{" "}
          <span className="font-semibold text-[#0a0a0a]">
            hello@todaymatters.app
          </span>
          .
        </p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">What to include</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-[#52525b] space-y-2">
          <li>
            Your main goal (focus, family time, faith rhythm, health, etc.)
          </li>
          <li>Where you feel stuck</li>
          <li>What “a great week” would look like</li>
        </ul>
      </div>
    </PageLayout>
  );
}
