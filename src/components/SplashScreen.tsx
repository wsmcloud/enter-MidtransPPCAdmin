import React, { useEffect, useState } from "react";

const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    const hideTimer = setTimeout(() => setVisible(false), 3200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-700 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <img
        src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100054970/4c584179-30da-4a.png"
        alt="IklanCuan"
        crossOrigin="anonymous"
        style={{ maxWidth: "100%", maxHeight: "100vh", width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
};

export default SplashScreen;

