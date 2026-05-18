import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MousePointerClick, ExternalLink, Clock, CheckCircle, AlertCircle, Timer, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  cpc_rate: number;
  view_duration: number;
  clicked_today?: boolean;
}

interface Plan {
  daily_clicks_limit: number;
  commission_per_click: number;
}

const AdsPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [todayClicks, setTodayClicks] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reset countdown (resets at next midnight)
  const [resetCountdown, setResetCountdown] = useState("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setResetCountdown(`${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer modal state
  const [timerAd, setTimerAd] = useState<Ad | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!profile) return;
    const today = new Date().toISOString().split("T")[0];

    const [adsRes, clicksRes, planRes] = await Promise.all([
      supabase.from("ads").select("*").eq("status", "active"),
      supabase.from("ad_clicks").select("ad_id").eq("user_id", profile.id).gte("clicked_at", today),
      profile.plan_id
        ? supabase.from("plans").select("daily_clicks_limit, commission_per_click").eq("id", profile.plan_id).maybeSingle()
        : supabase.from("plans").select("daily_clicks_limit, commission_per_click").eq("name", "Free").maybeSingle(),
    ]);

    const clickedAdIds = new Set(clicksRes.data?.map(c => c.ad_id) || []);
    const adsWithStatus = (adsRes.data || []).map(ad => ({
      ...ad,
      clicked_today: clickedAdIds.has(ad.id),
    }));

    setAds(adsWithStatus);
    setPlan(planRes.data || { daily_clicks_limit: 5, commission_per_click: 200 });
    setTodayClicks(clicksRes.data?.length || 0);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = (ad: Ad) => {
    const limit = plan?.daily_clicks_limit || 5;
    if (todayClicks >= limit) {
      toast({ title: "Batas klik tercapai", description: `Anda sudah mencapai batas ${limit} klik hari ini.`, variant: "destructive" });
      return;
    }
    if (ad.clicked_today) return;

    // Open ad URL in new tab
    window.open(ad.url, "_blank");

    // Setup timer modal
    setTimerAd(ad);
    setTimerDone(false);
    setTimeLeft(ad.view_duration || 30);

    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimerDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closeTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerAd(null);
    setTimeLeft(0);
    setTimerDone(false);
    setCrediting(false);
  };

  const creditCommission = async () => {
    if (!profile || !timerAd || !timerDone) return;
    setCrediting(true);

    const earnAmount = plan?.commission_per_click || 200;

    const { error: clickError } = await supabase.from("ad_clicks").insert({
      user_id: profile.id,
      ad_id: timerAd.id,
      earned_amount: earnAmount,
    });

    if (clickError) {
      toast({ title: "Gagal merekam klik", variant: "destructive" });
      closeTimer();
      return;
    }

    const newBalance = (profile.balance || 0) + earnAmount;
    await Promise.all([
      supabase.from("profiles").update({ balance: newBalance }).eq("id", profile.id),
      supabase.from("transactions").insert({
        user_id: profile.id,
        type: "commission",
        amount: earnAmount,
        status: "success",
        notes: `Komisi klik iklan: ${timerAd.title}`,
      }),
    ]);

    toast({ title: `+${formatIDR(earnAmount)} dikreditkan!`, description: "Komisi berhasil ditambahkan ke saldo." });
    closeTimer();
    fetchData();
    refreshProfile();
  };

  const limit = plan?.daily_clicks_limit || 5;
  const remaining = Math.max(0, limit - todayClicks);
  const totalDuration = timerAd?.view_duration || 30;
  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 100;
  const circumference = 2 * Math.PI * 44; // r=44

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-56 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Klik Iklan</h2>
        <p className="text-muted-foreground text-sm mt-1">Tonton iklan sesuai durasi untuk mendapatkan komisi. 1 iklan per hari.</p>
      </div>

      {/* Status Bar */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Progress Klik Hari Ini</span>
          </div>
          <span className="text-sm font-bold text-foreground">{todayClicks} / {limit}</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full gradient-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (todayClicks / limit) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {remaining > 0 ? `Sisa ${remaining} klik hari ini` : "Batas klik hari ini sudah terpenuhi"}
          </p>
          <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
            <RefreshCw className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-medium text-primary">Reset dalam</span>
            <span className="text-[11px] font-bold text-primary font-mono">{resetCountdown}</span>
          </div>
        </div>
      </div>

      {/* Ads Grid */}
      {ads.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center border border-border">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Belum ada iklan aktif saat ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {ads.map(ad => (
            <div key={ad.id} className={`bg-card rounded-xl border shadow-card overflow-hidden transition-all duration-200 ${ad.clicked_today ? "opacity-60 border-border" : "border-border hover:shadow-elevated hover:-translate-y-0.5"}`}>
              {ad.image_url ? (
                <div className="h-20 bg-muted overflow-hidden">
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-20 gradient-primary flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-white/60" />
                </div>
              )}
              <div className="p-2.5">
                <h3 className="font-semibold text-foreground text-xs mb-1 line-clamp-1">{ad.title}</h3>

                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-green-600">{formatIDR(plan?.commission_per_click || 200)}</p>
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Timer className="w-2.5 h-2.5" />
                    {ad.view_duration || 30}s
                  </div>
                </div>

                {ad.clicked_today ? (
                  <Badge className="w-full justify-center bg-green-500/10 text-green-600 border-green-200 text-[10px] h-6">
                    <CheckCircle className="w-2.5 h-2.5 mr-1" /> Sudah Diklik
                  </Badge>
                ) : remaining === 0 ? (
                  <Badge variant="outline" className="w-full justify-center text-muted-foreground text-[10px] h-6">
                    <Clock className="w-2.5 h-2.5 mr-1" /> Besok
                  </Badge>
                ) : (
                  <Button
                    className="w-full h-7 text-[11px] px-2"
                    size="sm"
                    onClick={() => startTimer(ad)}
                  >
                    Tonton & Dapat
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timer Modal Overlay */}
      {timerAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-sm p-7 text-center relative">
            {/* Close (only allowed if not done and after warning) */}
            {!timerDone && (
              <button
                onClick={closeTimer}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                title="Tutup (komisi tidak akan diberikan)"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {!timerDone ? (
              <>
                <div className="flex items-center gap-2 justify-center mb-2">
                  <Timer className="w-4 h-4 text-primary" />
                  <p className="text-sm text-muted-foreground font-medium">Tonton Iklan</p>
                </div>
                <h3 className="font-bold text-foreground text-base mb-5 line-clamp-2">{timerAd.title}</h3>

                {/* Circular Timer */}
                <div className="relative w-28 h-28 mx-auto mb-5">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="44" fill="none"
                      stroke="hsl(var(--primary))" strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (circumference * progress) / 100}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{timeLeft}</span>
                    <span className="text-xs text-muted-foreground">detik</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mb-1">
                  Iklan sudah terbuka di tab baru. Tonton selama <strong>{timerAd.view_duration}s</strong>.
                </p>
                <p className="text-xs text-amber-600 font-medium">
                  Jangan tutup halaman ini — timer akan berjalan otomatis
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">Selesai!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Anda akan mendapatkan <span className="font-bold text-green-600">{formatIDR(plan?.commission_per_click || 200)}</span>
                </p>
                <Button
                  className="w-full bg-green-500 hover:bg-green-600"
                  onClick={creditCommission}
                  disabled={crediting}
                >
                  {crediting ? "Memproses..." : `Klaim +${formatIDR(plan?.commission_per_click || 200)}`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsPage;
