"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MenuIcon } from "~/app/_components/icons";
import { ModalSheet } from "~/app/_components/modal-sheet";
import { Sidebar } from "~/app/_components/sidebar";

/**
 * Responsive shell: static sidebar on md+, slide-in drawer with scrim below.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Navigating closes the drawer.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 768px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };

    desktopViewport.addEventListener("change", closeAtDesktop);
    return () => desktopViewport.removeEventListener("change", closeAtDesktop);
  }, []);

  return (
    <div className="flex h-dvh bg-bg">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[60] -translate-y-20 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-bg shadow-lift transition-transform duration-fast ease-studio focus:translate-y-0 focus:outline-none"
      >
        Skip to content
      </a>

      <div className="hidden md:block">
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </div>

      <ModalSheet
        open={drawerOpen}
        side="left"
        title="Navigation"
        triggerRef={menuButtonRef}
        onClose={() => setDrawerOpen(false)}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </ModalSheet>

      <div
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none"
      >
        <header className="flex min-h-15 items-center gap-2 border-b border-hairline bg-surface/70 px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="modal-sheet-navigation"
            className="flex size-11 items-center justify-center rounded-xl text-ink-secondary transition-colors duration-fast hover:bg-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
          >
            <MenuIcon className="size-5" />
          </button>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-lg px-1 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <span className="text-[15px] font-semibold tracking-tight">
              Hindsight
            </span>
            <span className="size-1.5 rounded-full bg-accent" />
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
