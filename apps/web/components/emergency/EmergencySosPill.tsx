"use client";

import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  AlertTriangle,
  X,
  Copy,
  Check,
  Send,
  Navigation,
  ShieldAlert,
} from "lucide-react";
import { useLanguageStore } from "@/store/useLanguageStore";

export default function EmergencySosPill() {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { language } = useLanguageStore();

  const isBn = language === "bn";

  useEffect(() => {
    if (isOpen && !coords && typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        (err) => {
          setGpsError(err.message || "Failed to retrieve live coordinates");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isOpen, coords]);

  const coordsText = coords
    ? `${coords.lat}, ${coords.lng}`
    : "Acquiring live GPS...";

  const handleCopy = () => {
    if (!coords) return;
    navigator.clipboard.writeText(coordsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const distressMessage = coords
    ? `🚨 জরুরি সাহায্য প্রয়োজন! (EMERGENCY DISTRESS): আমি বিপদে আছি। আমার অবস্থান (Coordinates): https://maps.google.com/?q=${coords.lat},${coords.lng}`
    : "🚨 জরুরি সাহায্য প্রয়োজন! (EMERGENCY DISTRESS): আমি বিপদে আছি।";

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(distressMessage)}`;
  const smsUrl = `sms:?body=${encodeURIComponent(distressMessage)}`;

  return (
    <>
      {/* Floating Panic Pill: Carefully positioned on mobile to dock seamlessly with feed trigger bar */}
      <aside aria-label={isBn ? "জরুরি সহায়তা প্যানেল" : "Emergency SOS Panel"}>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-3 sm:bottom-6 sm:right-6 z-[999] flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-2xl shadow-red-950/60 border border-red-400/40 active:scale-95 transition-all duration-150 cursor-pointer group"
          title={isBn ? "জরুরি জাতীয় সহায়তা (৯৯৯)" : "Emergency SOS Help (999)"}
        >
          <span className="relative flex h-2.5 w-2.5 sm:h-3.5 sm:w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 bg-white" />
          </span>
          <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white group-hover:rotate-12 transition-transform duration-200" />
          <span className="text-[11px] sm:text-xs uppercase tracking-wider font-extrabold whitespace-nowrap">
            {isBn ? "৯৯৯" : "SOS 999"}
          </span>
        </button>
      </aside>

      {/* Emergency Action Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-red-200 rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl space-y-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-600 shadow-2xs">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">
                    {isBn ? "জরুরি সহায়তা কেন্দ্র (৯৯৯)" : "Emergency SOS Command"}
                  </h3>
                  <p className="text-xs text-red-600 font-semibold">
                    {isBn ? "জাতীয় জরুরি সেবা ও পুলিশ কল" : "National Emergency Dispatch Hotline"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct 999 Call Button */}
            <a
              href="tel:999"
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-lg shadow-xl shadow-red-600/30 active:scale-[0.98] transition-transform"
            >
              <PhoneCall className="w-6 h-6 animate-bounce" />
              <span>{isBn ? "৯৯৯ এ কল করুন (বিনামূল্যে)" : "Call 999 Dispatch Now"}</span>
            </a>

            {/* Coordinates & Location Copy */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Navigation className="w-3.5 h-3.5 text-blue-600" />
                  {isBn ? "আপনার বর্তমান অবস্থান (GPS)" : "Your Current GPS Location"}
                </span>
                {coords?.accuracy && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ±{coords.accuracy}m
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
                <span className="font-mono text-xs text-slate-800 truncate">
                  {coordsText}
                </span>
                <button
                  disabled={!coords}
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-40 transition shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600">{isBn ? "কপি হয়েছে" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{isBn ? "কপি" : "Copy"}</span>
                    </>
                  )}
                </button>
              </div>

              {gpsError && (
                <p className="text-[10px] text-red-500 font-semibold">
                  ⚠️ {gpsError}
                </p>
              )}
            </div>

            {/* Quick Share with Family & Friends */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                {isBn ? "পরিবার বা বন্ধুদের অবস্থান পাঠান:" : "Dispatch Location to Contacts:"}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={smsUrl}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition shadow-2xs"
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>SMS</span>
                </a>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="text-[10px] text-slate-400 text-center leading-normal">
              {isBn
                ? "৯৯৯ বাংলাদেশ সরকারের জাতীয় জরুরি হেল্পলাইন (পুলিশ, ফায়ার সার্ভিস, অ্যাম্বুলেন্স)।"
                : "999 is Bangladesh Government's toll-free emergency dispatch (Police, Fire, Ambulance)."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
export { EmergencySosPill };
