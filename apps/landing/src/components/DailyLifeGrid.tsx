"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Calendar, BarChart3, Brain, Target } from "lucide-react";

const features = [
  {
    icon: Calendar,
    label: "Ideal Day",
    title: "Design your perfect day",
    description: "Plan how you want to spend time across what matters most.",
    color: "#3B82F6",
  },
  {
    icon: BarChart3,
    label: "Analytics",
    title: "See where time actually goes",
    description: "Real-time tracking shows the gap between planned and actual.",
    color: "#8B5CF6",
  },
  {
    icon: Brain,
    label: "AI Coach",
    title: "Wisdom when you need it",
    description: "Get personalized nudges based on your patterns and values.",
    color: "#EC4899",
  },
  {
    icon: Target,
    label: "Goals",
    title: "Track what matters",
    description: "Set and monitor goals across faith, family, work, and health.",
    color: "#F59E0B",
  },
];

export const DailyLifeGrid = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const [isAnimating, setIsAnimating] = useState(false);

  // Track animation state
  useEffect(() => {
    if (isInView) {
      setIsAnimating(true);
      // Total animation time: 0.6s initial delay + (0.2s * 4 cards) + 1.2s animation duration
      const timeout = setTimeout(() => setIsAnimating(false), 2600);
      return () => clearTimeout(timeout);
    }
  }, [isInView]);

  return (
    <section
      ref={ref}
      className="relative min-h-screen pt-10 pb-20 md:pt-12 md:pb-24 bg-gradient-to-b from-white via-[#fafafa] to-white overflow-hidden"
    >
      {/* Animated Background Patterns */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial Gradient Orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Floating Shapes */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-brand-primary/20 rounded-full"
            style={{
              left: `${(i * 13 + 10) % 90}%`,
              top: `${(i * 17 + 20) % 80}%`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, Math.sin(i) * 20, 0],
              opacity: [0.2, 0.6, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 4 + i * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}

        {/* Grid Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #0a0a0a 1px, transparent 1px),
              linear-gradient(to bottom, #0a0a0a 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-5xl font-bold text-[#0a0a0a] tracking-tight mb-6"
          >
            Designed for Daily Life
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-[#52525b] max-w-2xl mx-auto"
          >
            From planning and tracking to coaching and reflection, Today Matters helps you stay aligned with your calling every single day.
          </motion.p>
        </div>

        {/* Feature grid - Enhanced Bevel style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
              whileHover={!isAnimating ? { 
                y: -8,
                transition: { duration: 0.3 }
              } : {}}
              className={`group relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 border border-gray-100/50 transition-all duration-500 overflow-hidden ${
                !isAnimating ? 'hover:border-gray-200 hover:shadow-2xl hover:shadow-black/10' : ''
              }`}
            >
              {/* Highlight Flash Animation - Slower and more intentional */}
              <motion.div
                className="absolute inset-0 rounded-3xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={isInView ? {
                  opacity: [0, 0.7, 0.7, 0],
                  scale: [0.92, 1.02, 1, 1],
                } : {}}
                transition={{
                  duration: 1.2,
                  delay: 0.6 + index * 0.2,
                  ease: [0.25, 0.1, 0.25, 1],
                  times: [0, 0.3, 0.7, 1]
                }}
                style={{
                  background: `radial-gradient(circle at center, ${feature.color}35, transparent 70%)`,
                  boxShadow: `0 0 50px ${feature.color}50`,
                }}
              />
              {/* Animated gradient on hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${feature.color}15, transparent 70%)`,
                }}
              />

              <div className="relative z-10">
                <div className="mb-6">
                  <span className="text-xs font-bold text-brand-primary tracking-wider uppercase">
                    {feature.label}
                  </span>
                </div>
                
                {/* Icon with animated background */}
                <motion.div 
                  className="relative w-14 h-14 bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-md flex items-center justify-center mb-6 group-hover:shadow-xl transition-shadow duration-500"
                  whileHover={!isAnimating ? { scale: 1.1, rotate: 5 } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `linear-gradient(135deg, ${feature.color}20, transparent)`,
                    }}
                  />
                  <feature.icon 
                    className="relative z-10 w-7 h-7 text-brand-primary group-hover:scale-110 transition-transform duration-300" 
                  />
                </motion.div>

                <h3 className="text-xl font-bold text-[#0a0a0a] mb-3 tracking-tight leading-tight group-hover:text-brand-primary transition-colors duration-300">
                  {feature.title.split(" ").slice(0, -1).join(" ")}<br />
                  <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">
                    {feature.title.split(" ").slice(-1)}
                  </span>
                </h3>
                
                <p className="text-sm text-[#52525b] leading-relaxed group-hover:text-[#0a0a0a] transition-colors duration-300">
                  {feature.description}
                </p>
              </div>

              {/* Corner accent */}
              <motion.div
                className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: `radial-gradient(circle at top right, ${feature.color}10, transparent 70%)`,
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
