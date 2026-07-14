"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ModalSheetProps {
  open: boolean;
  side: "left" | "right";
  title: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose(): void;
  children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ModalSheet({
  open,
  side,
  title,
  triggerRef,
  onClose,
  children,
}: ModalSheetProps) {
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const panelId = `modal-sheet-${title
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!open || !portalHost) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusableElements = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );

    (focusableElements()[0] ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || activeElement === panel)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first?.focus();
      } else if (!panel?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [open, portalHost, triggerRef]);

  if (!open || !portalHost) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={`Close ${title.toLocaleLowerCase()} panel`}
        className="modal-sheet-scrim absolute inset-0 size-full cursor-default bg-scrim"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-side={side}
        className={`modal-sheet-panel absolute inset-y-0 flex max-w-[min(22rem,calc(100vw-3rem))] flex-col overflow-y-auto bg-surface shadow-sheet outline-none ${
          side === "left" ? "left-0" : "right-0"
        }`}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    portalHost,
  );
}
