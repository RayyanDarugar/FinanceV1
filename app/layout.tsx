import type { Metadata, Viewport } from "next";
import { DataProvider } from "@/lib/data/DataProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Event Finder",
  description: "This week's events and groups worth your time",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#faf8f4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink">
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
