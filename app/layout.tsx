import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import LaunchSplash from "@/components/launch-splash/LaunchSplash";
import { SPLASH_SEEN_KEY } from "@/components/launch-splash/constants";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Xtrack — Student Expense Tracker",
  description: "Track your expenses as an international student",
};

// Runs while the HTML is parsed, before first paint, so the splash is on screen
// the moment the home-screen app opens rather than after React hydrates.
// Shown once per launch; add ?splash=1 to any URL to preview it in a browser.
const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement,q=/[?&]splash=1(&|$)/.test(location.search),s=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(q||(s&&!sessionStorage.getItem('${SPLASH_SEEN_KEY}')))d.setAttribute('data-splash','on')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The splash script sets data-splash on <html> before React hydrates.
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        <LaunchSplash />
        {children}
      </body>
    </html>
  );
}
