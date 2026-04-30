import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visual signature for AI-generated content. Wraps any block in a thin
 * gradient border + faint background tint so AI output reads as distinct
 * from user-authored content at a glance.
 *
 * When `loading` is true a streaming shimmer bar slides across the top
 * edge — used for "Goodie is thinking" / streaming states. The drifting
 * gradient on the surface itself makes the panel feel alive without
 * being distracting.
 *
 * Tones:
 *   - "amber" (default) — Goodie's signature warm tone, used for briefs
 *     and meeting summaries.
 *   - "subtle" — same idea but lower saturation, for inline accents
 *     where the standard amber would be too loud.
 */
interface Props {
  loading?: boolean;
  tone?: "amber" | "subtle";
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

export function AiSurface({
  loading = false,
  tone = "amber",
  className,
  innerClassName,
  children,
}: Props) {
  const borderGradient =
    tone === "subtle"
      ? "from-amber-300/55 via-amber-200/45 to-blue-300/45"
      : "from-amber-400/75 via-amber-300/65 to-blue-400/65";
  const innerTint =
    tone === "subtle"
      ? "from-amber-100/40 via-transparent to-blue-100/30 dark:from-amber-950/25 dark:via-transparent dark:to-blue-950/25"
      : "from-amber-100/70 via-transparent to-blue-100/55 dark:from-amber-950/30 dark:via-transparent dark:to-blue-950/30";

  return (
    <div
      className={cn(
        "relative rounded-lg p-px overflow-hidden",
        "bg-gradient-to-br",
        borderGradient,
        // The drift uses a longer gradient so the visible portion shifts
        // smoothly. bg-[length:200%_200%] paired with the ai-drift keyframe
        // gives the surface that subtle "alive" feel.
        "bg-[length:200%_200%] animate-ai-drift",
        className,
      )}
    >
      <div
        className={cn(
          "relative rounded-[7px] bg-card overflow-hidden",
          "bg-gradient-to-br",
          innerTint,
          innerClassName,
        )}
      >
        {loading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <div className="h-px w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent animate-ai-shimmer" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * Inline marker — small "Goodie · AI" pill with a sparkle. Pair with
 * AiSurface for headers, or use standalone to flag short AI snippets.
 */
export function AiBadge({
  label = "Goodie",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        "bg-amber-100/70 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        "ring-1 ring-amber-200/60 dark:ring-amber-800/40",
        className,
      )}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}
