"use client";

import React, { useState, useMemo } from "react";
import { AdminVerification } from "./types";
import {
  UserCheck,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Phone,
  FileBadge,
  Search,
  X,
} from "lucide-react";

interface AdminVerificationsSectionProps {
  verifications: AdminVerification[];
  isBn: boolean;
  onApprove: (verifId: string) => void;
  onSelectReject: (verification: AdminVerification) => void;
}

export default function AdminVerificationsSection({
  verifications,
  isBn,
  onApprove,
  onSelectReject,
}: AdminVerificationsSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredVerifications = useMemo(() => {
    return verifications.filter((v) => {
      const matchesType =
        typeFilter === "ALL" ||
        v.type?.toUpperCase().includes(typeFilter) ||
        (typeFilter === "PHONE" && v.type?.includes("PHONE"));

      if (!matchesType) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const userMatch = v.userId?.toLowerCase().includes(q);
      const phoneMatch = (v.phoneNumber || v.user?.phoneNumber || "")
        .toLowerCase()
        .includes(q);
      const typeMatch = v.type?.toLowerCase().includes(q);

      return userMatch || phoneMatch || typeMatch;
    });
  }, [verifications, searchQuery, typeFilter]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
      
      {/* Section Header & Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {isBn ? "নাগরিক কেওয়াইসি যাচাই কিউ" : "Citizen Verification Queue"}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {isBn
                ? `${verifications.length} টি অনুরোধের মধ্যে ${filteredVerifications.length} টি অপেক্ষমান`
                : `${filteredVerifications.length} of ${verifications.length} pending KYC requests`}
            </p>
          </div>
        </div>

        {/* Search & Type Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <div className="relative min-w-[200px] sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isBn ? "ইউজার আইডি বা ফোন খুঁজুন..." : "Search user or phone..."}
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

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200/80 rounded-xl text-[11px] font-semibold shrink-0">
            {[
              { id: "ALL", labelEn: "All", labelBn: "সব" },
              { id: "NID", labelEn: "NID", labelBn: "এনআইডি" },
              { id: "PHONE", labelEn: "Phone", labelBn: "ফোন" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                  typeFilter === t.id
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {isBn ? t.labelBn : t.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200/80">
            <tr>
              <th className="p-3.5">{isBn ? "ইউজার আইডি" : "Citizen UUID"}</th>
              <th className="p-3.5">{isBn ? "ধরন" : "Method"}</th>
              <th className="p-3.5">{isBn ? "নথি / যোগাযোগ" : "Document / Contact"}</th>
              <th className="p-3.5">{isBn ? "জমা দেওয়ার সময়" : "Submitted"}</th>
              <th className="p-3.5 text-right">{isBn ? "সিদ্ধান্ত" : "Actions"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredVerifications.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <UserCheck className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                    <p className="text-xs font-medium">
                      {isBn ? "কোনো অপেক্ষমান কেওয়াইসি অনুরোধ নেই।" : "No pending verification requests."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredVerifications.map((v, idx) => (
                <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono text-slate-900 font-medium">
                    <div className="flex items-center gap-1.5">
                      {idx === 0 && !searchQuery && typeFilter === "ALL" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold">
                          [A/R] TOP
                        </span>
                      )}
                      <span>{v.userId.slice(0, 10)}...</span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {v.type?.includes("PHONE") ? (
                        <Phone className="w-3 h-3 text-slate-500" />
                      ) : (
                        <FileBadge className="w-3 h-3 text-slate-500" />
                      )}
                      <span>{v.type || "NID / Phone"}</span>
                    </span>
                  </td>

                  <td className="p-3.5 font-mono text-slate-700">
                    {v.type === "PHONE_OTP" || !v.documentUrl ? (
                      <span className="font-semibold text-slate-800">
                        {v.phoneNumber || v.user?.phoneNumber || "—"}
                      </span>
                    ) : (
                      <a
                        href={v.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 font-sans text-xs font-medium"
                      >
                        <span>{isBn ? "নথি দেখুন" : "View Document"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>

                  <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>

                  <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onApprove(v.id)}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isBn ? "অনুমোদন" : "Approve"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectReject(v)}
                      className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isBn ? "প্রত্যাখ্যান" : "Reject"}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-slate-100">
        {filteredVerifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <UserCheck className="w-8 h-8 text-slate-300 stroke-[1.5] mx-auto mb-2" />
            <p className="text-xs font-medium">
              {isBn ? "কোনো অপেক্ষমান কেওয়াইসি অনুরোধ নেই।" : "No pending verification requests."}
            </p>
          </div>
        ) : (
          filteredVerifications.map((v, idx) => (
            <div key={v.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {idx === 0 && !searchQuery && typeFilter === "ALL" && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold shrink-0">
                      [A/R]
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-slate-900 truncate">
                    {v.userId.slice(0, 12)}...
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {v.type || "NID"}
                </span>
              </div>

              <div className="text-xs">
                {v.type === "PHONE_OTP" || !v.documentUrl ? (
                  <div className="text-slate-700 font-mono">
                    <span className="text-slate-400 mr-1.5">Phone:</span>
                    {v.phoneNumber || v.user?.phoneNumber || "—"}
                  </div>
                ) : (
                  <a
                    href={v.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>{isBn ? "সংযুক্ত নথি দেখুন" : "View Attached Document"}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-[11px] font-mono text-slate-400">
                  {new Date(v.createdAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onApprove(v.id)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "অনুমোদন" : "Approve"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectReject(v)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isBn ? "প্রত্যাখ্যান" : "Reject"}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
