import { PageLayout } from "@/components/PageLayout";

export default function CareersPage() {
  return (
    <PageLayout
      title="Careers"
      description="We’re building a calmer, more intentional way to live. If that excites you, we’d love to hear from you."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Open roles</h2>
        <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
          We’re not publicly listing roles yet. If you’re interested, send a note with what you build and why you care
          about intentional living.
        </p>
      </div>
    </PageLayout>
  );
}


