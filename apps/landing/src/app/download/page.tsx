import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

export default function DownloadPage() {
  return (
    <PageLayout
      title="Download Today Matters"
      description="We’re getting ready for launch. For now, join the waitlist and we’ll notify you the moment it’s live."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0a0a0a]">iOS</h2>
          <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
            Coming soon. When we publish to the App Store, this page will link directly.
          </p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#0a0a0a]">Android</h2>
          <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
            Coming soon. When we publish to Google Play, this page will link directly.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-[#fafafa] p-6">
        <h2 className="text-lg font-bold text-[#0a0a0a]">Want early access?</h2>
        <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
          Tell us what you’re trying to change in your daily life—sleep, focus, family time, faith rhythms, or something
          else—and we’ll prioritize the right onboarding.
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#0a0a0a] px-6 py-3 text-sm font-semibold text-white hover:bg-[#171717] transition-colors"
        >
          Contact us
        </Link>
      </div>
    </PageLayout>
  );
}


