"use client";

import dynamic from "next/dynamic";
import { ShieldAlert, Loader2 } from "lucide-react";

const DynamicMap = dynamic(() => import("./MapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 w-full h-full bg-slate-100 flex flex-col items-center justify-center gap-3 select-none">
      <div className="relative flex items-center justify-center">
        <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-red-400 opacity-60" />
        <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
          <ShieldAlert className="w-6 h-6 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/90 shadow-sm">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
        <span>Initializing Tactical Safety Map...</span>
      </div>
    </div>
  ),
});

export default DynamicMap;
