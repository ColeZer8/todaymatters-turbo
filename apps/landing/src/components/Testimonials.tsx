"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const testimonials = [
  {
    title: "Life changing",
    author: "Sarah M.",
    date: "Dec 15, 2025",
    text: "This app changed how I look at my time. I realized I was spending 3 hours on my phone while my kids were awake. Now I'm actually present with them.",
    rating: 5,
  },
  {
    title: "Finally, accountability that works",
    author: "Michael R.",
    date: "Dec 10, 2025",
    text: "The planned vs actual view is genius. Seeing the gap between what I said I'd do and what I actually did was the wake-up call I needed.",
    rating: 5,
  },
  {
    title: "Perfect for faith-driven living",
    author: "Rebecca L.",
    date: "Nov 28, 2025",
    text: "Finally an app that includes my faith as a priority. Living intentionally has never been this clear. The AI coach feels like having a wise mentor.",
    rating: 5,
  },
  {
    title: "Worth every minute",
    author: "David K.",
    date: "Nov 22, 2025",
    text: "I've tried every productivity app out there. This is the first one that actually helped me spend MORE time with my family, not less.",
    rating: 5,
  },
  {
    title: "The app I always wanted",
    author: "John D.",
    date: "Nov 05, 2025",
    text: "The integration with screen time is genius. It doesn't just track, it actually coaches me to be better. Best investment I've made in myself.",
    rating: 5,
  },
  {
    title: "Feels like a daily reset button",
    author: "Emily S.",
    date: "Dec 27, 2025",
    text: "I start my mornings with a plan and end my evenings with clarity. The way it keeps my priorities visible is simple but powerful.",
    rating: 5,
  },
  {
    title: "Made my weeks calmer",
    author: "Jason P.",
    date: "Dec 23, 2025",
    text: "I stopped overbooking myself. Seeing planned vs actual helped me set realistic days and actually keep my commitments.",
    rating: 5,
  },
  {
    title: "The best kind of accountability",
    author: "Hannah T.",
    date: "Dec 19, 2025",
    text: "Not guilt. Just gentle insight. The coaching feels human and keeps me aligned with what I say matters most.",
    rating: 5,
  },
  {
    title: "Finally, my time matches my values",
    author: "Mark L.",
    date: "Dec 18, 2025",
    text: "I thought I was busy with important things — I wasn’t. This helped me protect family time and still get meaningful work done.",
    rating: 5,
  },
  {
    title: "The UI is gorgeous",
    author: "Olivia N.",
    date: "Dec 14, 2025",
    text: "Everything feels intentional — from the flows to the little details. It’s the first app I’ve used that makes me want to keep showing up.",
    rating: 5,
  },
  {
    title: "My screen time finally makes sense",
    author: "Chris B.",
    date: "Dec 12, 2025",
    text: "It’s not just tracking — it connects the dots. I can see where my attention leaks happen and fix them before the day is gone.",
    rating: 5,
  },
  {
    title: "Helped me follow through",
    author: "Priya K.",
    date: "Dec 08, 2025",
    text: "The structure is simple enough to stick with, but deep enough to grow with you. My 'Big 3' actually happen now.",
    rating: 5,
  },
  {
    title: "A calmer way to plan",
    author: "Daniela R.",
    date: "Dec 06, 2025",
    text: "I used to spiral in planning apps. This one keeps me grounded — like a clear map for the day, not a to-do list that shames you.",
    rating: 5,
  },
  {
    title: "More present at home",
    author: "Brian W.",
    date: "Dec 03, 2025",
    text: "The reminders around boundaries are huge. I’m finishing work on time and showing up for dinner without my mind still at the office.",
    rating: 5,
  },
  {
    title: "Exactly what I needed",
    author: "Sophia A.",
    date: "Nov 30, 2025",
    text: "It helped me stop saying yes to everything. I can see my week clearly and make tradeoffs without regret.",
    rating: 5,
  },
  {
    title: "A coach that doesn't overwhelm",
    author: "Noah G.",
    date: "Nov 26, 2025",
    text: "The nudges are timely and kind. It’s like having someone who understands your goals and gently steers you back on track.",
    rating: 5,
  },
  {
    title: "My days feel intentional again",
    author: "Grace F.",
    date: "Nov 18, 2025",
    text: "I was drifting through weeks. Now I have a rhythm: plan, live, reflect. It’s changing the way I make decisions.",
    rating: 5,
  },
  {
    title: "Simple, but deep",
    author: "Aiden J.",
    date: "Nov 12, 2025",
    text: "It’s easy to start, but the insights get better the more you use it. The planned vs actual view is a game-changer.",
    rating: 5,
  },
  {
    title: "Helps me protect what matters",
    author: "Leah C.",
    date: "Nov 09, 2025",
    text: "I can finally defend my priorities with a plan. It’s helping me say no to noise and yes to the people I love.",
    rating: 5,
  },
  {
    title: "My favorite productivity app",
    author: "Ethan V.",
    date: "Nov 02, 2025",
    text: "It’s not hustle culture. It’s alignment. I’ve tried everything — this is the first one that feels like it respects real life.",
    rating: 5,
  },
];

const StarRating = () => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <svg
        key={i}
        className="w-4 h-4 text-yellow-400 fill-current"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

export const Testimonials = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  // Double the testimonials for seamless looping
  const doubledTestimonials = [...testimonials, ...testimonials];

  return (
    <section
      ref={ref}
      className="min-h-screen pt-10 pb-20 md:pt-12 md:pb-24 bg-white overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-[#0a0a0a] tracking-tight mb-4"
        >
          Crafted with Care.
          <br />
          <span className="text-brand-primary">Loved Everywhere.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg text-[#52525b] max-w-2xl"
        >
          Don't take our word for it. See why Today Matters is trusted by people
          who want to live more intentionally.
        </motion.p>
      </div>

      {/* Marquee testimonials - Bevel style */}
      <div className="relative">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* First row - scrolling left */}
        <div className="flex animate-marquee mb-6">
          {doubledTestimonials.map((t, i) => (
            <div
              key={`row1-${i}`}
              className="flex-shrink-0 w-[400px] mx-3 bg-[#fafafa] rounded-3xl p-6 border border-gray-100"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <StarRating />
                  <h4 className="font-bold text-[#0a0a0a] mt-2">{t.title}</h4>
                  <p className="text-xs text-[#71717a]">
                    {t.author}, {t.date}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#52525b] leading-relaxed">
                "{t.text}"
              </p>
            </div>
          ))}
        </div>

        {/* Second row - scrolling right (reversed direction) */}
        <div
          className="flex animate-marquee"
          style={{ animationDirection: "reverse" }}
        >
          {doubledTestimonials
            .slice()
            .reverse()
            .map((t, i) => (
              <div
                key={`row2-${i}`}
                className="flex-shrink-0 w-[400px] mx-3 bg-[#fafafa] rounded-3xl p-6 border border-gray-100"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <StarRating />
                    <h4 className="font-bold text-[#0a0a0a] mt-2">{t.title}</h4>
                    <p className="text-xs text-[#71717a]">
                      {t.author}, {t.date}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[#52525b] leading-relaxed">
                  "{t.text}"
                </p>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
};
