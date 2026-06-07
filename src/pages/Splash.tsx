import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const Splash: React.FC = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    const showTimer = setTimeout(() => setVisible(true), 50);

    // Check if already logged in, redirect accordingly after 3s
    const redirectTimer = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.session.user.id)
          .maybeSingle();
        navigate(profile?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }, 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  const handleSkip = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      navigate(profile?.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center z-50"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-in",
      }}
    >
      <div className="w-full max-w-md h-full relative overflow-hidden">
        {/* Full screen splash image */}
        <img
          src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100054970/3282903e-80f8-48.png"
          alt="IklanCuan - Klik Iklan Dapat Uang"
          crossOrigin="anonymous"
          className="w-full h-full object-cover object-top"
        />

        {/* Bottom overlay with CTA */}
        <div
          className="absolute bottom-0 left-0 right-0 p-6"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
          }}
        >
          <button
            onClick={handleSkip}
            className="w-full py-3.5 rounded-xl font-bold text-base"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "#ffffff",
              boxShadow: "0 4px 20px rgba(245,158,11,0.5)",
            }}
          >
            Mulai Sekarang
          </button>
          <p className="text-center text-white/50 text-xs mt-3">
            Otomatis masuk dalam 3 detik...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
