"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { WhatsNewModal } from "@/components/whatsNew/WhatsNewModal";
import { useAuth } from "@/context/AuthContext";
import {
  fetchLatestRelease,
  markReleaseSeen,
} from "@/lib/whatsNew/clientApi";
import type { AppRelease } from "@/lib/whatsNew/types";
import type { NotificationItem } from "@/lib/events/types";

type WhatsNewContextValue = {
  latestRelease: AppRelease | null;
  releaseNotification: NotificationItem | null;
  dismissReleaseNotification: () => void;
};

const WhatsNewContext = createContext<WhatsNewContextValue | null>(null);

export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [latestRelease, setLatestRelease] = useState<AppRelease | null>(null);
  const [seen, setSeen] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    async function loadLatest() {
      try {
        const result = await fetchLatestRelease();

        if (cancelled) {
          return;
        }

        setLatestRelease(result.release);
        setSeen(result.seen);

        if (result.release && !result.seen) {
          setShowModal(true);
        }
      } catch {
        // Non-blocking — release notes are optional on load failure
      }
    }

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  const handleContinue = useCallback(async () => {
    if (latestRelease) {
      try {
        await markReleaseSeen(latestRelease.id);
      } catch {
        // Still close modal if persistence fails
      }
    }

    setShowModal(false);
    setSeen(true);
  }, [latestRelease]);

  const releaseNotification = useMemo<NotificationItem | null>(() => {
    if (!latestRelease || seen || showModal) {
      return null;
    }

    return {
      id: `release-${latestRelease.id}`,
      title: "🎉 Buxme has been updated",
      subtitle: `Version ${latestRelease.version} · ${latestRelease.title}`,
      icon: "🎉",
      tone: "accent",
      timestamp: latestRelease.publishedAt ?? latestRelease.createdAt,
      read: false,
      detailHref: "/whats-new",
    };
  }, [latestRelease, seen, showModal]);

  const value = useMemo<WhatsNewContextValue>(
    () => ({
      latestRelease,
      releaseNotification,
      dismissReleaseNotification: () => setSeen(true),
    }),
    [latestRelease, releaseNotification],
  );

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      {latestRelease ? (
        <WhatsNewModal
          release={latestRelease}
          isOpen={showModal}
          onContinue={() => void handleContinue()}
        />
      ) : null}
    </WhatsNewContext.Provider>
  );
}

export function useWhatsNew(): WhatsNewContextValue {
  const context = useContext(WhatsNewContext);

  if (!context) {
    throw new Error("useWhatsNew must be used within WhatsNewProvider");
  }

  return context;
}

export function useWhatsNewOptional(): WhatsNewContextValue | null {
  return useContext(WhatsNewContext);
}
