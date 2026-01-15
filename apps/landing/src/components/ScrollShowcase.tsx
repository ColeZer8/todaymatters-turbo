"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Image from "next/image";

interface FloatingCard {
  type: "metric" | "icon" | "mini-graph";
  label?: string;
  value?: string;
  status?: string;
  statusColor?: string;
  icon?: string;
  position: { x: number; y: number };
  rotate: number;
  delay: number;
  size: "sm" | "md" | "lg";
}

interface ShowcaseItem {
  id: "home" | "calendar" | "analytics" | "communications";
  title: string;
  description: string;
  screenshotPath: string;
  bgImagePath: string;
  calloutPlacement: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  floatingCards: FloatingCard[];
  accentColor: string;
}

export const ScrollShowcase = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const items: ShowcaseItem[] = useMemo(
    () => [
      {
        id: "home",
        title: "Good morning.",
        description:
          "Your Big 3, schedule, and pending actions — so you always know what matters next.",
        screenshotPath: "/screenshots/home.png",
        bgImagePath: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1920&q=80",
        calloutPlacement: "topLeft",
        accentColor: "#2563EB",
        floatingCards: [
          { type: "metric", label: "Day", value: "13,653", status: "of your life", statusColor: "#2563EB", position: { x: -280, y: -100 }, rotate: -4, delay: 0.1, size: "md" },
          { type: "icon", icon: "☀️", position: { x: -180, y: 140 }, rotate: 8, delay: 0.2, size: "sm" },
          { type: "metric", label: "Big 3", value: "3", status: "priorities", statusColor: "#10B981", position: { x: 300, y: -80 }, rotate: 6, delay: 0.15, size: "md" },
          { type: "icon", icon: "📅", position: { x: 260, y: 180 }, rotate: -6, delay: 0.25, size: "sm" },
        ]
      },
      {
        id: "calendar",
        title: "Planned vs. Actual.",
        description:
          "Compare your ideal day against reality and see exactly where time drifted.",
        screenshotPath: "/screenshots/calendar.png",
        bgImagePath: "https://images.unsplash.com/photo-1506784365847-bbad939e9335?w=1920&q=80",
        calloutPlacement: "topRight",
        accentColor: "#8B5CF6",
        floatingCards: [
          { type: "metric", label: "Planned", value: "8h", status: "scheduled", statusColor: "#8B5CF6", position: { x: -300, y: -90 }, rotate: -6, delay: 0.1, size: "md" },
          { type: "metric", label: "Actual", value: "6.5h", status: "completed", statusColor: "#F59E0B", position: { x: 320, y: -60 }, rotate: 4, delay: 0.15, size: "md" },
          { type: "icon", icon: "⏰", position: { x: -200, y: 160 }, rotate: 10, delay: 0.2, size: "sm" },
          { type: "icon", icon: "✓", position: { x: 280, y: 200 }, rotate: -8, delay: 0.25, size: "sm" },
        ]
      },
      {
        id: "analytics",
        title: "Performance Insight.",
        description:
          "Track time spent vs. goals across Faith, Family, Work, and Health.",
        screenshotPath: "/screenshots/analytics.png",
        bgImagePath: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&q=80",
        calloutPlacement: "bottomLeft",
        accentColor: "#10B981",
        floatingCards: [
          { type: "mini-graph", label: "Faith", value: "45m", status: "+15m", statusColor: "#F97316", position: { x: -320, y: -60 }, rotate: -5, delay: 0.1, size: "lg" },
          { type: "mini-graph", label: "Work", value: "6h", status: "on track", statusColor: "#2563EB", position: { x: 340, y: -100 }, rotate: 6, delay: 0.15, size: "lg" },
          { type: "metric", label: "Score", value: "45", status: "Today", statusColor: "#EF4444", position: { x: -240, y: 180 }, rotate: 8, delay: 0.2, size: "md" },
          { type: "icon", icon: "📊", position: { x: 300, y: 200 }, rotate: -4, delay: 0.25, size: "sm" },
        ]
      },
      {
        id: "communications",
        title: "Communications.",
        description:
          "Messages unified and prioritized so you can respond with intention.",
        screenshotPath: "/screenshots/communications.png",
        bgImagePath: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1920&q=80",
        calloutPlacement: "bottomRight",
        accentColor: "#EC4899",
        floatingCards: [
          { type: "metric", label: "Pending", value: "4", status: "messages", statusColor: "#EC4899", position: { x: -300, y: -80 }, rotate: -6, delay: 0.1, size: "md" },
          { type: "icon", icon: "💬", position: { x: -200, y: 140 }, rotate: 12, delay: 0.2, size: "sm" },
          { type: "metric", label: "Priority", value: "2", status: "urgent", statusColor: "#EF4444", position: { x: 320, y: -60 }, rotate: 5, delay: 0.15, size: "md" },
          { type: "icon", icon: "✉️", position: { x: 260, y: 180 }, rotate: -8, delay: 0.25, size: "sm" },
        ]
      },
    ],
    []
  );

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const index = Math.min(Math.floor(latest * items.length), items.length - 1);
    setActiveIndex(index);
  });

  // Ensure activeItem is always defined - items always has at least one element
  const activeItem: ShowcaseItem = items[activeIndex] ?? items[0]!;
  const mobileFloatingCards = activeItem.floatingCards.filter((c) => c.type !== "icon").slice(0, 2);

  return (
    <section 
      id="features"
      ref={containerRef} 
      className="relative bg-white z-20" 
      style={{ height: `${items.length * 100}vh` }}
    >
      <div className="sticky top-0 min-h-[100svh] md:h-screen overflow-x-hidden overflow-y-visible md:overflow-hidden flex items-center justify-center">
        {/* Immersive Background Layer */}
        <div className="absolute inset-0 z-0">
          {items.map((item, idx) => (
            <motion.div
              key={`bg-${item.id}`}
              initial={false}
              animate={{ 
                opacity: idx === activeIndex ? 0.45 : 0,
                scale: idx === activeIndex ? 1 : 1.1,
              }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${item.bgImagePath})` }}
            />
          ))}
          {/* Soft overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white/20 to-white/50" />
          {/* Radial rings like Bevel */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.8)_100%)]" />
        </div>

        {/* Floating Cards Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          {activeItem.floatingCards.map((card, i) => (
            <motion.div
              key={`${activeItem.id}-card-${i}`}
              initial={{ opacity: 0, scale: 0.6, x: card.position.x * 1.3, y: card.position.y * 1.3, rotate: card.rotate * 1.5 }}
              animate={{ 
                opacity: 1,
                scale: 1,
                x: card.position.x,
                y: card.position.y,
                rotate: card.rotate
              }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ 
                duration: 0.7, 
                delay: card.delay,
                ease: [0.23, 1, 0.32, 1]
              }}
              className="absolute hidden lg:block"
            >
              <FloatingCardComponent card={card} accentColor={activeItem.accentColor} />
            </motion.div>
          ))}

          {/* Mobile-only floating cards (Bevel-style) */}
          {mobileFloatingCards.map((card, i) => {
            const pos = getMobileFloatingPosition(card.position, i);
            return (
              <motion.div
                key={`${activeItem.id}-mobile-card-${i}`}
                initial={{ opacity: 0, scale: 0.9, x: pos.x, y: pos.y, rotate: card.rotate * 0.5 }}
                animate={{ opacity: 1, scale: 0.92, x: pos.x, y: pos.y, rotate: card.rotate * 0.5 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                className="absolute lg:hidden"
              >
                <FloatingCardComponent card={card} accentColor={activeItem.accentColor} />
              </motion.div>
            );
          })}
        </div>

        <div className="relative z-20 w-full max-w-7xl mx-auto px-6 min-h-[100svh] md:h-full flex flex-col items-center justify-start pt-10 pb-10 md:justify-center md:pt-0 md:pb-0">
          <div className="relative flex items-center justify-center w-full">
            <div className="relative w-full max-w-[360px] md:w-[400px]">
              {/* Mobile-only header (Bevel-style) - more compact */}
              <div className="mb-4 text-center lg:hidden px-4">
                <div
                  className="mx-auto mb-2 h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: activeItem.accentColor,
                    boxShadow: `0 0 16px ${activeItem.accentColor}70`,
                  }}
                />
                <motion.div
                  key={`header-${activeItem.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-2xl font-bold text-[#0a0a0a] tracking-tight leading-tight"
                >
                  {activeItem.title}
                </motion.div>
                <motion.div
                  key={`desc-${activeItem.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                  className="mt-2 text-sm text-[#52525b] leading-relaxed max-w-xs mx-auto"
                >
                  {activeItem.description}
                </motion.div>
              </div>

              {/* Callouts */}
              {items.map((item, idx) => (
                <Callout
                  key={item.id}
                  item={item}
                  isActive={idx === activeIndex}
                />
              ))}

              {/* iPhone 16 Pro Mockup - smaller on mobile to ensure the full device is always visible */}
              <div className="relative mx-auto mt-6 w-[260px] sm:w-[280px] md:w-[400px] aspect-[9/19.5] bg-[#1a1a1a] rounded-[3.5rem] p-[10px] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.4)] ring-[1.5px] ring-black/10">
                {/* Modern Dynamic Island */}
                <div className="absolute top-[1.1rem] left-1/2 -translate-x-1/2 w-[5.5rem] h-7 bg-black rounded-full z-50 flex items-center px-2 justify-between">
                  <div className="w-2 h-2 rounded-full bg-[#1a1a1a]" />
                  <div className="w-3 h-3 rounded-full bg-[#0a0a0a] ring-1 ring-white/5" />
                </div>

                {/* Side Buttons */}
                <div className="absolute -left-[2px] top-[22%] w-[3px] h-8 bg-[#2a2a2a] rounded-l-sm" />
                <div className="absolute -left-[2px] top-[32%] w-[3px] h-14 bg-[#2a2a2a] rounded-l-sm" />
                <div className="absolute -right-[2px] top-[28%] w-[3px] h-16 bg-[#2a2a2a] rounded-r-sm" />

                {/* Inner Display - Matching screenshot background color exactly */}
                <div className="w-full h-full bg-[#F8FAFC] rounded-[3rem] overflow-hidden relative">
                  {/* Status bar mask - exact match to screenshot bg */}
                  <div className="absolute top-0 left-0 right-0 h-12 bg-[#F8FAFC] z-30" />
                  
                  {items.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={false}
                      animate={{ 
                        opacity: idx === activeIndex ? 1 : 0, 
                        scale: idx === activeIndex ? 1 : 0.98,
                      }}
                      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={item.screenshotPath}
                        alt={item.title}
                        fill
                        className="object-cover object-top"
                        priority={idx === 0}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Progress Dots - Hidden */}
              <div className="mt-12 flex items-center justify-center gap-4 opacity-0 pointer-events-none">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    animate={{
                      backgroundColor: idx === activeIndex ? item.accentColor : "#e5e7eb",
                      width: idx === activeIndex ? 36 : 10,
                    }}
                    transition={{ duration: 0.3 }}
                    className="h-[10px] rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section Transition Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-28 sm:h-32 bg-gradient-to-t from-white via-white/95 to-transparent md:h-48 md:from-white md:via-transparent md:to-transparent z-30 pointer-events-none" />
      </div>

    </section>
  );
};

/* Floating Card Component - Mimics Bevel's metric cards */
function FloatingCardComponent({ card, accentColor }: { card: FloatingCard; accentColor: string }) {
  const sizeClasses = {
    sm: "w-14 h-14",
    md: "w-40 h-auto",
    lg: "w-48 h-auto",
  };

  if (card.type === "icon") {
    return (
      <motion.div 
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
        className={`${sizeClasses[card.size]} rounded-2xl bg-white/90 backdrop-blur-xl shadow-xl border border-white/50 flex items-center justify-center text-2xl`}
      >
        {card.icon}
      </motion.div>
    );
  }

  if (card.type === "mini-graph") {
    return (
      <motion.div 
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className={`${sizeClasses[card.size]} rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/60 p-4`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{card.label}</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${card.statusColor}15`, color: card.statusColor }}>
            {card.status}
          </span>
        </div>
        <div suppressHydrationWarning className="text-2xl font-bold text-gray-900">
          {card.value}
        </div>
        {/* Mini bar graph */}
        <div className="flex items-end gap-1 mt-3 h-6">
          {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8].map((h, i) => (
            <div 
              key={i} 
              className="flex-1 rounded-sm"
              style={{ height: `${h * 100}%`, backgroundColor: i === 3 ? accentColor : `${accentColor}30` }}
            />
          ))}
        </div>
      </motion.div>
    );
  }

  // Default metric card
  return (
    <motion.div 
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
      className={`${sizeClasses[card.size]} rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/60 p-4`}
    >
      <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{card.label}</div>
      <div suppressHydrationWarning className="text-3xl font-bold text-gray-900">
        {card.value}
      </div>
      <div className="text-xs font-medium mt-1" style={{ color: card.statusColor }}>
        {card.status}
      </div>
    </motion.div>
  );
}

function Callout({
  item,
  isActive,
}: {
  item: ShowcaseItem;
  isActive: boolean;
}) {
  const placementClasses: Record<ShowcaseItem["calloutPlacement"], string> = {
    topLeft: "left-[-320px] top-[-20px]",
    topRight: "right-[-320px] top-[-20px]",
    bottomLeft: "left-[-320px] bottom-[100px]",
    bottomRight: "right-[-320px] bottom-[100px]",
  };

  return (
    <motion.div
      className={`absolute ${placementClasses[item.calloutPlacement]} hidden lg:block w-[300px] z-30`}
      initial={false}
      animate={{
        opacity: isActive ? 1 : 0,
        scale: isActive ? 1 : 0.96,
        x: isActive ? 0 : (item.calloutPlacement.includes("Left") ? -15 : 15),
      }}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div
        className={`rounded-[2rem] border bg-white/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-7 transition-all duration-500 ${
          isActive ? "border-gray-200/80 shadow-[0_30px_60px_rgba(0,0,0,0.1)]" : "border-transparent"
        }`}
      >
        <div className="flex flex-col gap-3">
          <div
            className="h-3 w-3 rounded-full shrink-0 transition-all duration-500"
            style={{ 
              backgroundColor: isActive ? item.accentColor : "#d1d5db",
              boxShadow: isActive ? `0 0 20px ${item.accentColor}50` : "none"
            }}
          />
          <div>
            <div className={`text-xl font-bold transition-colors duration-500 ${isActive ? "text-gray-900" : "text-gray-300"} leading-tight tracking-tight`}>
              {item.title}
            </div>
            <div className={`mt-2 text-[15px] transition-colors duration-500 ${isActive ? "text-gray-600" : "text-gray-300"} leading-relaxed`}>
              {item.description}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function getMobileFloatingPosition(
  pos: { x: number; y: number },
  index: number
): { x: number; y: number } {
  // Desktop positions are large (±300px). Mobile needs gentler offsets.
  const baseX = clamp(pos.x * 0.35, -140, 140);
  const baseY = clamp(pos.y * 0.35, -160, 160);
  const nudgeX = index % 2 === 0 ? -20 : 20;
  const nudgeY = index % 2 === 0 ? 10 : -10;
  return { x: baseX + nudgeX, y: baseY + nudgeY };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
