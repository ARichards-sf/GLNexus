import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const HEADER_VAR = "--page-header-h";

/**
 * Sticky page-header chrome. Pins the title block (page name, badges,
 * action buttons) to the top of the scroll container with frosted-glass
 * backdrop, and exposes its measured height as a CSS custom property
 * (`--page-header-h`) so a sibling `StickyTabsBar` can offset itself to
 * stack just below.
 *
 * The variable is reset to `0px` on unmount so pages without a
 * StickyPageHeader fall back cleanly (StickyTabsBar uses
 * `var(--page-header-h, 0px)`).
 */
export function StickyPageHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // useLayoutEffect runs synchronously after DOM mutations, so the var is
  // set before the next paint — avoids a flash of unstacked tabs on
  // initial render.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        HEADER_VAR,
        `${el.offsetHeight}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  // Reset the var when the page unmounts so navigating to a non-tabbed
  // page doesn't leave a stale offset behind.
  useEffect(() => {
    return () => {
      document.documentElement.style.setProperty(HEADER_VAR, "0px");
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "sticky top-0 z-30",
        "-mx-6 lg:-mx-10 px-6 lg:px-10 py-4",
        "bg-background/75 backdrop-blur-lg",
        "border-b border-border/50",
        "supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      {children}
    </div>
  );
}
