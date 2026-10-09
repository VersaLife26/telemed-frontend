"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

/**
 * Compact status cards in the top-right. They follow the console theme for the
 * icon colour, and leave on their own after four seconds.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      duration={4000}
      closeButton
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
