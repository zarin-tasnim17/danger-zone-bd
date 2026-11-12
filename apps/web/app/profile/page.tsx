"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import {
  UserCheck,
  Shield,
  Award,
  Smartphone,
  FileCheck,
  RefreshCw,
  LogOut,
  User,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  PhoneCall,
  Copy,
  Check,
  Fingerprint,
  Activity,
  Bell,
  ThumbsUp,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldAlert,
  Info,
  Clock,
  BadgeCheck,
  FileText,
  Scale,
} from "lucide-react";

export default function ProfilePage() {
  const { user, deviceId, initAuth, logout, refreshProfile } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  // Verification Form State
  const [verifyType, setVerifyType] = useState<"PHONE_OTP" | "NID_DOCUMENT">("PHONE_OTP");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Copy Feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Identity Switcher (Developer Drawer)
  const [isSwitching, setIsSwitching] = useState(false);
  const [showDevSandbox, setShowDevSandbox] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVerify(true);
    setVerifySuccess(null);
    setVerifyError(null);

    try {
      const res = await apiFetch<any>("/users/verify", {
        method: "POST",
        body: JSON.stringify({
          type: verifyType,
          documentUrl: verifyType === "NID_DOCUMENT" ? documentUrl : undefined,
        }),
      });

      setVerifySuccess(
        isBn
          ? `ভেরিফিকেশন অনুরোধ (${res.type}) জমা হয়েছে! অবস্থা: ${res.status}। একজন অ্যাডমিনিস্ট্রেটর অ্যাডমিন প্যানেল থেকে এটি অনুমোদন করতে পারবেন।`
          : `Verification request (${res.type}) successfully submitted! Status: ${res.status}. An administrator can now review and approve this in the Admin Portal.`
      );
      await refreshProfile();
    } catch (err: any) {
      setVerifyError(err.message || (isBn ? "ভেরিফিকেশন সাবমিট করতে ব্যর্থ হয়েছে" : "Failed to submit verification request"));
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const handleSwitchIdentity = async (anonId: string) => {
    setIsSwitching(true);
    try {
      localStorage.setItem("bd_safety_device_id", anonId);
      await apiFetch("/auth/device", {
        method: "POST",
        body: JSON.stringify({ anonymousId: anonId }),
      });
      await initAuth();
      alert(
        isBn
          ? `সেশন সফলভাবে পরিবর্তন করা হয়েছে: ${email || anonId}`
          : `Switched session to: ${email || anonId}`
      );
    } catch (err: any) {
      alert(`Identity switch failed: ${err.message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleResetDevice = async () => {
    const msg = isBn
      ? "আপনি কি সম্পূর্ণ নতুন বেনামী নাগরিক পরিচয় তৈরি করতে চান?"
      : "Reset to a brand new anonymous citizen identity?";
    if (!window.confirm(msg)) return;
    await logout();
    alert(
      isBn
        ? "নতুন বেনামী ডিভাইস পরিচয় তৈরি করা হয়েছে।"
        : "New anonymous device identity generated."
    );
  };

  // Derive verification status from latest user verification relation
  const latestVerification = user?.verifications?.[0];
  const isPendingVerification = latestVerification?.status === "PENDING";

  // Trust score coloring
  const trustScore = user?.trustScore ?? 0;
  const trustColorClass =
    trustScore >= 75
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : trustScore >= 50
      ? "text-blue-600 bg-blue-50 border-blue-200"
      : "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
      {/* Single Unified Navbar with integrated EN/বাংলা toggle */}
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* Page Title & Breadcrumb Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl shadow-xs">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isBn
                  ? "নাগরিক পরিচয়, ট্রাস্ট স্কোর ও কেওয়াইসি ভেরিফিকেশন"
                  : "Citizen Identity, Trust Score & KYC Verification"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                {isBn
                  ? "হার্ডওয়্যার-বাউন্ড সেশন শনাক্তকরণ, কমিউনিটি রেপুটেশন মেকানিক্স ও রেসপন্ডার ভেরিফিকেশন পোর্টাল।"
                  : "Cryptographic hardware session bindings, community trust mechanics, and verified responder elevation."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshProfile()}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>{isBn ? "প্রোফাইল রিফ্রেশ" : "Refresh Profile"}</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Citizen Digital Passport (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Account Identity Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300/80 flex items-center justify-center text-slate-700 font-black text-xl shadow-inner">
                    {user?.role === "ADMIN" ? (
                      <Shield className="w-7 h-7 text-purple-600" />
                    ) : user?.role === "VERIFIED_RESPONDER" ? (
                      <BadgeCheck className="w-7 h-7 text-emerald-600" />
                    ) : (
                      <User className="w-7 h-7 text-slate-600" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {isBn ? "বর্তমান নাগরিক স্ট্যাটাস" : "Citizen Tier & Authority"}
                    </span>
                    <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5 mt-0.5">
                      <span>
                        {user?.role === "ADMIN"
                          ? isBn ? "সিস্টেম অ্যাডমিনিস্ট্রেটর" : "System Administrator"
                          : user?.role === "VERIFIED_RESPONDER"
                          ? isBn ? "যাচাইকৃত নাগরিক রেসপন্ডার" : "Verified Citizen Responder"
                          : isBn ? "সুরক্ষিত বেনামী নাগরিক" : "Anonymous Citizen"}
                      </span>
                    </h2>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-[10px] font-extrabold border ${
                        user?.isBanned
                          ? "bg-red-50 text-red-700 border-red-200"
                          : user?.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : user?.role === "VERIFIED_RESPONDER"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span>
                        {user?.isBanned
                          ? isBn ? "নিষিদ্ধ অ্যাকাউন্ট" : "BANNED"
                          : user?.role === "ADMIN"
                          ? isBn ? "অ্যাডমিন রুট পারমিশন" : "ADMIN ROLE"
                          : user?.role === "VERIFIED_RESPONDER"
                          ? isBn ? "কেওয়াইসি সার্টিফাইড" : "KYC VERIFIED"
                          : isBn ? "সক্রিয় নাগরিক" : "ACTIVE CITIZEN"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust Score Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-800">
                      {isBn ? "কমিউনিটি ট্রাস্ট স্কোর" : "Community Trust Score"}
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${trustColorClass}`}>
                    {trustScore} / 100
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(8, trustScore))}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {isBn
                    ? "ট্রাস্ট স্কোর কমিউনিটি ভেরিফিকেশনের মাধ্যমে বৃদ্ধি পায়: বাস্তব রিপোর্ট নিশ্চিত হলে (+৫), সহায়ক তথ্য যোগ করলে (+২), সহনাগরিকদের সমর্থনে (+১)। ভুয়া তথ্য দিলে স্কোর কমে যায় (-১০)।"
                    : "Trust increases dynamically with verified incident submissions (+5), accurate hazard updates (+2), and positive community confirmations (+1). Fraudulent reports are penalized (-10)."}
                </p>
              </div>

              {/* Authoritative Live Impact Statistics */}
              <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-base font-black text-slate-900">
                    {user?._count?.reports ?? 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {isBn ? "রিপোর্ট দাখিল" : "Reports Filed"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-base font-black text-slate-900">
                    {user?._count?.votes ?? 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {isBn ? "ভোট ও যাচাই" : "Votes Cast"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl text-center">
                  <div className="text-base font-black text-slate-900">
                    {user?._count?.alertZones ?? 0}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                    {isBn ? "অ্যালার্ট জোন" : "Alert Zones"}
                  </div>
                </div>
              </div>

              {/* Cryptographic Session & Identity Metadata */}
              <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? "ইউজার ইউইউআইডি (User UUID)" : "User UUID"}</span>
                    </span>
                    <button
                      onClick={() => user?.id && copyToClipboard(user.id, "uuid")}
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      {copiedField === "uuid" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">{isBn ? "কপি হয়েছে" : "Copied"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{isBn ? "কপি" : "Copy"}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 truncate select-all">
                    {user?.id || (isBn ? "লোড হচ্ছে..." : "Loading...")}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                    <span className="flex items-center gap-1">
                      <Fingerprint className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? "ডিভাইস ফিঙ্গারপ্রিন্ট" : "Device Fingerprint"}</span>
                    </span>
                    <button
                      onClick={() => deviceId && copyToClipboard(deviceId, "device")}
                      className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      {copiedField === "device" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">{isBn ? "কপি হয়েছে" : "Copied"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{isBn ? "কপি" : "Copy"}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-700 truncate select-all">
                    {deviceId || (isBn ? "লোড হচ্ছে..." : "Loading...")}
                  </div>
                </div>

                {user?.createdAt && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{isBn ? "অ্যাকাউন্ট সৃষ্টি:" : "Registered On:"}</span>
                    </span>
                    <span className="font-semibold text-slate-700">
                      {new Date(user.createdAt).toLocaleDateString(isBn ? "bn-BD" : "en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* Reset Device Identity Button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetDevice}
                  className="w-full py-2.5 px-3 text-xs font-bold rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>{isBn ? "নতুন বেনামী পরিচয় তৈরি করুন" : "Reset to New Anonymous ID"}</span>
                </button>
              </div>
            </div>

            {/* Terms of Service & Safety Consents Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight">
                      {isBn ? "ব্যবহারের শর্তাবলী ও নিরাপত্তা সম্মতি" : "Terms & Safety Consents"}
                    </h3>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {isBn ? "ডিভাইসে নির্ধারিত আইনি ও সুরক্ষা নীতি" : "Device-bound legal and public safety policies"}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{isBn ? "সক্রিয়" : "Active"}</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isBn
                  ? "জরুরি সেবা (৯৯৯) সতর্কতা, সাইবার নিরাপত্তা আইন, ফাজিং ও কমিউনিটি ট্রাস্ট নীতিসমূহ এই ডিভাইসে নির্ধারিত রয়েছে।"
                  : "Emergency 999 disclaimer, Cyber Security Act compliance, fuzzing, and community trust policies are configured."}
              </p>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("open-safety-terms-modal"));
                  }
                }}
                className="w-full py-2 px-3 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isBn ? "শর্তাবলী দেখুন বা পরিবর্তন করুন" : "Review or Change Selected Terms"}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right Column: Citizen KYC Verification & Responder Elevation (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-6">
            {/* KYC Elevation Hub */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {isBn
                        ? "নাগরিক কেওয়াইসি ভেরিফিকেশন ও রেসপন্ডার সম্মাননা"
                        : "Citizen KYC Verification & Responder Elevation"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {isBn
                        ? "পোস্টজিআইএস ডেটাবেজে বিশ্বস্ত রেসপন্ডার হিসেবে নিজেকে প্রমাণ করুন"
                        : "Elevate to Verified Responder to unlock real-time priority threat dispatch"}
                    </p>
                  </div>
                </div>

                {user?.role === "VERIFIED_RESPONDER" && (
                  <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1.5 shadow-2xs shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isBn ? "যাচাইকৃত রেসপন্ডার" : "Verified Responder"}</span>
                  </span>
                )}
              </div>

              {/* Verified Responder Privileges Card */}
              {user?.role === "VERIFIED_RESPONDER" ? (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-emerald-900 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {isBn ? "রেসপন্ডার সুবিধা সক্রিয় রয়েছে" : "Verified Privileges Active"}
                    </h3>
                  </div>
                  <ul className="text-xs text-emerald-800 space-y-1.5 list-disc list-inside">
                    <li>
                      {isBn
                        ? "আপনার রিপোর্ট করা যেকোনো বিপদ তাৎক্ষণিকভাবে সর্বোচ্চ বিশ্বাসযোগ্যতায় পিন হয়।"
                        : "Incident submissions carry maximum trust weight and display a verified badge."}
                    </li>
                    <li>
                      {isBn
                        ? "লাইভ ফিডে আপনার প্রদান করা যেকোনো আপডেট অন্যান্য নাগরিকের শীর্ষে প্রদর্শিত হয়।"
                        : "Context updates and route clearances appear pinned at the top of the incident stream."}
                    </li>
                    <li>
                      {isBn
                        ? "জরুরি অবস্থায় উদ্ধার অভিযানে সরাসরি অংশ নেওয়ার নাগরিক স্বীকৃতি।"
                        : "Recognized as a verified local emergency contact for rapid community response."}
                    </li>
                  </ul>
                </div>
              ) : isPendingVerification ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {isBn ? "কেওয়াইসি অনুরোধ পর্যালোচনাধীন রয়েছে" : "KYC Request Under Administrative Review"}
                    </h3>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {isBn
                      ? "আপনার ভেরিফিকেশন নথি আমাদের মডারেশন দলের নিকট সংরক্ষিত হয়েছে। অনুমোদিত হলে স্বয়ংক্রিয়ভাবে আপনার প্রোফাইল রেসপন্ডার পদে উন্নীত হবে।"
                      : "Your verification request has been queued. An administrator will review your credentials in the moderation portal to elevate your trust status."}
                  </p>
                  {user?.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:text-amber-950 underline mt-1"
                    >
                      <span>{isBn ? "অ্যাডমিন পোর্টালে গিয়ে অনুমোদন করুন" : "Review pending submissions in Admin Console"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl text-blue-900 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isBn ? "রেসপন্ডার হিসেবে ভেরিফিকেশনের গুরুত্ব" : "Why Verify Your Citizen Identity?"}
                    </span>
                  </div>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {isBn
                      ? "রেসপন্ডার পদে উন্নীত হলে আপনার রিপোর্ট করা তথ্য অন্যান্য নাগরিকের কাছে সর্বোচ্চ প্রাধান্য পাবে এবং কোনো বিলম্ব ছাড়াই লাইভ ম্যাপে প্রতিফলিত হবে।"
                      : "Elevating your account grants priority trust weighting on live threat pins and displays a verified badge on all public incident dispatches."}
                  </p>
                </div>
              )}

              {verifySuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-bold">{verifySuccess}</p>
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-bold"
                    >
                      <span>{isBn ? "অনুমোদনের জন্য অ্যাডমিন পোর্টাল খুলুন" : "Open Admin Portal to approve request"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {verifyError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* KYC Verification Form */}
              {user?.role !== "VERIFIED_RESPONDER" && (
                <form onSubmit={handleSubmitVerification} className="space-y-4 pt-2">
                  {/* Verification Method Tabs */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      {isBn ? "ভেরিফিকেশন পদ্ধতি নির্বাচন করুন:" : "Select Verification Method:"}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setVerifyType("PHONE_OTP")}
                        className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                          verifyType === "PHONE_OTP"
                            ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-600/20 shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <Smartphone className="w-4 h-4 text-blue-600" />
                        <span>{isBn ? "মোবাইল ওটিপি ভেরিফিকেশন" : "Phone OTP Verification"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVerifyType("NID_DOCUMENT")}
                        className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                          verifyType === "NID_DOCUMENT"
                            ? "bg-blue-50 border-blue-600 text-blue-700 ring-2 ring-blue-600/20 shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        <FileCheck className="w-4 h-4 text-blue-600" />
                        <span>{isBn ? "জাতীয় স্মার্ট আইডি কার্ড" : "Smart NID Document"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Input Fields */}
                  {verifyType === "PHONE_OTP" ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isBn ? "বাংলাদেশি মোবাইল নম্বর" : "Bangladeshi Mobile Number"}
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+8801XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isBn
                          ? "গ্রামীণফোন, রবি, বাংলালিংক বা টেলিটক নম্বরে নিশ্চিতকরণ এসএমএস ওটিপি প্রেরিত হবে।"
                          : "Simulates SMS OTP dispatch to standard Bangladesh telcos (GP, Robi, Banglalink, Teletalk)."}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {isBn ? "স্মার্ট এনআইডি কার্ড বা প্রামাণ্য নথির লিংক" : "Smart NID Card or Document Evidence URL"}
                      </label>
                      <input
                        type="text"
                        value={documentUrl}
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        placeholder="https://storage.supabase.co/..."
                        className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isBn
                          ? "প্রশাসনিক কেওয়াইসি নিরীক্ষার জন্য ক্লাউড স্টোরেজে আপলোডকৃত নথির সুরক্ষিত ইউআরএল।"
                          : "Secure cloud storage object URL stored for administrative KYC audit verification."}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingVerify || isPendingVerification}
                    className="w-full py-3 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                  >
                    {isSubmittingVerify ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isBn ? "কেওয়াইসি জমা হচ্ছে..." : "Submitting KYC Request..."}</span>
                      </>
                    ) : isPendingVerification ? (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>{isBn ? "অনুরোধ পর্যালোচনাধীন রয়েছে" : "Verification Request Pending Review"}</span>
                      </>
                    ) : (
                      <>
                        <Award className="w-4 h-4" />
                        <span>
                          {isBn
                            ? "ভেরিফিকেশন অনুরোধ দাখিল করুন (POST /api/v1/users/verify)"
                            : "Submit Citizen Verification (POST /users/verify)"}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Developer & QA Persona Switcher Tray (Collapsible, dev-only) */}
            {process.env.NODE_ENV === "development" && (
            <div className="bg-slate-100/80 border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowDevSandbox(!showDevSandbox)}
                className="w-full px-5 py-3.5 text-xs font-bold text-slate-800 flex items-center justify-between hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-600" />
                  <span>
                    {isBn
                      ? "ডেভেলপার স্যান্ডবক্স ও পারসোনা সুইচিং"
                      : "Developer & QA Persona Role Switcher"}
                  </span>
                </div>
                {showDevSandbox ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>

              {showDevSandbox && (
                <div className="p-5 border-t border-slate-200 bg-white space-y-3">
                  <p className="text-xs text-slate-600 leading-normal">
                    {isBn
                      ? "রোলে ভিত্তিক নিরাপত্তা নীতি (RBAC) পরীক্ষা করার জন্য তাত্ক্ষণিকভাবে টেস্ট অ্যাকাউন্ট সক্রিয় করুন:"
                      : "Switch between different authenticated citizen personas to verify role guards (requireAuth, requireRole):"}
                  </p>

                  <div className="grid grid-cols-1 gap-2.5 pt-1">

                    <button
                      type="button"
                      onClick={() => handleSwitchIdentity("citizen-tester-02-uuid")}
                      disabled={isSwitching}
                      className="p-3 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 transition-all text-left flex items-center justify-between shadow-2xs active:scale-98 cursor-pointer"
                    >
                      <div>
                        <div className="font-extrabold">{isBn ? "নাগরিক পারসোনা #২" : "Switch to Citizen #2"}</div>
                        <div className="text-[10px] text-slate-500 font-normal">citizen-tester-02-uuid</div>
                      </div>
                      <User className="w-4 h-4 shrink-0 text-slate-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
