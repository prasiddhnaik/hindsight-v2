import { expect, spyOn, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";

import { useNetworkStatus } from "~/app/_components/use-network-status";

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

test("useNetworkStatus follows browser online and offline events", () => {
  setNavigatorOnline(false);
  const { result } = renderHook(() => useNetworkStatus());
  expect(result.current).toBe(false);

  setNavigatorOnline(true);
  act(() => window.dispatchEvent(new Event("online")));
  expect(result.current).toBe(true);

  setNavigatorOnline(false);
  act(() => window.dispatchEvent(new Event("offline")));
  expect(result.current).toBe(false);
});

test("useNetworkStatus removes both browser listeners on unmount", () => {
  const addSpy = spyOn(window, "addEventListener");
  const removeSpy = spyOn(window, "removeEventListener");
  const { unmount } = renderHook(() => useNetworkStatus());

  const onlineListener = addSpy.mock.calls.find(([type]) => type === "online")?.[1];
  const offlineListener = addSpy.mock.calls.find(([type]) => type === "offline")?.[1];
  unmount();

  expect(removeSpy).toHaveBeenCalledWith("online", onlineListener);
  expect(removeSpy).toHaveBeenCalledWith("offline", offlineListener);
  addSpy.mockRestore();
  removeSpy.mockRestore();
});
