import { PageLayout } from "@/components/PageLayout";

export default function InstagramPage() {
  return (
    <PageLayout
      title="Instagram"
      description="We’re not publishing social links yet. For now, the best way to reach us is directly."
    >
      <p className="text-sm text-[#52525b] leading-relaxed">
        If you want updates, product notes, or early access, use the contact
        page and we’ll keep you in the loop.
      </p>
    </PageLayout>
  );
}
