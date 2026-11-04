"use client";

import dynamic from "next/dynamic";

const DynamicIncidentMiniMap = dynamic(
  () => import("./IncidentMiniMap"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 sm:h-72 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/80 flex flex-col items-center justify-center gap-2 text-slate-400">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-xs font-semibold">Loading tactical map...</span>
      </div>
    ),
  }
);

export default DynamicIncidentMiniMap;
