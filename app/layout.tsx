import type { Metadata } from "next";
import {
  Archivo,
  Geist,
  Geist_Mono,
  IBM_Plex_Mono,
  Public_Sans,
} from "next/font/google";
import "./globals.css";

import { PostHogProvider } from "@/components/app/posthog-provider";
import { ThemeToggle } from "@/components/app/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Wayfinding fonts (design/tokens/typography.css); consumed via the
// --font-display/--font-body/--font-wf-mono tokens in globals.css. They must
// live on <html> so the :root token block can resolve them.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "UniPirate",
  description: "Your guided path to studying in Germany",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { const key = "unipirate.theme"; const saved = localStorage.getItem(key); const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.classList.toggle("dark", dark); document.documentElement.dataset.theme = dark ? "dark" : "light"; })()`,
          }}
        />
        <PostHogProvider>
          {children}
          <ThemeToggle />
        </PostHogProvider>
      </body>
    </html>
  );
}
