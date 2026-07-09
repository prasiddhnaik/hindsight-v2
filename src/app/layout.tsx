import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";

import { AppShell } from "~/app/_components/appShell";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Hindsight",
  description: "General-purpose AI assistant",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${newsreader.variable}`}>
      <body className="bg-bg text-ink antialiased">
        <TRPCReactProvider>
          <AppShell>{children}</AppShell>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
