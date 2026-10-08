"use client";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export type BackendHealth = "checking" | "ok" | "waking" | "offline";

const POLL_MS = 20_000;

/**
 * How many failed checks to attribute to a cold start before calling the
 * backend offline. Cloud Run scales to zero when idle, so three checks twenty
 * seconds apart covers an instance that is genuinely waking.
 */
const COLD_START_ATTEMPTS = 3;

/**
 * Polls the API's `/health` and reports what it found.
 *
 * The hero badge used to read "live · GCP Cloud Run + Neon · RAGTruth-labeled"
 * unconditionally -- it was markup, not a status, so it stayed green after the
 * Google Cloud free trial behind this backend closed. This asks before saying.
 *
 * Driven by the live check rather than hardcoded, so the page corrects itself
 * if the backend is ever restored.
 */
export function useBackendHealth(): BackendHealth {
  const [health, setHealth] = useState<BackendHealth>("checking");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const onFailure = () => {
      failures += 1;
      if (failures < COLD_START_ATTEMPTS) {
        setHealth("waking");
        timer = setTimeout(check, POLL_MS);
        return;
      }
      // Settle, and stop asking. A backend whose billing account is closed
      // will not answer the fourth time either.
      setHealth("offline");
    };

    function check() {
      getHealth()
        .then(() => {
          if (cancelled) return;
          failures = 0;
          setHealth("ok");
        })
        .catch(() => {
          if (cancelled) return;
          onFailure();
        });
    }

    check();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return health;
}
