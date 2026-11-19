import React from "react";
import { getLayananResi } from "../utils/resiRules";

interface ServiceBadgeProps {
  resi?: string;
  layanan?: string | null;
  dark?: boolean;
  className?: string;
}

export const ServiceBadge: React.FC<ServiceBadgeProps> = ({
  resi,
  layanan,
  dark = false,
  className = "",
}) => {
  const resolved = layanan !== undefined ? layanan : resi ? getLayananResi(resi) : null;
  if (!resolved) return null;

  let colorCls = dark
    ? "bg-slate-800 text-slate-200 border-slate-700"
    : "bg-slate-100 text-slate-700 border-slate-200";

  if (resolved === "Express Reguler") {
    colorCls = dark
      ? "bg-sky-950/80 text-sky-300 border-sky-700/60"
      : "bg-sky-50 text-sky-700 border-sky-200";
  } else if (resolved === "Express Ecommerce") {
    colorCls = dark
      ? "bg-rose-950/80 text-rose-300 border-rose-700/60"
      : "bg-rose-50 text-rose-700 border-rose-200";
  } else if (resolved === "Express VIP") {
    colorCls = dark
      ? "bg-amber-950/80 text-amber-300 border-amber-700/60"
      : "bg-amber-50 text-amber-800 border-amber-200";
  } else if (resolved === "J&T Cargo") {
    colorCls = dark
      ? "bg-indigo-950/80 text-indigo-300 border-indigo-700/60"
      : "bg-indigo-50 text-indigo-700 border-indigo-200";
  }

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border tracking-wide whitespace-nowrap ${colorCls} ${className}`}
    >
      {resolved}
    </span>
  );
};
