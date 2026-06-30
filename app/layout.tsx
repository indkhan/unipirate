import type { Metadata } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { ProfileProvider } from "@/components/profile-provider"
import "./globals.css"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
})

export const metadata: Metadata = {
  title: "UniPirate · Bachelor's in Germany, charted.",
  description:
    "Check qualification recognition and explore bachelor's programs in Germany.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  )
}
