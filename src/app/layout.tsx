import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
});

const TITLE = "Boba Story — Quán trà sữa của những chú mèo";
const DESCRIPTION = "Game pha chế trà sữa cozy: tự tay pha từng ly cho những vị khách mèo đáng yêu. Miễn phí, chơi ngay trên điện thoại, iPad và máy tính.";

export const metadata: Metadata = {
  metadataBase: new URL("https://boba-story.vercel.app"),
  title: { default: TITLE, template: "%s · Boba Story" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Boba Story", locale: "vi_VN", title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  applicationName: "Boba Story",
  appleWebApp: { capable: true, title: "Boba Story", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#3b2416",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${baloo.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
