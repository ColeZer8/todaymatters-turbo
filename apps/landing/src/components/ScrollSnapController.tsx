"use client";

import { useEffect } from "react";

interface ScrollSnapControllerProps {
  enabled: boolean;
}

export const ScrollSnapController = ({ enabled }: ScrollSnapControllerProps) => {
  useEffect(() => {
    const root = document.documentElement;

    if (!enabled) {
      root.removeAttribute("data-scroll-snap");
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const apply = () => {
      if (mediaQuery.matches) {
        root.setAttribute("data-scroll-snap", "on");
      } else {
        root.removeAttribute("data-scroll-snap");
      }
    };

    apply();
    mediaQuery.addEventListener("change", apply);

    return () => {
      mediaQuery.removeEventListener("change", apply);
      root.removeAttribute("data-scroll-snap");
    };
  }, [enabled]);

  return null;
};


