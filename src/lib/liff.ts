import liff from "@line/liff";

export const initializeLiff = async (): Promise<void> => {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  if (!liffId) {
    console.error("LIFF ID is not defined");
    return;
  }

  try {
    await liff.init({ liffId });
    console.log("LIFF initialized successfully");
  } catch (error) {
    console.error("LIFF initialization failed:", error);
    throw error;
  }
};

export const isInLiff = (): boolean => {
  return liff.isInClient();
};

export const isLoggedIn = (): boolean => {
  return liff.isLoggedIn();
};

export const login = (): void => {
  if (!liff.isLoggedIn()) {
    liff.login();
  }
};

export const logout = (): void => {
  if (liff.isLoggedIn()) {
    liff.logout();
    window.location.reload();
  }
};

export const getProfile = async () => {
  if (!liff.isLoggedIn()) {
    return null;
  }
  return await liff.getProfile();
};

export const getAccessToken = (): string | null => {
  return liff.getAccessToken();
};

export { liff };
