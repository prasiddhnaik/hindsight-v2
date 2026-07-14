"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

const BOTTOM_THRESHOLD = 96;

export interface ScrollMetrics {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export function isWithinBottomThreshold(
  { scrollTop, clientHeight, scrollHeight }: ScrollMetrics,
  threshold = BOTTOM_THRESHOLD,
) {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}

export function useStickToBottom(
  containerRef: RefObject<HTMLElement | null>,
  contentVersion: unknown,
) {
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setFollowing(
        isWithinBottomThreshold({
          scrollTop: container.scrollTop,
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
        }),
      );
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  useEffect(() => {
    if (!following) return;
    const container = containerRef.current;
    container?.scrollTo({ top: container.scrollHeight });
  }, [containerRef, contentVersion, following]);

  const jumpToLatest = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setFollowing(true);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [containerRef]);

  return { showJumpToLatest: !following, jumpToLatest };
}
