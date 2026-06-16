import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import OnlineStatus from "@/components/common/online-status";
import NumberInputWheelGuard from "@/components/common/number-input-wheel-guard";
import ServiceWorkerRegistrar from "@/components/common/service-worker-registrar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "UZ Temiryo'l Energiya Ta'minot",
  description: "O'zbekiston temir yo'l zapravkalaridagi dizel yoqilg'i hisob tizimi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UZ Temiryo'l",
  },
  openGraph: {
    title: "UZ Temiryo'l Energiya Ta'minot",
    description: "O'zbekiston temir yo'l zapravkalaridagi dizel yoqilg'i hisob tizimi",
    url: "https://uz-temiryo-l-energo-tamin.web.app",
    siteName: "UZ Temiryo'l",
    locale: "uz_UZ",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <OnlineStatus />
          <NumberInputWheelGuard />
          <ServiceWorkerRegistrar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
