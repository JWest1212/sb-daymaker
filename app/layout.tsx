import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import { SavesProvider } from "@/components/saves/SavesProvider";
import { ItinerariesProvider } from "@/components/plan/ItinerariesProvider";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { SvgDefs } from "@/components/visuals";
import { Analytics } from "@vercel/analytics/react";
// CSS load order is the cascade order: tokens first, then Tailwind + token-var
// overrides (globals), then the component layer.
import "./sbdaymaker_tokens.css";
import "./globals.css";
import "./components.css";

// Brand type per CLAUDE.md §5: Fraunces (display), Inter (body/UI), JetBrains Mono (data).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sbdaymaker.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SB Daymaker",
    template: "%s",
  },
  description:
    "Find what's worth doing in Santa Barbara, daily. Find it, save it, share it.",
  applicationName: "SB Daymaker",
  appleWebApp: {
    capable: true,
    title: "SB Daymaker",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon-180.png",
  },
  openGraph: {
    title: "SB Daymaker",
    description:
      "Find what's worth doing in Santa Barbara, daily. Find it, save it, share it.",
    siteName: "SB Daymaker",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F6F1E7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full">
        <SvgDefs />
        <SavesProvider>
          <ItinerariesProvider>{children}</ItinerariesProvider>
        </SavesProvider>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
