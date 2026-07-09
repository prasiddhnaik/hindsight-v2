import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { Sidebar } from "~/app/_components/sidebar";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-neutral-950 text-neutral-100">
        <TRPCReactProvider>
          <div className="mx-auto flex h-dvh max-w-6xl">
            <Sidebar />
            {children}
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
