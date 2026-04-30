import { cn } from "@/lib/utils";

/**
 * Sticky frosted-glass strip for tab triggers (and any other content that
 * should pin to the top while the page scrolls underneath). Negative
 * horizontal margins pull the blur to the edges of the page's padding so
 * the chrome reads edge-to-edge — pages with `p-6 lg:p-10` and the
 * `max-w-3xl mx-auto py-8 px-6` Settings layout both work because the
 * negative margins are scoped within their container.
 *
 * Usage:
 *   <Tabs>
 *     <StickyTabsBar>
 *       <TabsList>...</TabsList>
 *     </StickyTabsBar>
 *     <TabsContent>...</TabsContent>
 *   </Tabs>
 */
export function StickyTabsBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Stacks below the StickyPageHeader when one is present (the
        // header sets --page-header-h via ResizeObserver). Falls back to
        // top:0 on pages without a sticky header.
        "sticky z-20 mb-4 top-[var(--page-header-h,0px)]",
        "-mx-6 lg:-mx-10 px-6 lg:px-10 py-2",
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
