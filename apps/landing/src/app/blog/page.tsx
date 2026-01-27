import Link from "next/link";

import { PageLayout } from "@/components/PageLayout";

const posts = [
  {
    title: "Planned vs actual: the clarity loop",
    description:
      "A simple weekly rhythm to align your calendar with what you say matters most.",
    href: "/blog/planned-vs-actual",
  },
  {
    title: "Attention leaks: why your day disappears",
    description:
      "How to spot the hidden time drains and protect deep work, family time, and rest.",
    href: "/blog/attention-leaks",
  },
  {
    title: "Data is honest (when it’s your own)",
    description:
      "Inspired by The Data Group’s “data is honest” mindset—applied to screen time and habits.",
    href: "/blog/data-is-honest",
  },
];

export default function BlogPage() {
  return (
    <PageLayout
      title="Blog"
      description="Short, practical notes about intentional living, attention, and building a life you actually want."
    >
      <div className="grid gap-4">
        {posts.map((post) => (
          <Link
            key={post.href}
            href={post.href}
            className="group rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <h2 className="text-xl font-bold tracking-tight text-[#0a0a0a] group-hover:text-brand-primary transition-colors">
              {post.title}
            </h2>
            <p className="mt-2 text-sm text-[#52525b] leading-relaxed">
              {post.description}
            </p>
            <p className="mt-4 text-sm font-semibold text-[#0a0a0a]">
              Read more →
            </p>
          </Link>
        ))}
      </div>
    </PageLayout>
  );
}
