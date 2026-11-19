"use client";

import React, { useState } from "react";
import { UserX, UserCheck, ShieldAlert, X } from "lucide-react";
import { AdminUser } from "./types";

interface AdminBanModalProps {
  user: AdminUser | { id: string; email?: string | null; anonymousId?: string; role?: string; trustScore?: number; isBanned?: boolean };
  action: "ban" | "unban";
  isBn: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export default function AdminBanModal({
  user,
  action,
  isBn,
  onClose,
  onConfirm,
}: AdminBanModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presets =
    action === "ban"
      ? [
          {
            en: "False Emergency Report",
            bn: "মিথ্যা বা বিভ্রান্তিকর জরুরি রিপোর্ট",
          },
          {
            en: "Malicious Spam / Bots",
            bn: "ক্ষতিকর স্প্যাম ও স্বয়ংক্রিয় বট আক্রমণ",
          },
          {
            en: "Hate Speech / Abuse",
            bn: "বিদ্বেষমূলক বক্তব্য ও অপমানজনক আচরণ",
          },
          {
            en: "Misleading Hazard Coordinates",
            bn: "উদ্দেশ্যপ্রণোদিত বিভ্রান্তিকর অবস্থান ইনপুট",
          },
        ]
      : [
          {
            en: "Identity Verified via Phone / KYC",
            bn: "মোবাইল / কেওয়াইসি যাচাইকরণের পর পুনরুদ্ধার",
          },
          {
            en: "Sanction Period Expired",
            bn: "সাসপেনশন বা শাস্তির মেয়াদ উত্তীর্ণ",
          },
          {
            en: "Appeal Approved by Administration",
            bn: "প্রশাসনিক আবেদন অনুমোদিত",
          },
        ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 3) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = user.email || user.anonymousId || user.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className={`p-5 flex items-center justify-between border-b ${
          action === "ban" ? "bg-red-50/50 border-red-100" : "bg-emerald-50/50 border-emerald-100"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
              action === "ban"
                ? "bg-red-100 text-red-600 border-red-200"
                : "bg-emerald-100 text-emerald-600 border-emerald-200"
            }`}>
              {action === "ban" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {action === "ban"
                  ? isBn ? "নাগরিক সাসপেনশন নিশ্চিতকরণ" : "Confirm Citizen Suspension"
                  : isBn ? "নাগরিক অ্যাকাউন্ট পুনরুদ্ধার" : "Confirm Account Restoration"}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {action === "ban"
                  ? isBn ? "প্ল্যাটফর্মে সাময়িক বা স্থায়ী প্রবেশাধিকার স্থগিত করুন" : "Revoke active session and prevent reporting/voting"
                  : isBn ? "নাগরিকের স্থগিতাদেশ তুলে নিয়ে স্বাভাবিক করুন" : "Restore active status and allow reporting/voting"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Identity Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">{isBn ? "টার্গেট নাগরিক:" : "Target Citizen:"}</span>
              <span className="font-bold text-slate-900 font-mono text-[11px] truncate max-w-[220px]" title={displayName}>
                {displayName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">{isBn ? "বর্তমান ট্রাস্ট স্কোর:" : "Trust Score:"}</span>
              <span className="font-bold text-purple-700 font-mono">
                {user.trustScore ?? 50} / 100
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate">
              ID: {user.id}
            </div>
          </div>

          {/* Quick Preset Reason Chips */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {isBn ? "প্রিসেট কারণ নির্বাচন করুন:" : "Quick Reason Presets:"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReason(isBn ? preset.bn : preset.en)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 font-medium transition-colors text-left"
                >
                  {isBn ? preset.bn : preset.en}
                </button>
              ))}
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {isBn ? "অ্যাকশনের বিস্তারিত কারণ *" : "Official Moderation Reason *"}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                action === "ban"
                  ? isBn ? "যেমন: বারবার মিথ্যা ছিনতাইয়ের রিপোর্ট দাখিল ও রেটিং ম্যানিপুলেশন" : "e.g., Repeated false incident reports and suspicious spamming"
                  : isBn ? "যেমন: আবেদন পর্যালোচনা করে অ্যাকাউন্ট স্বাভাবিক করা হলো" : "e.g., Appeal reviewed and account restored to good standing"
              }
              rows={3}
              required
              className="w-full p-3 text-xs bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all resize-none shadow-2xs"
            />
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{isBn ? "এই পদক্ষেপ প্রশাসনিক অডিট ট্রেইলে স্থায়ীভাবে লিপিবদ্ধ হবে।" : "This action will be permanently recorded in the immutable audit log."}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {isBn ? "বাতিল" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                action === "ban"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {action === "ban" ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              <span>
                {isSubmitting
                  ? isBn ? "প্রক্রিয়াধীন..." : "Processing..."
                  : action === "ban"
                  ? isBn ? "সাসপেন্ড নিশ্চিত করুন" : "Confirm Suspension"
                  : isBn ? "পুনরুদ্ধার নিশ্চিত করুন" : "Confirm Restoration"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
