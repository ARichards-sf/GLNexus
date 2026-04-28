import { Info } from "lucide-react";
import { useIsDemoUser } from "@/lib/demoMode";

interface DemoAnnotationProps {
  title: string;
  children: React.ReactNode;
  /** Optional shorter tag in the corner badge, defaults to "About". */
  tag?: string;
}

/**
 * Renders a dashed-border "Storybook style" annotation card explaining what
 * the wrapped (or adjacent) UI does. Only visible to the demo / test
 * advisor account — gated by useIsDemoUser. Intended for resume/portfolio
 * walkthroughs of the app.
 */
export function DemoAnnotation({ title, children, tag = "About" }: DemoAnnotationProps) {
  const isDemo = useIsDemoUser();
  if (!isDemo) return null;

  return (
    <div
      className="
        relative mb-3 rounded-lg
        border-2 border-dashed border-amber-400 dark:border-amber-500
        bg-amber-50/70 dark:bg-amber-950/20
        p-4
      "
      role="note"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-400 dark:bg-amber-500 text-amber-950 text-[10px] font-bold uppercase tracking-wider shrink-0">
          <Info className="w-3 h-3" />
          {tag}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {title}
          </h3>
          <div className="text-xs text-amber-900/90 dark:text-amber-100/85 leading-relaxed space-y-1.5 [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:text-amber-950 dark:[&_strong]:text-amber-50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
