import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import EmergencySosPill from "@/components/emergency/EmergencySosPill";
import SafetyTutorialModal from "@/components/emergency/SafetyTutorialModal";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import ToastContainer from "@/components/ui/ToastContainer";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Danger Zone ⚡ — Bangladesh Safety & Alert Map",
  description: "Real-time, crowdsourced community safety, alert, and danger zone map for Bangladesh",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSansBengali.variable}`}>
      <body className="antialiased bg-slate-50 text-slate-900">
        {children}
        <EmergencySosPill />
        <SafetyTutorialModal />
        <ServiceWorkerRegister />
        <ToastContainer />
      </body>
    </html>
  );
}
