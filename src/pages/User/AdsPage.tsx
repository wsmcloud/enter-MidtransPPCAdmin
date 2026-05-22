import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MousePointerClick, ExternalLink, Clock, CheckCircle, AlertCircle, Timer, X, RefreshCw, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  cpc_rate: number;
  view_duration: number;
  plan_id: string | null;
  clicked_today?: boolean;
}

interface UserPlan {
  plan_id: string;
  plan: {
    id: string;
    name: string;
    daily_clicks_limit: number;
    commission_per_click: number;
  } | null;
}

const AdsPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [clicksByPlan, setClicksByPlan] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Timer modal state
  const [timerAd, setTimerAd] = useState<Ad | null>(null);
  const [timerCommission, setTimerCommission] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown
  const [resetCountdown, setResetCountdown] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setResetCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    if (!profile) return;
    const today = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();

    const [adsRes, clicksRes, userPlansRes] = await Promise.all([
      supabase.from("ads").select("*").eq("status", "active"),
      supabase
        .from("ad_clicks")
        .select("ad_id, ad:ads(plan_id)")
        .eq("user_id", profile.id)
        .gte("clicked_at", today),
      supabase
        .from("user_plans")
        .select("plan_id, plan:plans(id, name, daily_clicks_limit, commission_per_click)")
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);

    const clickRows = (clicksRes.data as { ad_id: string; ad: { plan_id: string | null } | null }[]) || [];
    const clickedAdIds = new Set(clickRows.map(c => c.ad_id));

    // Build per-plan click counter
    const perPlan = new Map<string, number>();
    clickRows.forEach(c => {
      const pid = c.ad?.plan_id;
      if (pid) perPlan.set(pid, (perPlan.get(pid) || 0) + 1);
    });

    const adsWithStatus = (adsRes.data || []).map(ad => ({
      ...ad,
      clicked_today: clickedAdIds.has(ad.id),
    }));

    setAds(adsWithStatus);
    setUserPlans((userPlansRes.data as UserPlan[]) || []);
    setClicksByPlan(perPlan);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Group ads by plan_id
  const adsByPlan = new Map<string, Ad[]>();
  ads.forEach(ad => {
    if (!ad.plan_id) return;
    if (!adsByPlan.has(ad.plan_id)) adsByPlan.set(ad.plan_id, []);
    adsByPlan.get(ad.plan_id)!.push(ad);
  });

  const startTimer = (ad: Ad, planLimit: number, planUsed: number, planCommission: number) => {
    if (planUsed >= planLimit) {
      toast({ title: "Batas paket tercapai", description: "Kuota klik harian paket ini sudah habis.", variant: "destructive" });
      return;
    }
    if (ad.clicked_today) return;

    window.open(ad.url, "_blank");
    setTimerAd(ad);
    setTimerCommission(planCommission);
    setTimerDone(false);
    setTimeLeft(ad.view_duration || 30);

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

    const earn = timerCommission;
    const { error } = await supabase.from("ad_clicks").insert({
      user_id: profile.id, ad_id: timerAd.id, earned_amount: earn,
    });
    if (error) {
      toast({ title: "Gagal merekam klik", variant: "destructive" });
      closeTimer();
      return;
    }

    const newBal = (profile.balance || 0) + earn;
    await Promise.all([
      supabase.from("profiles").update({ balance: newBal }).eq("id", profile.id),
      supabase.from("transactions").insert({
        user_id: profile.id, type: "commission", amount: earn, status: "success",
        notes: `Komisi klik iklan: ${timerAd.title}`,
      }),
    ]);

    toast({ title: `+${formatIDR(earn)} dikreditkan!` });
    closeTimer();
    fetchData();
    refreshProfile();
  };

  const totalDuration = timerAd?.view_duration || 30;
  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 100;
  const circumference = 2 * Math.PI * 44;

  if (loading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}</div>;
  }

  // Only owned active plans
  const activePlans = userPlans.filter(up => up.plan);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Klik Iklan</h2>
        <p className="text-muted-foreground text-sm mt-1">Iklan ditampilkan sesuai paket aktif Anda.</p>
      </div>

      {/* Reset countdown bar */}
      <div className="bg-card rounded-2xl p-4 border border-border shadow-card flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {activePlans.length} paket aktif
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-full">
          <RefreshCw className="w-3 h-3 text-primary" />
          <span className="text-[11px] font-medium text-primary">Reset dalam</span>
          <span className="text-[11px] font-bold text-primary font-mono">{resetCountdown}</span>
        </div>
      </div>

      {/* No active plans */}
      {activePlans.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center border border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">Belum ada paket aktif</p>
          <p className="text-muted-foreground text-sm mb-4">Beli paket untuk mulai melihat iklan dan dapat komisi.</p>
          <Link to="/dashboard/plans">
            <Button size="sm">Lihat Paket</Button>
          </Link>
        </div>
      ) : (
        activePlans.map(up => {
          const plan = up.plan!;
          const planAds = adsByPlan.get(plan.id) || [];
          const limit = plan.daily_clicks_limit;
          const used = clicksByPlan.get(plan.id) || 0;
          const remaining = Math.max(0, limit - used);

          return (
            <div key={plan.id} className="space-y-3">
              {/* Plan header */}
              <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">
                      Paket <span className="text-primary">{plan.name}</span>
                    </h3>
                    <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px]">
                      {formatIDR(plan.commission_per_click)}/klik
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold text-foreground">{used} / {limit} klik</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-2.5">
                  <div className="h-full gradient-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
                </div>
              </div>

              {/* Ads grid */}
              {planAds.length === 0 ? (
                <div className="bg-muted/30 rounded-xl p-6 text-center border border-dashed border-border">
                  <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Belum ada iklan untuk paket ini</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {planAds.map(ad => (
                    <div key={ad.id} className={`bg-card rounded-xl border shadow-card overflow-hidden transition-all duration-200 ${
                      ad.clicked_today ? "opacity-60 border-border" :
                      "border-border hover:shadow-elevated hover:-translate-y-0.5"
                    }`}>
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
                          <p className="text-sm font-bold text-green-600">{formatIDR(plan.commission_per_click)}</p>
                          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Timer className="w-2.5 h-2.5" />{ad.view_duration || 30}s
                          </div>
                        </div>

                        {ad.clicked_today ? (
                          <Badge className="w-full justify-center bg-green-500/10 text-green-600 border-green-200 text-[10px] h-6">
                            <CheckCircle className="w-2.5 h-2.5 mr-1" /> Sudah Diklik
                          </Badge>
                        ) : remaining === 0 ? (
                          <Badge variant="outline" className="w-full justify-center text-muted-foreground text-[10px] h-6">
                            <Clock className="w-2.5 h-2.5 mr-1" /> Kuota habis
                          </Badge>
                        ) : (
                          <Button className="w-full h-7 text-[11px] px-2" size="sm"
                            onClick={() => startTimer(ad, limit, used, plan.commission_per_click)}>
                            Tonton & Dapat
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Timer Modal */}
      {timerAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-sm p-7 text-center relative">
            {!timerDone && (
              <button onClick={closeTimer} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground" title="Tutup (komisi tidak akan diberikan)">
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
                <div className="relative w-28 h-28 mx-auto mb-5">
                  <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (circumference * progress) / 100}
                      className="transition-all duration-1000 ease-linear" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{timeLeft}</span>
                    <span className="text-xs text-muted-foreground">detik</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  Iklan terbuka di tab baru. Tonton selama <strong>{timerAd.view_duration}s</strong>.
                </p>
                <p className="text-xs text-amber-600 font-medium">Jangan tutup halaman ini</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">Selesai!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Anda akan mendapatkan <span className="font-bold text-green-600">{formatIDR(timerCommission)}</span>
                </p>
                <Button className="w-full bg-green-500 hover:bg-green-600" onClick={creditCommission} disabled={crediting}>
                  {crediting ? "Memproses..." : `Klaim +${formatIDR(timerCommission)}`}
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
