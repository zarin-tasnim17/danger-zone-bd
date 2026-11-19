"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { useLanguageStore } from "@/store/useLanguageStore";
import { showToast } from "@/store/useToastStore";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

interface AdminLoginGatewayProps {
  onSuccess?: () => void;
  showBackToMap?: boolean;
}

export default function AdminLoginGateway({
  onSuccess,
  showBackToMap = true,
}: AdminLoginGatewayProps) {
  const router = useRouter();
  const { loginAdminWithPassword, isLoading: storeLoading } = useAuthStore();
  const { language } = useLanguageStore();
  const isBn = language === "bn";

  const [email, setEmail] = useState("admin@safetymap.bd");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage(
        isBn
          ? "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড উভয়ই পূরণ করুন।"
          : "Please provide both administrator email and password."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await loginAdminWithPassword(trimmedEmail, password);
      showToast(
        isBn
          ? "প্রশাসনিক প্রমাণীকরণ সফল হয়েছে।"
          : "Administrator authenticated successfully.",
        "success"
      );
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/admin");
      }
    } catch (err: any) {
      const msg =
        err.message ||
        (isBn
          ? "প্রমাণীকরণ ব্যর্থ হয়েছে। আপনার পরিচয়পত্র যাচাই করুন।"
          : "Authentication failed. Invalid email or password.");
      setErrorMessage(msg);
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || storeLoading;

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Premium Minimal Admin Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/5 p-6 sm:p-8 transition-all">
        
        {/* Header: Danger Zone Shield Badge & Title */}
        <div className="text-center space-y-3 mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-red-600 border border-red-100 shadow-2xs mx-auto">
            <Shield className="w-6 h-6 fill-red-600/10" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isBn ? "অ্যাডমিন পোর্টাল" : "Admin Portal"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isBn
                ? "মডারেশন কনসোলে প্রবেশ করতে সাইন ইন করুন"
                : "Sign in to access Danger Zone moderation tools"}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 p-3 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Address */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-slate-700"
            >
              {isBn ? "অ্যাডমিন ইমেইল" : "Admin Email"}
            </label>
            <div className="relative">
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@safetymap.bd"
                disabled={isBusy}
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-600 focus:ring-4 focus:ring-red-600/10 focus:outline-none transition-all shadow-2xs disabled:opacity-60"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-slate-700"
            >
              {isBn ? "পাসওয়ার্ড" : "Password"}
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={isBusy}
                className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-600 focus:ring-4 focus:ring-red-600/10 focus:outline-none transition-all shadow-2xs disabled:opacity-60"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Primary Submit CTA - Matches "Report Threat" Navbar Button */}
          <button
            type="submit"
            disabled={isBusy}
            className="w-full mt-2 py-2.5 sm:py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{isBn ? "সাইন ইন হচ্ছে..." : "Signing In..."}</span>
              </>
            ) : (
              <>
                <span>{isBn ? "কনসোলে প্রবেশ করুন" : "Sign In to Console"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        {showBackToMap && (
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isBn ? "লাইভ ম্যাপে ফিরে যান" : "Return to Live Map"}</span>
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
