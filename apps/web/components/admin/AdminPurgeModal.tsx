"use client";

import React, { useState } from "react";
import { AdminReport } from "./types";
import { Trash2, X, RefreshCw, AlertTriangle } from "lucide-react";
import { showToast } from "@/store/useToastStore";

interface AdminPurgeModalProps {
  report: AdminReport;
  isBn: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function AdminPurgeModal({
  report,
  isBn,
  onClose,
  onConfirm,
}: AdminPurgeModalProps) {
  const [reason, setReason] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  const handleExecute = async () => {
    if (reason.trim().length < 3) {
      showToast(
        isBn
          ? "অপসারণের কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Purge reason must be at least 3 characters.",
        "warning"
      );
      return;
    }

    setIsPurging(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-red-600 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <span>{isBn ? "রিপোর্ট বাতিল ও অপসারণ" : "Purge Hazard Incident"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 leading-relaxed">
            {isBn
              ? "এই রিপোর্টটি মানচিত্র এবং পাবলিক ফিড থেকে স্থায়ীভাবে অপসারণ করা হবে। অডিট লগে সংরক্ষণের জন্য কারণ উল্লেখ করুন:"
              : "This report will be permanently removed from live map & public feeds. Specify a mandatory audit reason:"}
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ID:</span>
              <span className="font-bold">{report.id}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Category:</span>
              <span className="font-bold text-slate-900">{report.category}</span>
            </div>
            {report.severity && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Severity:</span>
                <span className="font-bold text-red-600">{report.severity}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="purge-reason-input" className="block text-xs font-semibold text-slate-700">
              {isBn ? "অপসারণের সুনির্দিষ্ট কারণ *" : "Mandatory Reason *"}
            </label>
            <textarea
              id="purge-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isBn ? "যেমন: সরজমিনে পরিদর্শনে কোনো হুমকি পাওয়া যায়নি" : "e.g., False alarm confirmed by local field patrol"}
              rows={3}
              disabled={isPurging}
              className="w-full p-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all resize-none shadow-2xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPurging}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isPurging}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPurging ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isBn ? "মুছে ফেলা হচ্ছে..." : "Purging..."}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBn ? "স্থায়ীভাবে অপসারণ" : "Confirm Purge"}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
