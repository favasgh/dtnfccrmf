import type { Metadata, Viewport } from "next"
import { Titillium_Web } from "next/font/google"
import "./globals.css"

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
  variable: "--font-titillium",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Double Tap CRM",
  description: "CRM for Double Tap NFC Smart Cards — Create. Code. Connect.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${titillium.variable}`}>
      <body className={`min-h-full flex flex-col bg-background text-foreground antialiased font-sans ${titillium.className}`}>
        {children}
      </body>
    </html>
  )
}
