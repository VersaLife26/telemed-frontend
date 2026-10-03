"use client";

import { useEffect, useState } from "react";

import { browserApi } from "@/lib/consumer/api/client";

export function useRegistrationContext() {
  const [state, setState] = useState({ ready: false, askCitizenship: false });

  useEffect(() => {
    let cancelled = false;
    browserApi<{ askCitizenship?: boolean }>("/auth/registration-context")
      .then((ctx) => {
        if (!cancelled) setState({ ready: true, askCitizenship: ctx.askCitizenship === true });
      })
      .catch(() => {
        if (!cancelled) setState({ ready: true, askCitizenship: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
