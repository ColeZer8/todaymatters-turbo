"use client";

import { useEffect } from "react";

interface ScrollSnapControllerProps {
  enabled: boolean;
}

export const ScrollSnapController = ({ enabled }: ScrollSnapControllerProps) => {
  useEffect(() => {
    const root = document.documentElement;

    if (enabled) {
      root.setAttribute("data-scroll-snap", "on");
      return () => {
        root.removeAttribute("data-scroll-snap");
      };
    }

    root.removeAttribute("data-scroll-snap");
    return;
  }, [enabled]);

  return null;
};


