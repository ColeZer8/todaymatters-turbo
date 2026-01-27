"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Handle background change
      setIsScrolled(currentScrollY > 20);

      // Handle visibility (Only show at the very top)
      if (currentScrollY > 60) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <nav
      className={clsx(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 transform",
        isScrolled
          ? "bg-white/90 backdrop-blur-xl shadow-sm py-4"
          : "bg-transparent py-6",
        isVisible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo - Modern professional design */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 bg-gradient-to-br from-brand-primary to-[#1e40af] rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/25 group-hover:shadow-xl group-hover:shadow-brand-primary/30 transition-all duration-300 group-hover:scale-105">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-white/10 rounded-2xl" />
            <span
              className="relative text-white font-bold text-base tracking-tight"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              TM
            </span>
          </div>
          <span className="text-lg font-bold text-brand-primary tracking-tight hidden sm:inline">
            Today Matters
          </span>
        </Link>

        {/* Nav links - Bevel style */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/about"
            className="text-sm font-medium text-[#52525b] hover:text-[#0a0a0a] transition-colors"
          >
            About us
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-[#52525b] hover:text-[#0a0a0a] transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/download"
            className="text-sm font-semibold text-[#0a0a0a] hover:text-brand-primary transition-colors"
          >
            Download App
          </Link>
        </div>

        {/* Mobile menu button */}
        <button className="md:hidden w-10 h-10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[#0a0a0a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>
    </nav>
  );
};
