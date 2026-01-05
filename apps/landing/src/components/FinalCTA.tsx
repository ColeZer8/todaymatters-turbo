"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export const FinalCTA = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="relative py-32 bg-gradient-to-b from-white via-[#fafafa] to-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large pulsing orbs */}
        <motion.div
          className="absolute top-1/3 left-1/4 w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(37, 99, 235, 0.06) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/3 right-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(236, 72, 153, 0.06) 0%, transparent 70%)",
          }}
          animate={{
            scale: [1.3, 1, 1.3],
            opacity: [0.7, 0.4, 0.7],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Floating particles */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${(i * 11 + 5) % 95}%`,
              top: `${(i * 13 + 10) % 85}%`,
              width: `${8 + (i % 3) * 4}px`,
              height: `${8 + (i % 3) * 4}px`,
              background: i % 2 === 0 ? "rgba(37, 99, 235, 0.15)" : "rgba(236, 72, 153, 0.15)",
            }}
            animate={{
              y: [0, -40, 0],
              x: [0, Math.sin(i) * 30, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 5 + i * 0.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}

        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.012]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #0a0a0a 1px, transparent 1px),
              linear-gradient(to bottom, #0a0a0a 1px, transparent 1px)
            `,
            backgroundSize: "100px 100px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#0a0a0a] tracking-[-0.04em] mb-8 leading-[0.95]"
        >
          Ready When You Are
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-lg md:text-xl text-[#52525b] mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          Start with one step. One log at a time. Today Matters meets you where you are and helps you move forward with clarity and confidence.
        </motion.p>

        {/* Download buttons - iOS and Android */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
        >
          {/* iOS Download */}
          <Link
            href="/download"
            className="group inline-flex items-center gap-3 bg-[#0a0a0a] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#171717] transition-all duration-300 shadow-xl shadow-black/10 hover:scale-105"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span>Download for iOS</span>
          </Link>

          {/* Android Download */}
          <Link
            href="/download"
            className="group inline-flex items-center gap-3 bg-[#0a0a0a] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#171717] transition-all duration-300 shadow-xl shadow-black/10 hover:scale-105"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z"/>
            </svg>
            <span>Download for Android</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
