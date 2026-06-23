import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "SB Daymaker",
    template: "%s",
  },
  description:
    "Find what's worth doing in Santa Barbara today — find it, save it, share it.",
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
