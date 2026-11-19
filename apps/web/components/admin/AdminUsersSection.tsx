"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { AdminLog, AdminUser, UUID_PATTERN } from "./types";
import { apiFetch } from "@/lib/api";
import { showToast } from "@/store/useToastStore";
import {
  UserX,
  UserCheck,
  ShieldAlert,
  Clock,
  Search,
  X,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Shield,
  Smartphone,
  Phone,
  Mail,
  Users,
} from "lucide-react";

interface AdminUsersSectionProps {
  logs: AdminLog[];
  isBn: boolean;
  onSelectBanUser?: (
    user: AdminUser | { id: string; email?: string | null; anonymousId?: string; role?: string; trustScore?: number; isBanned?: boolean },
    action: "ban" | "unban"
  ) => void;
  onDirectBanIdentifier?: (
    identifier: string,
    reason: string,
    action: "ban" | "unban"
  ) => Promise<void>;
}

export default function AdminUsersSection({
  logs,
  isBn,
  onSelectBanUser,
  onDirectBanIdentifier,
}: AdminUsersSectionProps) {
  // Directory Remote State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(15);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "trustScore">("createdAt");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Quick Action Form State
  const [manualIdentifier, setManualIdentifier] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Fetch Users from API
  const fetchUsers = useCallback(
    async (
      search = searchQuery,
      role = roleFilter,
      status = statusFilter,
      page = usersPage,
      sort = sortBy
    ) => {
      setIsLoadingUsers(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (role !== "ALL") params.set("role", role);
        if (status === "BANNED") params.set("isBanned", "true");
        if (status === "ACTIVE") params.set("isBanned", "false");
        if (status === "VERIFIED") params.set("isVerified", "true");
        params.set("page", String(page));
        params.set("limit", String(usersLimit));
        params.set("sortBy", sort);
        params.set("sortOrder", "desc");

        const data = await apiFetch<{ users: AdminUser[]; pagination: { total: number } }>(
          `/admin/users?${params.toString()}`
        );
        setUsers(data?.users || []);
        setUsersTotal(data?.pagination?.total || 0);
      } catch (err: any) {
        console.warn("[Admin Users Fetch] Error:", err.message);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    [searchQuery, roleFilter, statusFilter, usersPage, usersLimit, sortBy]
  );

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery, roleFilter, statusFilter, 1, sortBy);
      setUsersPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, roleFilter, statusFilter, sortBy, fetchUsers]);

  // Copy UUID to clipboard
  const handleCopyUUID = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedId(uuid);
    showToast(isBn ? "ইউজার UUID কপি করা হয়েছে!" : "User UUID copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Submit manual action
  const handleManualSubmit = async (action: "ban" | "unban") => {
    const trimmedId = manualIdentifier.trim();
    if (!trimmedId) {
      showToast(
        isBn
          ? "অনুগ্রহ করে ইউজারের UUID, ইমেইল, মোবাইল বা ডিভাইস আইডি দিন।"
          : "Please enter a user UUID, email, phone, or device ID.",
        "warning"
      );
      return;
    }
    if (manualReason.trim().length < 3) {
      showToast(
        isBn ? "কারণ কমপক্ষে ৩ অক্ষরের হতে হবে।" : "Reason must be at least 3 characters.",
        "warning"
      );
      return;
    }

    setIsSubmittingManual(true);
    try {
      if (onDirectBanIdentifier) {
        await onDirectBanIdentifier(trimmedId, manualReason.trim(), action);
      } else {
        await apiFetch(`/admin/users/${encodeURIComponent(trimmedId)}/${action}`, {
          method: "POST",
          body: JSON.stringify({ reason: manualReason.trim() }),
        });
        showToast(
          action === "ban"
            ? isBn ? "ইউজার সফলভাবে স্থগিত করা হয়েছে।" : "User suspended successfully."
            : isBn ? "ইউজার অ্যাকাউন্ট সফলভাবে পুনরুদ্ধার করা হয়েছে।" : "User restored successfully.",
          "success"
        );
      }
      setManualIdentifier("");
      setManualReason("");
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || `Failed to ${action} user.`, "error");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // Recent moderation actions from logs
  const userActions = logs.filter(
    (l) => l.action?.includes("USER") || l.targetUserId
  ).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* 1. CITIZEN DIRECTORY TABLE & SEARCH CONSOLE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-600 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {isBn ? "নাগরিক ডিরেক্টরি ও সার্চ প্ল্যাটফর্ম" : "Citizen Directory & Moderation"}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isBn
                  ? `মোট ${usersTotal} জন নাগরিকের মধ্যে ${users.length} জন প্রদর্শিত হচ্ছে`
                  : `Managing ${usersTotal} citizens registered via email, phone, or verified devices`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchUsers()}
              disabled={isLoadingUsers}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              {isLoadingUsers ? (isBn ? "রিফ্রেশ হচ্ছে..." : "Refreshing...") : (isBn ? "রিফ্রেশ" : "Refresh")}
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Search Bar + Filter Pills + Role Selector */}
        <div className="flex flex-col md:flex-row gap-3 pt-1">
          {/* Omni Search Bar */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isBn
                  ? "ইমেইল, মোবাইল (+880...), ডিভাইস আইডি বা ইউজার UUID খুঁজুন..."
                  : "Search by email, phone (+880...), device ID, or user UUID..."
              }
              className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 transition-all shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "ALL", label: isBn ? "সব নাগরিক" : "All" },
              { id: "ACTIVE", label: isBn ? "সক্রিয়" : "Active" },
              { id: "BANNED", label: isBn ? "স্থগিত" : "Suspended" },
              { id: "VERIFIED", label: isBn ? "যাচাইকৃত" : "Verified" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-purple-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Role Filter Selector */}
          <div className="shrink-0">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
            >
              <option value="ALL">{isBn ? "সকল ভূমিকা" : "All Roles"}</option>
              <option value="USER">{isBn ? "নাগরিক (USER)" : "Citizens (USER)"}</option>
              <option value="VERIFIED_RESPONDER">{isBn ? "রেসপন্ডার (RESPONDER)" : "Responders"}</option>
              <option value="ADMIN">{isBn ? "প্রশাসক (ADMIN)" : "Admins"}</option>
            </select>
          </div>
        </div>

        {/* Dense Citizen Data Table */}
        <div className="border border-slate-200/90 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-3">{isBn ? "নাগরিক পরিচয়" : "Citizen Identity"}</th>
                <th className="p-3">{isBn ? "যোগাযোগ ও ডিভাইস" : "Contact & Device"}</th>
                <th className="p-3">{isBn ? "ভূমিকা" : "Role"}</th>
                <th className="p-3">{isBn ? "ট্রাস্ট স্কোর" : "Trust Meter"}</th>
                <th className="p-3">{isBn ? "কার্যক্রম" : "Activity"}</th>
                <th className="p-3">{isBn ? "অবস্থা" : "Status"}</th>
                <th className="p-3 text-right">{isBn ? "অ্যাকশন" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                      <span>{isBn ? "নাগরিক তথ্য লোড হচ্ছে..." : "Loading citizens directory..."}</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <ShieldAlert className="w-8 h-8 text-slate-300 stroke-[1.5] mx-auto mb-2" />
                    <span>{isBn ? "কোনো নাগরিক পাওয়া যায়নি।" : "No citizens found matching criteria."}</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSuspended = u.isBanned;
                  const displayHandle = u.email || u.anonymousId || u.id;
                  const isVerifiedCitizen = u.isVerified;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Identity */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSuspended
                              ? "bg-red-100 text-red-700 border border-red-200"
                              : u.role === "ADMIN"
                              ? "bg-purple-100 text-purple-700 border border-purple-200"
                              : u.role === "VERIFIED_RESPONDER"
                              ? "bg-sky-100 text-sky-700 border border-sky-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {displayHandle.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 truncate max-w-[180px]" title={displayHandle}>
                              {displayHandle}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Device */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {u.phoneNumber ? (
                            <span className="text-[11px] font-mono text-slate-700 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {u.phoneNumber}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">
                              {isBn ? "ফোন নেই" : "No phone"}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]" title={u.anonymousId}>
                            Dev: {u.anonymousId?.slice(0, 10)}...
                          </span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                          u.role === "ADMIN"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : u.role === "VERIFIED_RESPONDER"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {u.role === "VERIFIED_RESPONDER" ? "RESPONDER" : u.role}
                        </span>
                      </td>

                      {/* Trust Meter */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="w-24 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-slate-500 font-bold">{u.trustScore ?? 50}</span>
                            <span className="text-slate-400">/ 100</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                (u.trustScore ?? 50) >= 70
                                  ? "bg-emerald-500"
                                  : (u.trustScore ?? 50) >= 40
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, u.trustScore ?? 50))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Activity */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="text-[11px] text-slate-600 font-mono space-y-0.5">
                          <div>
                            <span className="font-bold text-slate-800">{u._count?.reports ?? 0}</span> {isBn ? "রিপোর্ট" : "reports"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            <span className="font-bold">{u._count?.votes ?? 0}</span> {isBn ? "ভোট" : "votes"}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isSuspended
                            ? "bg-red-50 text-red-700 border-red-200"
                            : isVerifiedCitizen
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {isSuspended
                            ? isBn ? "স্থগিত" : "SUSPENDED"
                            : isVerifiedCitizen
                            ? isBn ? "যাচাইকৃত" : "ACTIVE (KYC)"
                            : isBn ? "সক্রিয়" : "ACTIVE"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 whitespace-nowrap text-right space-x-1.5">
                        {/* Copy UUID button */}
                        <button
                          type="button"
                          onClick={() => handleCopyUUID(u.id)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                          title={isBn ? "UUID কপি করুন" : "Copy UUID"}
                        >
                          {copiedId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {/* Ban / Restore Button */}
                        {u.role !== "ADMIN" && onSelectBanUser && (
                          <button
                            type="button"
                            onClick={() => onSelectBanUser(u, isSuspended ? "unban" : "ban")}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                              isSuspended
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            {isSuspended ? (isBn ? "পুনরুদ্ধার" : "Restore") : (isBn ? "স্থগিত" : "Suspend")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {usersTotal > usersLimit && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              {isBn
                ? `পৃষ্ঠা ${usersPage} / ${Math.ceil(usersTotal / usersLimit) || 1}`
                : `Page ${usersPage} of ${Math.ceil(usersTotal / usersLimit) || 1}`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={usersPage <= 1}
                onClick={() => {
                  const p = usersPage - 1;
                  setUsersPage(p);
                  fetchUsers(searchQuery, roleFilter, statusFilter, p, sortBy);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>{isBn ? "পূর্ববর্তী" : "Prev"}</span>
              </button>
              <button
                type="button"
                disabled={usersPage >= Math.ceil(usersTotal / usersLimit)}
                onClick={() => {
                  const p = usersPage + 1;
                  setUsersPage(p);
                  fetchUsers(searchQuery, roleFilter, statusFilter, p, sortBy);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{isBn ? "পরবর্তী" : "Next"}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. DIRECT OVERRIDE FORM & RECENT AUDIT LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left (7 cols): Direct Identifier Moderation Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200/80 flex items-center justify-center text-red-600 shrink-0">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {isBn ? "সরাসরি আইডেন্টিফায়ার মডারেশন" : "Direct Multi-Identifier Enforcement"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {isBn
                  ? "ইমেইল, মোবাইল (+880), ডিভাইস আইডি বা UUID দিয়ে সরাসরি ইউজার ব্যবস্থা নিন"
                  : "Quickly ban or unban by email, phone (+880...), anonymous device ID, or UUID"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                {isBn ? "টার্গেট আইডেন্টিফায়ার *" : "Target Identifier (UUID / Email / Phone / Device ID) *"}
              </label>
              <input
                type="text"
                value={manualIdentifier}
                onChange={(e) => setManualIdentifier(e.target.value)}
                placeholder="e.g. user@dangerzone.bd, +8801700..., or UUID"
                disabled={isSubmittingManual}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                {isBn ? "পদক্ষেপের কারণ *" : "Official Reason *"}
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder={isBn ? "যেমন: বারবার মিথ্যা জরুরি রিপোর্ট দাখিল" : "e.g., Repeated false incident reports"}
                disabled={isSubmittingManual}
                className="w-full px-3.5 py-2 text-xs bg-slate-50/60 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs disabled:opacity-60"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleManualSubmit("ban")}
                disabled={isSubmittingManual}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>{isBn ? "স্থগিত / ব্যান করুন" : "Suspend / Ban"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleManualSubmit("unban")}
                disabled={isSubmittingManual}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-600" />
                <span>{isBn ? "পুনরুদ্ধার করুন" : "Restore / Unban"}</span>
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
                        Target: {log.targetUserId}
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
    </div>
  );
}
