"use client";

import React from "react";
import { Keyboard, X } from "lucide-react";

interface AdminShortcutsModalProps {
  isBn: boolean;
  onClose: () => void;
}

export default function AdminShortcutsModal({
  isBn,
  onClose,
}: AdminShortcutsModalProps) {
  const shortcuts = [
    {
      key: "P",
      labelEn: "Purge Top Incident",
      labelBn: "শীর্ষ বিপদ রিপোর্ট মুছুন",
      descEn: "Opens purge dialog for the first active incident in the queue",
      descBn: "তালিকার প্রথম সক্রিয় রিপোর্ট সরাসরি মুছে ফেলার ডায়ালগ খোলে",
    },
    {
      key: "B",
      labelEn: "Focus User Defense",
      labelBn: "ইউজার ব্যান বা স্থগিত",
      descEn: "Switches to user defense tab and focuses the UUID input",
      descBn: "ইউজার প্রতিরোধ ট্যাবে গিয়ে ইউজার আইডি বক্সে ফোকাস করে",
    },
    {
      key: "Esc",
      labelEn: "Close Dialogs",
      labelBn: "ডায়ালগ বন্ধ করুন",
      descEn: "Dismisses any open modal dialog or popup",
      descBn: "যেকোনো খোলা পপআপ বা ডায়ালগ তাৎক্ষণিক বন্ধ করে",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4 text-slate-700" />
            </div>
            <span>{isBn ? "কিবোর্ড শর্টকাট গাইড" : "Admin Keyboard Shortcuts"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-2.5 text-xs">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  {isBn ? s.labelBn : s.labelEn}
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {isBn ? s.descBn : s.descEn}
                </div>
              </div>
              <kbd className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono font-bold text-xs shadow-2xs shrink-0">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
          >
            {isBn ? "বুঝেছি" : "Got it"}
          </button>
        </div>

      </div>
    </div>
  );
}
