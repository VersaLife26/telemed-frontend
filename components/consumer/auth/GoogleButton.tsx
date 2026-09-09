"use client";

import { useEffect, useRef, useState } from "react";

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string;
        callback: (resp: { credential: string }) => void;
        ux_mode?: string;
      }) => void;
      renderButton: (
        el: HTMLElement,
        opts: { theme: string; size: string; text: string; shape: string; width: number },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(script);
  });
  return gisPromise;
}

export function GoogleButton({
  onCredential,
  disabled,
}: {
  onCredential: (idToken: string) => Promise<void>;
  disabled?: boolean;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/google/config", { cache: "no-store" });
        const json = (await res.json()) as { data?: { enabled?: boolean; client_id?: string | null } };
        const clientId = json.data?.client_id;
        if (!json.data?.enabled || !clientId || cancelled) return;
        await loadGis();
        if (cancelled || !slot.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            void onCredentialRef.current(resp.credential);
          },
        });
        slot.current.innerHTML = "";
        window.google.accounts.id.renderButton(slot.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 336,
        });
        setVisible(true);
      } catch {
        if (!cancelled) setLoadError("Google sign-in could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    return <p className="text-center text-body-sm text-danger">{loadError}</p>;
  }
  return (
    <div
      ref={slot}
      className={`flex w-full justify-center ${visible ? "" : "hidden"} ${disabled ? "pointer-events-none opacity-50" : ""}`}
    />
  );
}

export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-body-sm text-text-muted">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
