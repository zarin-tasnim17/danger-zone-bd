import React from "react";

export type BadgeVariant =
  | "HIGH"
  | "CRITICAL"
  | "MEDIUM"
  | "LOW"
  | "SAFE"
  | "VERIFIED"
  | "ADMIN"
  | "CITIZEN"
  | "NEUTRAL";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function Badge({
  variant = "NEUTRAL",
  children,
  pulse = false,
  className = "",
  size = "sm",
}: BadgeProps) {
  const styles: Record<BadgeVariant, { bg: string; text: string; border: string; dot: string }> = {
    HIGH: {
      bg: "bg-red-500/15",
      text: "text-red-400",
      border: "border-red-500/40",
      dot: "bg-red-500",
    },
    CRITICAL: {
      bg: "bg-rose-600/20",
      text: "text-rose-300",
      border: "border-rose-500/50",
      dot: "bg-rose-500",
    },
    MEDIUM: {
      bg: "bg-amber-500/15",
      text: "text-amber-400",
      border: "border-amber-500/40",
      dot: "bg-amber-500",
    },
    LOW: {
      bg: "bg-yellow-500/15",
      text: "text-yellow-400",
      border: "border-yellow-500/40",
      dot: "bg-yellow-500",
    },
    SAFE: {
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
      border: "border-emerald-500/40",
      dot: "bg-emerald-500",
    },
    VERIFIED: {
      bg: "bg-blue-500/15",
      text: "text-blue-400",
      border: "border-blue-500/40",
      dot: "bg-blue-500",
    },
    ADMIN: {
      bg: "bg-purple-500/15",
      text: "text-purple-300",
      border: "border-purple-500/40",
      dot: "bg-purple-500",
    },
    CITIZEN: {
      bg: "bg-slate-700/30",
      text: "text-slate-300",
      border: "border-slate-600/50",
      dot: "bg-slate-400",
    },
    NEUTRAL: {
      bg: "bg-slate-800/50",
      text: "text-slate-300",
      border: "border-slate-700/60",
      dot: "bg-slate-400",
    },
  };

  const current = styles[variant] || styles.NEUTRAL;
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.dot}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${current.dot}`}
          />
        </span>
      )}
      {children}
    </span>
  );
}

export default Badge;
