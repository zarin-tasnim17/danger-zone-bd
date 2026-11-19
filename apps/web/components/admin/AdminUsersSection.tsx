"use client";

import React, { useState } from "react";
import { AdminLog, UUID_PATTERN } from "./types";
import {
  UserX,
  UserCheck,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { showToast } from "@/store/useToastStore";

interface AdminUsersSectionProps {
  logs: AdminLog[];
  isBn: boolean;
  onBanUser: (userId: string, reason: string, action: "ban" | "unban") => Promise<void>;
}

export default function AdminUsersSection({
  logs,
  isBn,
  onBanUser,
}: AdminUsersSectionProps) {
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter recent user-related actions from audit logs
  const userActions = logs.filter(
    (l) => l.action?.includes("USER") || l.targetUserId
  ).slice(0, 8);

  const handleSubmit = async (action: "ban" | "unban") => {
    const trimmedId = targetUserId.trim();
    if (!UUID_PATTERN.test(trimmedId)) {
      showToast(
        isBn
          ? "অনুগ্রহ করে একটি সঠিক ইউজার UUID প্রদান করুন।"
          : "Please enter a valid 36-character user UUID.",
        "warning"
      );
      return;
    }

    if (reason.trim().length < 3) {
      showToast(
        isBn
          ? "কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।"
          : "Reason must be at least 3 characters long.",
        "warning"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onBanUser(trimmedId, reason.trim(), action);
      setTargetUserId("");
      setReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left (7 cols): User Enforcement Form */}
      <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-center text-red-600 shrink-0">
            <UserX className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {isBn ? "ইউজার সাসপেনশন ও অ্যাকাউন্ট নিয়ন্ত্রণ" : "User Suspension & Protection"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isBn
                ? "অপব্যবহারকারী ইউজারকে স্থগিত বা পুনরুদ্ধার করুন"
                : "Manage citizen suspension status and enforcement"}
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* Target User UUID */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-ban-user-id"
                className="block text-xs font-semibold text-slate-700"
              >
                {isBn ? "টার্গেট ইউজার UUID *" : "Target User UUID *"}
              </label>
              {targetUserId && (
                <span className={`text-[10px] font-mono font-semibold ${
                  UUID_PATTERN.test(targetUserId.trim()) ? "text-emerald-600" : "text-amber-600"
                }`}>
                  {UUID_PATTERN.test(targetUserId.trim()) ? "Valid UUID" : "Invalid format"}
                </span>
              )}
            </div>
            <input
              id="admin-ban-user-id"
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="e.g. 1960138d-8dd4-4a06-b403-19a76966fc64"
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs disabled:opacity-60"
            />
          </div>

          {/* Reason / Case Reference */}
          <div className="space-y-1.5">
            <label
              htmlFor="target-user-reason"
              className="block text-xs font-semibold text-slate-700"
            >
              {isBn ? "পদক্ষেপের কারণ *" : "Action Reason *"}
            </label>
            <textarea
              id="target-user-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isBn
                  ? "যেমন: বারবার মিথ্যা ছিনতাইয়ের রিপোর্ট দাখিল ও রেটিং ম্যানিপুলেশন"
                  : "e.g., Repeated false incident submissions or vote manipulation"
              }
              rows={3}
              disabled={isSubmitting}
              className="w-full p-3 text-xs bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs resize-none disabled:opacity-60"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handleSubmit("ban")}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>{isBn ? "ইউজার স্থগিত / ব্যান করুন" : "Suspend / Ban User"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit("unban")}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-slate-600" />
              <span>{isBn ? "অ্যাকাউন্ট পুনরুদ্ধার করুন" : "Restore / Unban User"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right (5 cols): Contextual Recent Enforcement Logs */}
      <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Clock className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {isBn ? "সাম্প্রতিক ইউজার অ্যাকশন লগ" : "Recent User Moderation History"}
            </h3>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {userActions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                {isBn ? "কোনো ইউজার অ্যাকশন রেকর্ড নেই।" : "No recent user moderation actions."}
              </p>
            ) : (
              userActions.map((log) => (
                <div key={log.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.action?.includes("BAN")
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {log.action}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 truncate font-medium">
                    {log.reason}
                  </p>

                  {log.targetUserId && (
                    <div className="font-mono text-[10px] text-slate-400 truncate">
                      User: {log.targetUserId}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{isBn ? "সমস্ত অ্যাকশন অডিট ট্রেইলে সংরক্ষিত হয়" : "All user moderations are cryptographically audited"}</span>
        </div>
      </div>

    </div>
  );
}
