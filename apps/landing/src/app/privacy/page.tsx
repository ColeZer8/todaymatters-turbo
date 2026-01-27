import { PageLayout } from "@/components/PageLayout";

export default function PrivacyPage() {
  return (
    <PageLayout
      title="Privacy Policy"
      description="A simple summary. This page will be replaced with formal privacy documentation before launch."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">What we collect</h2>
        <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
          We collect only what we need to run the app and improve it (account
          details, usage analytics, and any info you explicitly enter to plan
          and reflect).
        </p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">How we use it</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-[#52525b] space-y-2">
          <li>Provide and improve Today Matters</li>
          <li>Keep your account secure</li>
          <li>Understand feature usage to build better experiences</li>
        </ul>
      </div>
    </PageLayout>
  );
}
