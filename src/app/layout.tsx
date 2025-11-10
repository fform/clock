import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@/lib/utils";
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
  title: {
    default: "Canvas Clock Studio",
    template: "%s · Canvas Clock Studio",
  },
  description:
    "Configure Canvas Clock projects with multi-macro songs, reusable MIDI templates, and setlist planning tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "bg-background text-on-surface antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
