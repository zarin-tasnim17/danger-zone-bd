import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import EmergencySosPill from "@/components/emergency/EmergencySosPill";
import SafetyTutorialModal from "@/components/emergency/SafetyTutorialModal";
import TermsConsentModal from "@/components/onboarding/TermsConsentModal";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import ToastContainer from "@/components/ui/ToastContainer";

export const metadata: Metadata = {
  title: "Danger Zone ⚡ — Bangladesh Safety & Alert Map",
  description: "Real-time, crowdsourced community safety, alert, and danger zone map for Bangladesh",
  manifest: "/manifest.json",
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
        <EmergencySosPill />
        <SafetyTutorialModal />
        <TermsConsentModal />
        <ServiceWorkerRegister />
        <ToastContainer />
      </body>
    </html>
  );
}
