import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter } from "next/font/google";
import { SettingsProvider } from "@/hooks/useSettings";
import { ToastProvider } from "@/hooks/useToast";
import "./globals.css";

const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-serif-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SIGIL — AI Brand Identity Studio",
    template: "%s · SIGIL",
  },
  description:
    "A structured, human-in-the-loop logo design pipeline: discovery, strategy, creative exploration, curation, refinement, client review, and brand delivery.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#08080b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <SettingsProvider>
          <ToastProvider>
            <div className="relative z-10">{children}</div>
          </ToastProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
