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
        // LIFF初期化に失敗してもページは利用可能にする（ブラウザ環境での通常ログイン用）
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  const login = () => {
    try {
      if (liff && typeof liff.isLoggedIn === "function" && !liff.isLoggedIn()) {
        liff.login();
      }
    } catch {
      // LIFF未初期化の場合は何もしない
    }
  };

  const logout = () => {
    try {
      if (liff && typeof liff.isLoggedIn === "function" && liff.isLoggedIn()) {
        liff.logout();
        window.location.reload();
      }
    } catch {
      // LIFF未初期化の場合は何もしない
    }
  };

  // liffオブジェクトが正しく初期化されているかをチェックするヘルパー
  const isInClient = (): boolean => {
    try {
      return liff && typeof liff.isInClient === "function" && liff.isInClient();
    } catch {
      return false;
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
    isInClient,
  };
}
