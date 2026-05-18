import React, { useEffect, useState } from "react";

const SplashScreen: React.FC = () => {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
    const hideTimer = setTimeout(() => setVisible(false), 2800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white transition-opacity duration-700 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <img
        src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100054970/5900b682-fa25-45.png"
        alt="iklancuan.com"
        crossOrigin="anonymous"
        className="absolute inset-0 w-full h-full object-cover animate-splash-zoom"
      />

      {/* Loading indicator at bottom */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>

      <style>{`
        @keyframes splash-zoom {
          0% { transform: scale(1.05); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-splash-zoom {
          animation: splash-zoom 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
