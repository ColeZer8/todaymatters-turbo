"use client";

import { motion } from "framer-motion";

export const Hero = () => {
  return (
    <section className="relative h-screen overflow-hidden">
      {/* Background Image - Bevel style landscape */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')`,
          }}
        />
        {/* Gradient overlay matching Bevel */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/70 to-white/95" />
      </div>

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center text-center">
          {/* Main headline - "Today Matters" in blue */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-[3.5rem] md:text-[5.5rem] lg:text-[6.5rem] font-bold text-brand-primary tracking-[-0.04em] mb-6 leading-[0.95] max-w-5xl"
            suppressHydrationWarning
          >
            Today Matters
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="text-lg md:text-xl text-[#52525b] max-w-2xl mb-12 leading-relaxed font-medium"
            suppressHydrationWarning
          >
            Control your day, transform your life!
          </motion.p>

          {/* Download buttons - iOS and Android */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex flex-col sm:flex-row items-center gap-4"
          >
            {/* iOS Download */}
            <a
              href="#"
              className="group inline-flex items-center gap-3 bg-[#0a0a0a] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#171717] transition-all duration-300 shadow-xl shadow-black/10 hover:scale-105"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span>Download for iOS</span>
            </a>

            {/* Android Download */}
            <a
              href="#"
              className="group inline-flex items-center gap-3 bg-[#0a0a0a] text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-[#171717] transition-all duration-300 shadow-xl shadow-black/10 hover:scale-105"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z"/>
              </svg>
              <span>Download for Android</span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
