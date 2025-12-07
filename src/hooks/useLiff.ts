"use client";

import { useEffect, useState } from "react";
import { initializeLiff, isLoggedIn, getProfile, liff } from "@/lib/liff";

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export function useLiff() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLiffLoggedIn, setIsLiffLoggedIn] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeLiff();
        setIsInitialized(true);

        if (isLoggedIn()) {
          setIsLiffLoggedIn(true);
          const userProfile = await getProfile();
          if (userProfile) {
            setProfile(userProfile);
          }
        }
      } catch (err) {
        setError(err as Error);
      }
    };

    init();
  }, []);

  const login = () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const logout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  };

  return {
    isInitialized,
    isLiffLoggedIn,
    profile,
    error,
    login,
    logout,
    liff,
  };
}
