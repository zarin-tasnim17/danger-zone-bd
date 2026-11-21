"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useLanguageStore();
  const isBn = language === "bn";
  const [isChunkError, setIsChunkError] = useState(false);

  useEffect(() => {
    const isChunk =
      error.name === "ChunkLoadError" ||
      /Loading chunk [\w-]+ failed/i.test(error.message || "") ||
      /Loading CSS chunk [\w-]+ failed/i.test(error.message || "");

    if (isChunk) {
      setIsChunkError(true);
      const key = "dz_error_chunk_reload";
      const last = Number(sessionStorage.getItem(key) || 0);
      const now = Date.now();
      if (now - last > 10000) {
        sessionStorage.setItem(key, String(now));
        const timer = setTimeout(() => {
          window.location.reload();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [error]);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    } else {
      reset();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 mx-auto flex items-center justify-center text-amber-600 shadow-xs">
          {isChunkError ? (
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">
            {isChunkError
              ? isBn
                ? "নতুন সংস্করণ উপলব্ধ — রিলোড হচ্ছে"
                : "New Version Available — Updating"
              : isBn
              ? "একটি সাময়িক সমস্যা হয়েছে"
              : "Something went wrong"}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {isChunkError
              ? isBn
                ? "অ্যাপ্লিকেশনটির একটি নতুন আপডেট প্রকাশিত হয়েছে। নতুন কোড ও মানচিত্র লোড করতে পেজটি স্বয়ংক্রিয়ভাবে রিফ্রেশ হচ্ছে..."
                : "A new version of the safety system has been deployed. The page is automatically reloading to fetch the latest assets..."
              : isBn
              ? "মানচিত্র বা ডেটা লোড করার সময় ব্রাউজারে একটি সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
              : "An unexpected client-side exception occurred while rendering this view. Try reloading to restore live safety monitoring."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleReload}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isBn ? "পেজ রিফ্রেশ করুন" : "Reload Page"}</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>{isBn ? "মূল পাতায় যান" : "Go to Home"}</span>
          </Link>
        </div>

        {error.digest && (
          <p className="text-[10px] font-mono text-slate-400">
            Reference ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
