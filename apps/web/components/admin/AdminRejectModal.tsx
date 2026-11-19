"use client";

import React, { useState } from "react";
import { AdminVerification } from "./types";
import { UserX, X, RefreshCw } from "lucide-react";
import { showToast } from "@/store/useToastStore";

interface AdminRejectModalProps {
  verification: AdminVerification;
  isBn: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function AdminRejectModal({
  verification,
  isBn,
  onClose,
  onConfirm,
}: AdminRejectModalProps) {
  const [reason, setReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  const handleExecute = async () => {
    if (reason.trim().length < 3) {
      showToast(
        isBn
          ? "প্রত্যাখ্যানের কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Rejection reason must be at least 3 characters.",
        "warning"
      );
      return;
    }

    setIsRejecting(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-red-600 font-bold text-sm">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <span>{isBn ? "কেওয়াইসি অনুরোধ প্রত্যাখ্যান" : "Reject KYC Verification"}</span>
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
              ? "নাগরিকের ভেরিফিকেশন নথি প্রত্যাখ্যান করা হচ্ছে। প্রত্যাখ্যানের কারণ অডিট লগে লিপিবদ্ধ থাকবে:"
              : "Specify why this citizen verification request is being rejected (audited):"}
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Citizen:</span>
              <span className="font-bold">{verification.userId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Type:</span>
              <span className="font-bold text-slate-900">{verification.type}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reject-reason-input" className="block text-xs font-semibold text-slate-700">
              {isBn ? "প্রত্যাখ্যানের কারণ *" : "Rejection Reason *"}
            </label>
            <textarea
              id="reject-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isBn ? "যেমন: জাতীয় পরিচয়পত্রের কপি অস্পষ্ট বা মেয়াদোত্তীর্ণ" : "e.g., Document illegible or damaged"}
              rows={3}
              disabled={isRejecting}
              className="w-full p-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all resize-none shadow-2xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isRejecting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {isBn ? "বাতিল" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isRejecting}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isRejecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isBn ? "প্রত্যাখ্যান হচ্ছে..." : "Rejecting..."}</span>
              </>
            ) : (
              <>
                <UserX className="w-3.5 h-3.5" />
                <span>{isBn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm Rejection"}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
