"use client";

import React, { useState, useMemo } from "react";
import { AdminLog } from "./types";
import {
  FileText,
  Search,
  Clock,
  Filter,
  X,
  Shield,
  User,
} from "lucide-react";

interface AdminLogsSectionProps {
  logs: AdminLog[];
  isBn: boolean;
}

export default function AdminLogsSection({
  logs,
  isBn,
}: AdminLogsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("ALL");

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction =
        actionFilter === "ALL" || log.action === actionFilter;

      if (!matchesAction) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const actionMatch = log.action?.toLowerCase().includes(q);
      const reasonMatch = log.reason?.toLowerCase().includes(q);
      const adminMatch = log.adminId?.toLowerCase().includes(q);
      const reportMatch = log.targetReportId?.toLowerCase().includes(q);
      const userMatch = log.targetUserId?.toLowerCase().includes(q);

      return (
        actionMatch ||
        reasonMatch ||
        adminMatch ||
        reportMatch ||
        userMatch
      );
    });
  }, [logs, searchQuery, actionFilter]);

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("PURGE") || act.includes("BAN") || act.includes("DELETE") || act.includes("REJECT")) {
      return "bg-red-50 text-red-700 border-red-200";
    }
    if (act.includes("APPROVE") || act.includes("VERIF") || act.includes("UNBAN")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      
      {/* Header & Filter Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {isBn ? "অপরিবর্তনীয় অডিট ট্রেইল ও কমপ্লায়েন্স লগ" : "Compliance Audit Trail"}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {isBn
                ? `${logs.length} টি অডিট রেকর্ডের মধ্যে ${filteredLogs.length} টি প্রদর্শিত`
                : `Showing ${filteredLogs.length} of ${logs.length} cryptographically logged actions`}
            </p>
          </div>
        </div>

        {/* Search & Action Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative min-w-[200px] sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? "লগ খুঁজুন (অ্যাকশন, কারণ বা আইডি)..." : "Search audit logs..."}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 transition-all shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {actionTypes.length > 0 && (
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-red-600 shadow-2xs cursor-pointer"
            >
              <option value="ALL">{isBn ? "সব অ্যাকশন" : "All Actions"}</option>
              {actionTypes.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
            <tr>
              <th className="p-3.5">{isBn ? "সময়কাল" : "Timestamp"}</th>
              <th className="p-3.5">{isBn ? "অ্যাকশন" : "Action"}</th>
              <th className="p-3.5">{isBn ? "অ্যাডমিন আইডি" : "Admin ID"}</th>
              <th className="p-3.5">{isBn ? "টার্গেট রেফারেন্স" : "Target Reference"}</th>
              <th className="p-3.5">{isBn ? "কারণ / বিবরণ" : "Reason"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-medium">
                      {isBn ? "কোনো অডিট রেকর্ড পাওয়া যায়নি।" : "No audit records found matching criteria."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>

                  <td className="p-3.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>

                  <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                    {log.adminId.slice(0, 8)}...
                  </td>

                  <td className="p-3.5 font-mono text-slate-600 whitespace-nowrap">
                    {log.targetReportId ? (
                      <span className="text-slate-700">Report: {log.targetReportId.slice(0, 8)}...</span>
                    ) : log.targetUserId ? (
                      <span className="text-slate-700">User: {log.targetUserId.slice(0, 8)}...</span>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="p-3.5 font-medium text-slate-800 max-w-xs sm:max-w-md truncate" title={log.reason}>
                    {log.reason}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-8 h-8 text-slate-300 stroke-[1.5] mx-auto mb-2" />
            <p className="text-xs font-medium">
              {isBn ? "কোনো অডিট রেকর্ড পাওয়া যায়নি।" : "No audit records found."}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeClass(log.action)}`}>
                  {log.action}
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                {log.reason}
              </p>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                <span>Admin: {log.adminId.slice(0, 8)}...</span>
                <span>
                  {log.targetReportId
                    ? `Report: ${log.targetReportId.slice(0, 8)}...`
                    : log.targetUserId
                    ? `User: ${log.targetUserId.slice(0, 8)}...`
                    : "—"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
