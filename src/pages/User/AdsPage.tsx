import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MousePointerClick, Clock, CheckCircle, AlertCircle, Timer, X, RefreshCw, Package, Zap, Star, Crown, Gem, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  url: string;
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

// Color themes per plan index
const PLAN_THEMES = [
  {
    // Free — slate
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    light: "rgba(100,116,139,0.12)",
    border: "rgba(100,116,139,0.35)",
    text: "#94a3b8",
    bar: "#64748b",
    icon: Star,
    btnClass: "bg-slate-500 hover:bg-slate-600 text-white",
    badgeClass: "bg-slate-500/10 text-slate-500 border-slate-300",
  },
  {
    // Basic — blue
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    light: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.35)",
    text: "#60a5fa",
    bar: "#3b82f6",
    icon: Zap,
    btnClass: "bg-blue-500 hover:bg-blue-600 text-white",
    badgeClass: "bg-blue-500/10 text-blue-500 border-blue-300",
  },
  {
    // Silver/Standard — teal
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
    light: "rgba(20,184,166,0.12)",
    border: "rgba(20,184,166,0.35)",
    text: "#2dd4bf",
    bar: "#14b8a6",
    icon: Gem,
    btnClass: "bg-teal-500 hover:bg-teal-600 text-white",
    badgeClass: "bg-teal-500/10 text-teal-600 border-teal-300",
  },
  {
    // Gold/Premium — amber
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    light: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    text: "#fbbf24",
    bar: "#f59e0b",
    icon: Crown,
    btnClass: "bg-amber-500 hover:bg-amber-600 text-white",
    badgeClass: "bg-amber-500/10 text-amber-600 border-amber-300",
  },
  {
    // Diamond/VIP — purple
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    light: "rgba(139,92,246,0.12)",
    border: "rgba(139,92,246,0.35)",
    text: "#a78bfa",
    bar: "#8b5cf6",
    icon: Flame,
    btnClass: "bg-violet-500 hover:bg-violet-600 text-white",
    badgeClass: "bg-violet-500/10 text-violet-500 border-violet-300",
  },
];

const getTheme = (index: number) => PLAN_THEMES[Math.min(index, PLAN_THEMES.length - 1)];

const AdsPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [clicksByPlan, setClicksByPlan] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Timer modal
  const [timerAd, setTimerAd] = useState<Ad | null>(null);
  const [timerCommission, setTimerCommission] = useState(0);
  const [timerThemeIdx, setTimerThemeIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown
  const [resetCountdown, setResetCountdown] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setResetCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const ensureFreePlan = async (userId: string) => {
    const { data: freePlan } = await supabase.from("plans").select("id").ilike("name", "free").single();
    if (!freePlan) return;
    const { data: existing } = await supabase.from("user_plans").select("id")
      .eq("user_id", userId).eq("plan_id", freePlan.id).eq("is_active", true).maybeSingle();
    if (!existing) {
      await supabase.from("user_plans").insert({ user_id: userId, plan_id: freePlan.id, expires_at: null, is_active: true });
    }
  };

  const fetchData = async () => {
    if (!profile) return;
    const today = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();
    await ensureFreePlan(profile.id);

    const [adsRes, clicksRes, userPlansRes] = await Promise.all([
      supabase.from("ads").select("id, title, description, url, cpc_rate, view_duration, plan_id").eq("status", "active"),
      supabase.from("ad_clicks").select("ad_id, ad:ads(plan_id)").eq("user_id", profile.id).gte("clicked_at", today),
      supabase.from("user_plans")
        .select("plan_id, plan:plans(id, name, daily_clicks_limit, commission_per_click)")
        .eq("user_id", profile.id).eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);

    const clickRows = (clicksRes.data as { ad_id: string; ad: { plan_id: string | null } | null }[]) || [];
    const clickedAdIds = new Set(clickRows.map(c => c.ad_id));
    const perPlan = new Map<string, number>();
    clickRows.forEach(c => { const pid = c.ad?.plan_id; if (pid) perPlan.set(pid, (perPlan.get(pid) || 0) + 1); });

    setAds((adsRes.data || []).map(ad => ({ ...ad, clicked_today: clickedAdIds.has(ad.id) })));
    setUserPlans((userPlansRes.data as UserPlan[]) || []);
    setClicksByPlan(perPlan);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const adsByPlan = new Map<string, Ad[]>();
  ads.forEach(ad => {
    if (!ad.plan_id) return;
    if (!adsByPlan.has(ad.plan_id)) adsByPlan.set(ad.plan_id, []);
    adsByPlan.get(ad.plan_id)!.push(ad);
  });

  const startTimer = (ad: Ad, planLimit: number, planUsed: number, planCommission: number, themeIdx: number) => {
    if (planUsed >= planLimit) {
      toast({ title: "Kuota harian habis", description: "Klik Anda untuk paket ini sudah penuh hari ini.", variant: "destructive" });
      return;
    }
    if (ad.clicked_today) return;
    window.open(ad.url, "_blank");
    setTimerAd(ad); setTimerCommission(planCommission); setTimerThemeIdx(themeIdx);
    setTimerDone(false); setTimeLeft(ad.view_duration || 30);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); setTimerDone(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const closeTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerAd(null); setTimeLeft(0); setTimerDone(false); setCrediting(false);
  };

  const creditCommission = async () => {
    if (!profile || !timerAd || !timerDone) return;
    setCrediting(true);
    const { error } = await supabase.from("ad_clicks").insert({ user_id: profile.id, ad_id: timerAd.id, earned_amount: timerCommission });
    if (error) { toast({ title: "Gagal merekam klik", variant: "destructive" }); closeTimer(); return; }
    const newBal = (profile.balance || 0) + timerCommission;
    await Promise.all([
      supabase.from("profiles").update({ balance: newBal }).eq("id", profile.id),
      supabase.from("transactions").insert({ user_id: profile.id, type: "commission", amount: timerCommission, status: "success", notes: `Komisi klik iklan: ${timerAd.title}` }),
    ]);
    toast({ title: `+${formatIDR(timerCommission)} dikreditkan!` });
    closeTimer(); fetchData(); refreshProfile();
  };

  const totalDuration = timerAd?.view_duration || 30;
  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 100;
  const circumference = 2 * Math.PI * 44;
  const activePlans = userPlans.filter(up => up.plan);
  const timerTheme = getTheme(timerThemeIdx);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-20 bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-1.5">{[...Array(3)].map((_, j) => <div key={j} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Klik Iklan</h2>
          <p className="text-muted-foreground text-sm mt-0.5">Tonton iklan dan klaim komisi sesuai paket aktif Anda.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full shrink-0">
          <RefreshCw className="w-3 h-3 text-primary" />
          <span className="text-[11px] font-bold text-primary font-mono">{resetCountdown}</span>
        </div>
      </div>

      {/* No plans */}
      {activePlans.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center border border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">Belum ada paket aktif</p>
          <p className="text-muted-foreground text-sm mb-5">Beli paket untuk mulai melihat iklan dan mendapat komisi.</p>
          <Link to="/dashboard/plans"><Button>Lihat Paket</Button></Link>
        </div>
      ) : (
        <div className="space-y-5">
          {activePlans.map((up, idx) => {
            const plan = up.plan!;
            const theme = getTheme(idx);
            const ThemeIcon = theme.icon;
            const planAds = adsByPlan.get(plan.id) || [];
            const limit = plan.daily_clicks_limit;
            const used = clicksByPlan.get(plan.id) || 0;
            const remaining = Math.max(0, limit - used);
            const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

            return (
              <div key={plan.id}>
                {/* Plan banner card */}
                <div
                  className="rounded-2xl p-4 mb-3 relative overflow-hidden"
                  style={{ background: theme.gradient }}
                >
                  {/* Decorative circle */}
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
                  <div className="absolute -right-2 -bottom-8 w-16 h-16 rounded-full bg-white/5" />

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <ThemeIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-white/70 text-[11px] font-medium uppercase tracking-wide">Paket</p>
                        <h3 className="text-white text-base font-bold leading-tight">{plan.name}</h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/70 text-[11px]">Komisi/klik</p>
                      <p className="text-white font-bold text-sm">{formatIDR(plan.commission_per_click)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="relative mt-3">
                    <div className="flex justify-between text-[11px] text-white/70 mb-1">
                      <span>Progress klik hari ini</span>
                      <span className="font-bold text-white">{used}/{limit}</span>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {remaining === 0 && (
                      <p className="text-white/80 text-[10px] mt-1 text-center">Kuota hari ini sudah habis — reset {resetCountdown}</p>
                    )}
                  </div>
                </div>

                {/* Ads list */}
                {planAds.length === 0 ? (
                  <div className="rounded-xl p-5 text-center border border-dashed" style={{ borderColor: theme.border, background: theme.light }}>
                    <AlertCircle className="w-5 h-5 mx-auto mb-1.5" style={{ color: theme.text }} />
                    <p className="text-xs text-muted-foreground">Belum ada iklan untuk paket ini</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {planAds.map((ad, adIdx) => (
                      <div
                        key={ad.id}
                        className="bg-card rounded-xl border flex items-center gap-3 px-3.5 py-3 transition-all duration-150"
                        style={{
                          borderColor: ad.clicked_today ? undefined : theme.border,
                          opacity: ad.clicked_today ? 0.6 : 1,
                        }}
                      >
                        {/* Number badge */}
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                          style={{ background: theme.gradient }}
                        >
                          {adIdx + 1}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{ad.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-bold text-green-600">{formatIDR(plan.commission_per_click)}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Timer className="w-2.5 h-2.5" />{ad.view_duration || 30}s
                            </span>
                          </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0">
                          {ad.clicked_today ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
                              <CheckCircle className="w-3.5 h-3.5" /> Selesai
                            </span>
                          ) : remaining === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" /> Habis
                            </span>
                          ) : (
                            <button
                              onClick={() => startTimer(ad, limit, used, plan.commission_per_click, idx)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90 active:scale-95"
                              style={{ background: theme.gradient }}
                            >
                              <MousePointerClick className="w-3 h-3" /> Tonton
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Timer Modal */}
      {timerAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-sm overflow-hidden">
            {/* Colored top strip */}
            <div className="h-2 w-full" style={{ background: timerTheme.gradient }} />
            <div className="p-7 text-center relative">
              {!timerDone && (
                <button onClick={closeTimer} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              )}

              {!timerDone ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Tonton Iklan</p>
                  <h3 className="font-bold text-foreground text-sm mb-5 line-clamp-2">{timerAd.title}</h3>

                  {/* Circular timer */}
                  <div className="relative w-28 h-28 mx-auto mb-5">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                      <circle cx="50" cy="50" r="44" fill="none" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - (circumference * progress) / 100}
                        style={{ stroke: timerTheme.bar, transition: "stroke-dashoffset 1s linear" }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-foreground">{timeLeft}</span>
                      <span className="text-xs text-muted-foreground">detik</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">Iklan terbuka di tab baru. Tonton selama <strong>{timerAd.view_duration}s</strong>.</p>
                  <p className="text-xs text-amber-500 font-medium mt-1">Jangan tutup halaman ini</p>
                </>
              ) : (
                <>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: timerTheme.light }}
                  >
                    <CheckCircle className="w-8 h-8" style={{ color: timerTheme.bar }} />
                  </div>
                  <h3 className="font-bold text-foreground text-xl mb-1">Selesai!</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Anda mendapat komisi <span className="font-bold text-green-600 text-base">{formatIDR(timerCommission)}</span>
                  </p>
                  <button
                    onClick={creditCommission}
                    disabled={crediting}
                    className="w-full py-3 rounded-xl font-semibold text-white text-sm disabled:opacity-60 transition-opacity hover:opacity-90"
                    style={{ background: timerTheme.gradient }}
                  >
                    {crediting ? "Memproses..." : `Klaim +${formatIDR(timerCommission)}`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsPage;
