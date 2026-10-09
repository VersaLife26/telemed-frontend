"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/**
 * Status cards under the console header, top-right. They use admin surface
 * colours and dismiss after four seconds.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      duration={4000}
      closeButton
      expand={false}
      visibleToasts={3}
      offset={16}
      gap={10}
      className="vl-toaster"
      toastOptions={{
        classNames: {
          toast: "vl-toast",
          title: "vl-toast-title",
          description: "vl-toast-desc",
          closeButton: "vl-toast-close",
          success: "vl-toast-success",
          error: "vl-toast-error",
          warning: "vl-toast-warning",
          info: "vl-toast-info",
        },
      }}
    />
  );
}
