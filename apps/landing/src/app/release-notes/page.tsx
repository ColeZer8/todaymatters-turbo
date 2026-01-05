import { PageLayout } from "@/components/PageLayout";

const notes = [
  {
    version: "0.1",
    date: "2026",
    items: [
      "Core daily planning flow (Big 3 + realistic schedule)",
      "Planned vs actual review loop",
      "Early attention/screen-time insights",
      "First pass on the coaching experience",
    ],
  },
];

export default function ReleaseNotesPage() {
  return (
    <PageLayout
      title="Release notes"
      description="What’s new in Today Matters. We ship small improvements that make your daily rhythm smoother."
    >
      <div className="space-y-6">
        {notes.map((n) => (
          <div key={n.version} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-bold text-[#0a0a0a]">v{n.version}</h2>
              <span className="text-xs text-[#71717a]">{n.date}</span>
            </div>
            <ul className="mt-4 list-disc pl-5 text-sm text-[#52525b] space-y-2">
              {n.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}


