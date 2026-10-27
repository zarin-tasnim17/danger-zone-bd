"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import RouteTestNav from "@/components/layout/RouteTestNav";
import Navbar from "@/components/layout/Navbar";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
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
} from "lucide-react";

export default function ProfilePage() {
  const { user, deviceId, initAuth, logout, refreshProfile } = useAuthStore();

  // Verification Form
  const [verifyType, setVerifyType] = useState<"PHONE_OTP" | "NID_DOCUMENT">("PHONE_OTP");
  const [phoneNumber, setPhoneNumber] = useState("+8801700000000");
  const [documentUrl, setDocumentUrl] = useState(
    "https://storage.supabase.co/storage/v1/object/public/verifications/sample-nid.jpg"
  );
  const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Identity Switcher
  const [customDeviceId, setCustomDeviceId] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

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
        `Verification request (${res.type}) submitted! Status: ${res.status}. An administrator can now approve this in the Admin Portal.`
      );
      await refreshProfile();
    } catch (err: any) {
      setVerifyError(err.message || "Failed to submit verification request");
    } finally {
      setIsSubmittingVerify(false);
    }
  };

  const handleSwitchIdentity = async (anonId: string, email?: string) => {
    setIsSwitching(true);
    try {
      localStorage.setItem("bd_safety_device_id", anonId);
      await apiFetch("/auth/device", {
        method: "POST",
        body: JSON.stringify({ anonymousId: anonId, email }),
      });
      await initAuth();
      alert(`Switched session to: ${email || anonId}`);
    } catch (err: any) {
      alert(`Identity switch failed: ${err.message}`);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleResetDevice = async () => {
    if (!confirm("Reset to a brand new anonymous citizen identity?")) return;
    await logout();
    alert("New anonymous device identity generated.");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <RouteTestNav />
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <UserCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Citizen Identity, Trust Score & KYC Verification
            </h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Inspect hardware session bindings, review trust metrics, and test citizen elevation to Verified Responder.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Overview Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-lg">
                <User className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">Current Account</span>
                <h2 className="text-base font-bold text-slate-900">
                  {user?.role === "ADMIN"
                    ? "Administrator"
                    : user?.role === "VERIFIED_RESPONDER"
                    ? "Verified Responder"
                    : "Anonymous Citizen"}
                </h2>
              </div>
            </div>

            {/* Trust Score Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-600">Community Trust Score</span>
                <span className="text-emerald-600">{user?.trustScore ?? 50} / 100</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(10, user?.trustScore ?? 50))}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Trust increases with verified reports & helpful updates; decreases with community downvotes.
              </p>
            </div>

            {/* Metadata Fields */}
            <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">User UUID</span>
                <span className="font-mono text-slate-700 select-all">{user?.id || "Loading..."}</span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Device Fingerprint</span>
                <span className="font-mono text-slate-700 select-all truncate block">
                  {deviceId || "Loading..."}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                    user?.isBanned
                      ? "bg-rose-100 text-rose-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {user?.isBanned ? "BANNED" : "ACTIVE & GOOD STANDING"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                onClick={handleResetDevice}
                className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to New Device ID</span>
              </button>
            </div>
          </div>

          {/* Right 2 Columns: KYC Verification & Identity Switcher */}
          <div className="md:col-span-2 space-y-6">
            {/* KYC Citizen Verification Form */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Citizen KYC Verification (POST /api/v1/users/verify)
                  </h3>
                </div>
                {user?.role === "VERIFIED_RESPONDER" && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verified Responder
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Elevating your account to <strong>Verified Responder</strong> grants higher trust weighting on incident pins and verified badges on all public context updates.
              </p>

              {verifySuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold">{verifySuccess}</p>
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1 text-emerald-700 hover:underline font-bold mt-1"
                    >
                      <span>Open Admin Portal to approve request</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {verifyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <p>{verifyError}</p>
                </div>
              )}

              <form onSubmit={handleSubmitVerification} className="space-y-4">
                {/* Method Selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyType("PHONE_OTP")}
                    className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      verifyType === "PHONE_OTP"
                        ? "bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Phone OTP Verification</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVerifyType("NID_DOCUMENT")}
                    className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                      verifyType === "NID_DOCUMENT"
                        ? "bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>National ID Document</span>
                  </button>
                </div>

                {/* Input Fields */}
                {verifyType === "PHONE_OTP" ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Bangladeshi Mobile Number
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+8801XXXXXXXXX"
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Simulates SMS OTP dispatch to standard Bangladesh telcos (Grameenphone, Robi, Banglalink, Teletalk).
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Smart NID / Document Evidence URL
                    </label>
                    <input
                      type="text"
                      value={documentUrl}
                      onChange={(e) => setDocumentUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Direct cloud storage object URL stored for administrative KYC audit review.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingVerify}
                  className="w-full py-2.5 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmittingVerify ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting KYC Request...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Submit Citizen Verification (POST /users/verify)</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Test Identity Switcher Box */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-purple-600" />
                <span>Developer Identity & Role Switcher</span>
              </h3>
              <p className="text-xs text-slate-600 leading-normal">
                Easily simulate different user personas to test role guards (`requireAuth`, `requireRole`):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleSwitchIdentity("admin-device-master-uuid", "admin@safetymap.bd")}
                  disabled={isSwitching}
                  className="p-2.5 text-xs font-bold rounded-lg bg-purple-700 hover:bg-purple-800 text-white transition-colors text-left flex items-center justify-between"
                >
                  <span>Switch to Admin Account</span>
                  <Shield className="w-4 h-4 shrink-0" />
                </button>

                <button
                  onClick={() => handleSwitchIdentity("citizen-tester-02-uuid")}
                  disabled={isSwitching}
                  className="p-2.5 text-xs font-bold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors text-left flex items-center justify-between"
                >
                  <span>Switch to Citizen Persona #2</span>
                  <User className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
