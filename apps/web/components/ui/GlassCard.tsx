import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`backdrop-blur-md bg-slate-900/85 border border-slate-700/60 rounded-xl shadow-2xl ${
        hover
          ? "hover:border-slate-500/80 hover:shadow-cyan-950/20 transition-all duration-200 cursor-pointer"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default GlassCard;
