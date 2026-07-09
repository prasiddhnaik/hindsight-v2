"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { MenuIcon } from "~/app/_components/icons";
import { Sidebar } from "~/app/_components/sidebar";

/**
 * Responsive shell: static sidebar on md+, slide-in drawer with scrim below.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Navigating closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  return (
    <div className="flex h-dvh">
      {drawerOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/55 md:hidden"
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-hairline px-2 py-2 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex size-10 items-center justify-center rounded-lg text-ink-secondary transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
          >
            <MenuIcon className="size-5" />
          </button>
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight">
              Hindsight
            </span>
            <span className="size-1.5 translate-y-[-1px] rounded-full bg-accent" />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
