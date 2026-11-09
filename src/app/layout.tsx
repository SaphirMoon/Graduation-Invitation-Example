import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Dancing_Script, Love_Light, Playfair_Display, Playwrite_VN } from "next/font/google";
import { THEME, themeCssVars } from "@/config/theme";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-main",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
});

/** Display face for titles, "tap to open", buttons and the speaker caption. */
const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});

/** Handwriting for the invitation card (designed for Vietnamese; Google ships it unsubsetted). */
const hand = Playwrite_VN({
  variable: "--font-hand",
  weight: "variable",
  display: "swap",
});

/** Per-glyph fallback for the handwriting (has a real "vietnamese" subset); only fetched if needed. */
const handAlt = Dancing_Script({
  variable: "--font-hand-alt",
  subsets: ["vietnamese"],
  preload: false,
});

/** Script face for the guest's name on the invitation card. */
const nameFont = Love_Light({
  variable: "--font-name",
  weight: "400",
  subsets: ["vietnamese"],
  preload: false,
});

function siteUrl(): URL {
  if (process.env.NEXT_PUBLIC_SITE_URL) return new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME.bg,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" style={themeCssVars() as CSSProperties} className={`${font.variable} ${display.variable} ${hand.variable} ${handAlt.variable} ${nameFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
