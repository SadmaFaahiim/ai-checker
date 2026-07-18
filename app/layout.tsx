import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "react-hot-toast";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI-Checker",
  description: "Check whether text, images, or video are likely AI-generated.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <div className="app-backdrop" aria-hidden />
          <div className="app-grid" aria-hidden />
          <div className="app-noise" aria-hidden />
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 5000,
              className: "text-sm",
              style: {
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--line)",
                borderRadius: "0.875rem",
                boxShadow: "0 20px 40px -12px rgba(0,0,0,0.35)",
                backdropFilter: "blur(20px)",
              },
              success: {
                iconTheme: { primary: "#22C55E", secondary: "#ffffff" },
              },
              error: {
                iconTheme: { primary: "#EF4444", secondary: "#ffffff" },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
