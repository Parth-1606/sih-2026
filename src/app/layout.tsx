import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Shell from "@/components/Shell";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Marine Intelligence — Mission Control",
  description: "Agentic AI marine dashboard — SST, PFZ, weather, safety",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full">
        <TooltipProvider>
          <Shell>{children}</Shell>
        </TooltipProvider>
      </body>
    </html>
  );
}
