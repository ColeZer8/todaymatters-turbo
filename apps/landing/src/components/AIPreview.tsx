"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { clsx } from "clsx";

const panels = [
  {
    id: "planning",
    label: "Planning Your Day",
    title: "Step into your calling",
    bgImage: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1920&q=80",
    messages: [
      {
        type: "user",
        text: "Help me plan tomorrow. I want to focus on family and still hit my work goals.",
      },
      {
        type: "assistant",
        header: "Your ideal day is ready ✨",
        content: (
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-inner">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">Schedule</span>
                <span className="text-[10px] text-white/60">7 blocks</span>
              </div>
              <div className="space-y-2">
                {[
                  { time: "6 AM", task: "Morning Prayer", color: "bg-orange-400" },
                  { time: "8 AM", task: "Deep Work", color: "bg-sky-400" },
                  { time: "5 PM", task: "Family Dinner", color: "bg-indigo-400" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={clsx("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", item.color)} />
                    <span className="text-xs font-semibold text-white/90 w-10">{item.time}</span>
                    <span className="text-xs text-white/70">{item.task}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm font-medium text-white/80 leading-relaxed">
              This protects <strong>3+ hours</strong> of family time while hitting your targets.
            </p>
          </div>
        ),
      },
    ],
  },
  {
    id: "accountability",
    label: "Getting Accountability",
    title: "Gentle coaching",
    bgImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1920&q=80",
    messages: [
      {
        type: "assistant",
        header: "Afternoon check-in 📍",
        content: (
          <div className="space-y-4">
            <p className="text-[15px] font-medium text-white/90 leading-relaxed">
              You planned a <strong>hard stop at 5 PM</strong>, but I noticed you're still at the office.
            </p>
            <p className="text-sm text-white/70">
              This is the 3rd time this week. Want me to help you build a shutdown ritual?
            </p>
            <div className="flex gap-2 pt-2">
              <div className="px-4 py-2 bg-white text-black rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-transform cursor-pointer">Yes, help me</div>
              <div className="px-4 py-2 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full text-xs font-bold hover:bg-white/20 transition-colors cursor-pointer">Later</div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "reflection",
    label: "Weekly Reflection",
    title: "Resetting",
    bgImage: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1920&q=80",
    messages: [
      {
        type: "assistant",
        header: "Almost a full recharge ⚡️",
        content: (
          <div className="space-y-4">
            <p className="text-[15px] font-medium text-white/90 leading-relaxed">
              You gave your body time to recharge with <strong>strong REM</strong> and <strong>deep sleep</strong>.
            </p>
            <div className="space-y-2 pt-2">
              {[
                "How does this compare to last month?",
                "Any tips for falling asleep faster?",
              ].map((q, i) => (
                <div key={i} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-3 flex items-center justify-between group cursor-pointer transition-all hover:bg-white/20">
                  <span className="text-[13px] font-bold text-white/90">{q}</span>
                  <span className="text-white/40 group-hover:text-white transition-colors">↑</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "balance",
    label: "Finding Balance",
    title: "Clearer focus",
    bgImage: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=80",
    messages: [
      {
        type: "assistant",
        header: "Screen time insight 📱",
        content: (
          <div className="space-y-4">
            <p className="text-[15px] font-medium text-white/90 leading-relaxed">
              Your screen time has been <strong>increasing significantly</strong> during planned family hours.
            </p>
            <p className="text-sm text-white/70 leading-relaxed">
              You averaged <strong>2.5 hours</strong> of phone use between 6-9 PM. Would you like a reminder when you pick up your phone?
            </p>
            <div className="pt-2">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  whileInView={{ width: "75%" }}
                  className="h-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]" 
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] font-bold text-white/40 uppercase">Usage</span>
                <span className="text-[10px] font-bold text-red-400">+45% vs last week</span>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
];

export const AIPreview = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const root = document.documentElement;
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          root.setAttribute("data-page-bg", "dark");
        } else {
          root.removeAttribute("data-page-bg");
        }
      },
      // Trigger when the sticky section meaningfully enters/leaves the viewport.
      { threshold: 0.15 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      root.removeAttribute("data-page-bg");
    };
  }, []);

  return (
    <section 
      ref={containerRef} 
      className="relative bg-[#0a0a0a]"
      style={{ height: `${panels.length * 100}vh` }}
    >
      <div className="sticky top-0 min-h-[100svh] md:h-screen overflow-x-hidden overflow-y-visible md:overflow-hidden">
        {/* Dynamic Panels */}
        {panels.map((panel, index) => (
          <Panel 
            key={panel.id} 
            panel={panel} 
            index={index} 
            totalPanels={panels.length}
            scrollYProgress={scrollYProgress} 
          />
        ))}
      </div>
    </section>
  );
};

function Panel({ 
  panel, 
  index, 
  totalPanels,
  scrollYProgress 
}: { 
  panel: typeof panels[0]; 
  index: number; 
  totalPanels: number;
  scrollYProgress: any;
}) {
  const start = index / totalPanels;
  const end = (index + 1) / totalPanels;
  const isFirst = index === 0;
  const isLast = index === totalPanels - 1;

  // Opacity Fix:
  // Panel 0: Starts visible
  // Last Panel: Ends visible
  // Middle Panels: Fade in and out
  const opacity = useTransform(
    scrollYProgress,
    isFirst 
      ? [0, end - 0.05, end] 
      : isLast
        ? [start, start + 0.05, 1]
        : [start, start + 0.05, end - 0.05, end],
    isFirst
      ? [1, 1, 0]
      : isLast
        ? [0, 1, 1]
        : [0, 1, 1, 0]
  );

  const scale = useTransform(
    scrollYProgress,
    [start, end],
    [1.08, 1]
  );

  const y = useTransform(
    scrollYProgress,
    [start, end],
    [15, -15]
  );

  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {/* Background Image with Deep Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${panel.bgImage})`, scale }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-transparent to-transparent" />
      </div>

      {/* Main Content Composition */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-24 flex flex-col md:flex-row items-center justify-between gap-16 pointer-events-auto">
        <div className="flex-1 text-left">
          <motion.h3 
            style={{ y }}
            className="text-[4.5rem] md:text-[7rem] lg:text-[8.5rem] font-bold text-white leading-[0.85] tracking-[-0.05em] drop-shadow-2xl"
          >
            {panel.title}
          </motion.h3>
        </div>

        <div className="flex-1 w-full max-w-lg">
          <motion.div 
            style={{ y: useTransform(scrollYProgress, [start, end], [30, -30]) }}
            className="space-y-6"
          >
            {panel.messages.map((msg, idx) => (
              <div key={idx} className={clsx(
                "rounded-[2.5rem] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.4)] backdrop-blur-3xl border transition-all duration-500",
                msg.type === "user" 
                  ? "bg-white/10 border-white/10 ml-16" 
                  : "bg-white/5 border-white/5 mr-16"
              )}>
                {msg.header && (
                  <div className="text-[13px] font-bold text-white/90 mb-5 flex items-center gap-2 tracking-tight">
                    {msg.header}
                  </div>
                )}
                {msg.text ? (
                  <p className="text-base font-medium text-white/80 leading-relaxed">
                    {msg.text}
                  </p>
                ) : msg.content}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
