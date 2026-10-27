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

export function EmergencySosPill() {
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
      {/* Floating Panic Pill */}
      <aside aria-label={isBn ? "জরুরি সহায়তা প্যানেল" : "Emergency SOS Panel"}>
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[999] flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold px-4 py-3 rounded-full shadow-2xl shadow-red-950/60 border border-red-400/40 active:scale-95 transition-all duration-150 cursor-pointer group"
          title={isBn ? "জরুরি জাতীয় সহায়তা (৯৯৯)" : "Emergency SOS Help (999)"}
        >
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white" />
          </span>
          <PhoneCall className="w-4 h-4 text-white group-hover:rotate-12 transition-transform duration-200" />
          <span className="text-xs uppercase tracking-wider font-extrabold">
            {isBn ? "জরুরি ৯৯৯" : "SOS 999"}
          </span>
        </button>
      </aside>

      {/* Emergency Action Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl shadow-red-950/80 space-y-5 relative">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">
                    {isBn ? "জরুরি সহায়তা কেন্দ্র (৯৯৯)" : "Emergency SOS Command"}
                  </h3>
                  <p className="text-xs text-red-300 font-medium">
                    {isBn ? "জাতীয় জরুরি সেবা ও পুলিশ কল" : "National Emergency Dispatch Hotline"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct 999 Call Button */}
            <a
              href="tel:999"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-black text-lg tracking-wide shadow-xl shadow-red-600/40 border border-red-400/50 transition-all cursor-pointer"
            >
              <PhoneCall className="w-6 h-6 animate-bounce" />
              <span>{isBn ? "এখনই ৯৯৯ এ কল করুন" : "CALL 999 NOW"}</span>
            </a>

            {/* Live GPS Coordinates Readout Box */}
            <div className="bg-slate-950/80 border border-slate-700/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  {isBn ? "আপনার বর্তমান জিপিএস অবস্থান" : "Your Exact Live GPS Coordinates"}
                </span>
                {coords?.accuracy && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    ±{coords.accuracy}m accuracy
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                <span className="font-mono text-sm font-bold text-cyan-300 tracking-wider">
                  {coordsText}
                </span>
                {coords && (
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title="Copy coordinates"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {gpsError && (
                <p className="text-[11px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {gpsError}
                </p>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isBn
                  ? "পুলিশ বা উদ্ধারকর্মীদের সরাসরি উপরোক্ত অক্ষাংশ ও দ্রাঘিমাংশ (Latitude, Longitude) বলুন।"
                  : "Read these coordinates out loud to the 999 dispatcher to pinpoint your location."}
              </p>
            </div>

            {/* Quick Share to Contacts */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-semibold text-xs transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isBn ? "হোয়াটসঅ্যাপে পাঠান" : "WhatsApp SOS"}</span>
              </a>

              <a
                href={smsUrl}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-xs transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{isBn ? "এসএমএস পাঠান" : "SMS Alert"}</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EmergencySosPill;
