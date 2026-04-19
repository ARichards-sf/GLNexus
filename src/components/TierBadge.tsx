import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TierBadgeProps {
  tier: string | null | undefined
  size?: "sm" | "md" | "lg"
  showUnassigned?: boolean
  pending?: boolean
  // shows a subtle indicator 
  // when a review is pending
}

const TIER_CONFIG = {
  platinum: {
    label: "Platinum",
    icon: "🏆",
    className: `bg-slate-100 
      text-slate-700 
      border border-slate-300 
      dark:bg-slate-800/60 
      dark:text-slate-300 
      dark:border-slate-600 
      font-semibold`
  },
  gold: {
    label: "Gold",
    icon: "⭐",
    className: `bg-amber-100 
      text-amber-700 
      border border-amber-300 
      dark:bg-amber-900/40 
      dark:text-amber-400 
      dark:border-amber-700
      font-semibold`
  },
  silver: {
    label: "Silver",
    icon: "◆",
    className: `bg-blue-50 
      text-blue-600 
      border border-blue-200 
      dark:bg-blue-900/30 
      dark:text-blue-400 
      dark:border-blue-700
      font-semibold`
  },
}

export default function TierBadge({
  tier,
  size = "md",
  showUnassigned = false,
  pending = false
}: TierBadgeProps) {
  const key = tier?.toLowerCase() as
    keyof typeof TIER_CONFIG | undefined
  const config = key 
    ? TIER_CONFIG[key] 
    : null

  const sizeClass = {
    sm: "text-[10px] px-1.5 py-0",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-2.5 py-1",
  }[size]

  if (!config && !showUnassigned) 
    return null

  if (!config) {
    return (
      <Badge
        variant="outline"
        className={cn(
          sizeClass,
          "text-muted-foreground"
        )}
      >
        {pending ? "⟳ Review Pending" 
          : "Unassigned"}
      </Badge>
    )
  }

  return (
    <Badge
      className={cn(
        config.className,
        sizeClass,
        pending && "ring-2 ring-offset-1 ring-amber-400"
      )}
    >
      {config.icon} {config.label}
      {pending && (
        <span className="ml-1 
          text-amber-500">↑</span>
      )}
    </Badge>
  )
}