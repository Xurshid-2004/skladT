import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import OnlineStatus from "@/components/common/online-status";
import NumberInputWheelGuard from "@/components/common/number-input-wheel-guard";

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
          {children}
        </ThemeProvider>
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var host = location.hostname;
                var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
                if (isLocal) {
                  // Dev: eski service worker sahifani qayta yuklatib turishi mumkin —
                  // shuning uchun localhost'da registratsiya qilmaymiz va eskilarini olib tashlaymiz.
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    regs.forEach(function(r) { r.unregister(); });
                  }).catch(function() {});
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(registration) {
                      console.log('ServiceWorker registration successful');
                    }, function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
