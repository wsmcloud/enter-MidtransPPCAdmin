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
      className={`fixed inset-0 z-[9999] bg-black transition-opacity duration-700 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="w-full h-full max-w-md mx-auto relative">
        <img
          src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100054970/3282903e-80f8-48.png"
          alt="IklanCuan"
          crossOrigin="anonymous"
          className="w-full h-full object-cover object-top"
        />
      </div>

      <style>{`
        @keyframes splash-fade-in {
          0% { opacity: 0; transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        .splash-img {
          animation: splash-fade-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
