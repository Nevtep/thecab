export const cabMotion = {
  duration: {
    fast: 150,
    normal: 220,
    slow: 300,
  },
  easing: {
    enter: "cubic-bezier(0, 0, 0.2, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

export const cabReducedMotionQuery = "(prefers-reduced-motion: reduce)";
