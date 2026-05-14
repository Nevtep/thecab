export function getLandingScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") {
    return "auto";
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function scrollToLandingTarget(targetId?: string) {
  if (!targetId) {
    return;
  }

  const target = document.getElementById(targetId);
  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: getLandingScrollBehavior(),
    block: "start",
  });
}