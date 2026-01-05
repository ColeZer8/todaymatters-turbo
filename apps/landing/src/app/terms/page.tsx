import { PageLayout } from "@/components/PageLayout";

export default function TermsPage() {
  return (
    <PageLayout
      title="Terms of Service"
      description="A simple, human-readable summary. This page will be replaced with formal terms before launch."
    >
      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <ul className="list-disc pl-5 text-sm text-[#52525b] space-y-2">
          <li>You’re responsible for your account and activity.</li>
          <li>Today Matters is provided “as is” during early access.</li>
          <li>We may update features as we improve the product.</li>
          <li>Don’t misuse the service or attempt to disrupt it.</li>
        </ul>
      </div>
    </PageLayout>
  );
}


