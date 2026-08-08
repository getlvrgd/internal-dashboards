import type { Metadata } from "next";

import { FaviconSync } from "@/components/FaviconSync";
import { THEME_SCRIPT } from "@/components/ThemeToggle";

import "./globals.css";

/**
 * Two tab icons, not one: the LVRGD mark is solid black and solid white, and neither
 * reads against both tab strips. The `media` queries pick the right one for the OS
 * setting before any JavaScript runs; FaviconSync then keeps it honest for anyone who
 * has overridden that with the in-app theme toggle.
 *
 * `app/favicon.ico` is deliberately absent — the file convention emits its own
 * unconditional <link>, which would outrank these and pin one mark for everybody.
 */
export const metadata: Metadata = {
  title: "Internal dashboards",
  description: "Every LVRGD internal dashboard, behind one owner hub",
  // Kept out of search results. The login wall is the control; this is tidiness.
  robots: { index: false, follow: false },
  icons: {
    icon: [
      {
        url: "/icon-light.png",
        type: "image/png",
        sizes: "64x64",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark.png",
        type: "image/png",
        sizes: "64x64",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

/**
 * No webfont is loaded. The type stack in globals.css asks the operating system for
 * San Francisco, which is how Apple licenses it — SF ships with macOS and iOS and may
 * not be redistributed as a webfont. On a Mac this renders in genuine SF; elsewhere it
 * falls back to that platform's own UI face.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint, so a dark-mode user never
            sees a white flash. Must run ahead of React. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <FaviconSync />
        {children}
      </body>
    </html>
  );
}
