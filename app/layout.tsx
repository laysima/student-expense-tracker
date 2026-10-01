import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import LaunchSplash from "@/components/launch-splash/LaunchSplash";
import { SPLASH_SEEN_KEY } from "@/components/launch-splash/constants";
import { SPLASH_CSS } from "@/components/launch-splash/splash-styles";
import ServiceWorker from "@/components/ServiceWorker";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
});

// iOS shows a startup image the instant the home-screen app is tapped, while
// it waits for the first page. Without one the screen stays white. Each image
// is the splash's first frame at one iPhone size (public/splash/), so the hand
// off to the live splash is seamless. [css width, css height, pixel ratio]
const IPHONE_SCREENS = [
  [440, 956, 3], [420, 912, 3], [430, 932, 3], [428, 926, 3], [414, 896, 3], [414, 896, 2],
  [402, 874, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3], [375, 667, 2],
] as const;

export const metadata: Metadata = {
  title: "Xtrack — Expense Tracker",
  description: "Track your spending, income and budgets in one place",
  appleWebApp: {
    capable: true,
    title: "Xtrack",
    statusBarStyle: "black",
    startupImage: IPHONE_SCREENS.map(([width, height, ratio]) => ({
      url: `/splash/apple-splash-${width * ratio}x${height * ratio}.jpg`,
      media: `screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
    })),
  },
  // Older iOS versions only honour startup images with the legacy tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// Runs while the HTML is parsed, before first paint, so the splash is on screen
// the moment the home-screen app opens rather than after React hydrates.
// Shown once per launch and always on /launch (the home-screen start URL);
// add ?splash=1 to any URL to preview it in a browser.
const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement,q=/[?&]splash=1(&|$)/.test(location.search),s=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(q||location.pathname==='/launch'||(s&&!sessionStorage.getItem('${SPLASH_SEEN_KEY}')))d.setAttribute('data-splash','on')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The splash script sets data-splash on <html> before React hydrates.
    <html lang="en" className={`${poppins.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: "var(--font-poppins), sans-serif" }}
      >
        <LaunchSplash />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
