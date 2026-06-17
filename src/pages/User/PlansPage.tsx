import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  CheckCircle, Loader2, AlertCircle,
  CalendarDays, Sparkles, MousePointerClick, Zap, Star, Crown, Gem, Flame, Clock, CreditCard
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  daily_clicks_limit: number;
  commission_per_click: number;
  duration_days: number;
  description: string | null;
  is_active: boolean;
}

interface UserPlan {
  id: string;
  plan_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  plan: Plan;
}

const PLAN_THEMES = [
  {
    gradient: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
    light: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.25)",
    accent: "#64748b",
    icon: Star,
    label: "Pemula",
  },
  {
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    light: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.25)",
    accent: "#3b82f6",
    icon: Zap,
    label: "Populer",
  },
  {
    gradient: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
    light: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.25)",
    accent: "#14b8a6",
    icon: Gem,
    label: "Standar",
  },
  {
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    light: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    accent: "#f59e0b",
    icon: Crown,
    label: "Premium",
  },
  {
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    light: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.25)",
    accent: "#8b5cf6",
    icon: Flame,
    label: "VIP",
  },
];
const getTheme = (i: number) => PLAN_THEMES[Math.min(i, PLAN_THEMES.length - 1)];

const UserPlansPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [confirmIdx, setConfirmIdx] = useState(0);
  const snapScriptRef = useRef<HTMLScriptElement | null>(null);

  const ensureFreePlan = async (currentPlans: Plan[]) => {
    if (!profile) return false;
    const freePlan = currentPlans.find(p => p.name.toLowerCase() === "free");
    if (!freePlan) return false;
    const { data: existing } = await supabase
      .from("user_plans").select("id")
      .eq("user_id", profile.id).eq("plan_id", freePlan.id).eq("is_active", true).maybeSingle();
    if (existing) return false;
    await supabase.from("user_plans").insert({ user_id: profile.id, plan_id: freePlan.id, expires_at: null, is_active: true });
    return true;
  };

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, userPlansRes] = await Promise.all([
      supabase.from("plans").select("*").eq("is_active", true).order("price"),
      profile
        ? supabase.from("user_plans").select("*, plan:plans(*)")
            .eq("user_id", profile.id).eq("is_active", true)
            .order("purchased_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    const allPlans = plansRes.data || [];
    let myPlans = (userPlansRes.data as UserPlan[]) || [];

    const freePlan = allPlans.find(p => p.name.toLowerCase() === "free");
    if (freePlan && profile) {
      const hasFree = myPlans.some(up => up.plan_id === freePlan.id);
      if (!hasFree) {
        const inserted = await ensureFreePlan(allPlans);
        if (inserted) {
          const refetch = await supabase.from("user_plans").select("*, plan:plans(*)")
            .eq("user_id", profile.id).eq("is_active", true)
            .order("purchased_at", { ascending: false });
          myPlans = (refetch.data as UserPlan[]) || myPlans;
        }
      }
    }

    setPlans(allPlans);
    setUserPlans(myPlans);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const now = new Date();
  const activeUserPlans = userPlans.filter(up => up.is_active && (!up.expires_at || new Date(up.expires_at) > now));
  const totalDailyClicks = activeUserPlans.reduce((sum, up) => sum + (up.plan?.daily_clicks_limit || 0), 0);
  const maxCommission = Math.max(0, ...activeUserPlans.map(up => up.plan?.commission_per_click || 0));

  const openConfirm = (plan: Plan, idx: number) => { setConfirmPlan(plan); setConfirmIdx(idx); };

  const loadSnapScript = (clientKey: string, isProduction: boolean) => {
    if (snapScriptRef.current) snapScriptRef.current.remove();
    const script = document.createElement("script");
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    document.head.appendChild(script);
    snapScriptRef.current = script;
  };

  const handlePurchase = async () => {
    if (!confirmPlan || !profile) return;
    setPurchasing(true);

    try {
      // Free plan — activate directly
      if (confirmPlan.price === 0) {
        const expiresAt = confirmPlan.duration_days > 0
          ? new Date(Date.now() + confirmPlan.duration_days * 86400000).toISOString() : null;
        const { error: upErr } = await supabase.from("user_plans").insert({
          user_id: profile.id, plan_id: confirmPlan.id, expires_at: expiresAt, is_active: true,
        });
        if (upErr) throw upErr;
        await supabase.from("profiles").update({ plan_id: confirmPlan.id, plan_expires_at: expiresAt }).eq("id", profile.id);
        toast({ title: "Paket gratis berhasil diaktifkan!" });
        setConfirmPlan(null);
        await refreshProfile();
        fetchData();
        setPurchasing(false);
        return;
      }

      // Paid plan — use Midtrans
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("midtrans-plan-purchase", {
        body: { plan_id: confirmPlan.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || "Gagal membuat transaksi pembayaran");
      }

      const orderId = data.order_id;
      loadSnapScript(data.client_key, data.is_production);
      await new Promise(r => setTimeout(r, 1500));

      setConfirmPlan(null);

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: async () => {
            await new Promise(r => setTimeout(r, 2000));
            const { data: activateData, error: activateError } = await supabase.functions.invoke("activate-plan", {
              body: { order_id: orderId, plan_id: confirmPlan.id },
              headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (activateError || !activateData?.success) {
              toast({ title: "Pembayaran diterima", description: "Paket sedang diaktifkan, mohon tunggu sebentar.", variant: "default" });
            } else {
              toast({ title: `Paket ${confirmPlan.name} berhasil diaktifkan!`, description: "Selamat! Nikmati fitur paket Anda." });
            }
            await refreshProfile();
            fetchData();
          },
          onPending: () => {
            toast({ title: "Pembayaran pending", description: "Selesaikan pembayaran Anda. Paket akan aktif setelah dikonfirmasi." });
            fetchData();
          },
          onError: () => {
            toast({ title: "Pembayaran gagal", variant: "destructive" });
          },
          onClose: () => {
            toast({ title: "Pembayaran dibatalkan", description: "Silakan coba lagi jika ingin membeli paket." });
          },
        });
      } else {
        window.location.href = data.redirect_url;
      }
    } catch (err: unknown) {
      toast({ title: "Pembelian gagal", description: err instanceof Error ? err.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-muted rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const confirmTheme = getTheme(confirmIdx);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Paket Saya</h2>
        <p className="text-muted-foreground text-sm mt-1">Beli beberapa paket sekaligus — klik dan komisi dijumlahkan otomatis.</p>
      </div>

      {/* Summary */}
      <div className="rounded-2xl p-5 gradient-primary shadow-elevated text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute right-4 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Ringkasan Paket Aktif</span>
        </div>
        <div className="relative grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold">{activeUserPlans.length}</p>
            <p className="text-xs text-white/75 mt-0.5">Paket aktif</p>
          </div>
          <div className="text-center border-x border-white/20">
            <p className="text-2xl font-bold">{totalDailyClicks}</p>
            <p className="text-xs text-white/75 mt-0.5">Klik/hari</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{formatIDR(maxCommission)}</p>
            <p className="text-xs text-white/75 mt-0.5">Komisi maks</p>
          </div>
        </div>
      </div>

      {/* Active plan chips */}
      {activeUserPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2.5">Paket Aktif Anda</h3>
          <div className="flex flex-wrap gap-2">
            {activeUserPlans.map((up, idx) => {
              const theme = getTheme(plans.findIndex(p => p.id === up.plan_id));
              const daysLeft = getDaysRemaining(up.expires_at);
              return (
                <div key={up.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium"
                  style={{ background: theme.light, borderColor: theme.border, color: theme.accent }}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{up.plan?.name}</span>
                  {daysLeft !== null ? (
                    <span className="text-[10px] opacity-80 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{daysLeft}h
                    </span>
                  ) : (
                    <span className="text-[10px] opacity-70">∞</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plan cards grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Semua Paket</h3>
        {plans.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-border">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Belum ada paket tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {plans.map((plan, idx) => {
              const theme = getTheme(idx);
              const ThemeIcon = theme.icon;
              const isFree = plan.price === 0;
              const ownedCount = activeUserPlans.filter(up => up.plan_id === plan.id).length;
              const owned = ownedCount > 0;

              return (
                <div
                  key={plan.id}
                  className="bg-card rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated"
                  style={{ borderColor: owned ? theme.accent + "55" : undefined }}
                >
                  {/* Card header — colored */}
                  <div className="p-4 relative overflow-hidden" style={{ background: theme.gradient }}>
                    <div className="absolute -right-5 -top-5 w-20 h-20 rounded-full bg-white/10" />
                    <div className="absolute right-3 -bottom-6 w-14 h-14 rounded-full bg-white/5" />

                    <div className="relative flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                          <ThemeIcon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
                        </div>
                        <div>
                          <p className="text-white/70 text-[10px] font-medium uppercase tracking-wide">{theme.label}</p>
                          <p className="text-white font-bold text-base leading-tight">{plan.name}</p>
                        </div>
                      </div>
                      {owned && (
                        <div className="bg-white/20 rounded-full px-2 py-0.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-white" />
                          <span className="text-white text-[10px] font-semibold">Aktif</span>
                        </div>
                      )}
                    </div>

                    <div className="relative mt-3">
                      <p className="text-white/70 text-[11px]">Harga</p>
                      <p className="text-white font-bold text-xl leading-tight">
                        {isFree ? "Gratis" : formatIDR(plan.price)}
                      </p>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    {/* Features */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MousePointerClick className="w-3.5 h-3.5" />
                          <span>Klik per hari</span>
                        </div>
                        <span className="font-bold text-foreground">{plan.daily_clicks_limit}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Komisi per klik</span>
                        </div>
                        <span className="font-bold text-green-600">{formatIDR(plan.commission_per_click)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>Durasi aktif</span>
                        </div>
                        <span className="font-semibold text-foreground">
                          {plan.duration_days > 0 ? `${plan.duration_days} hari` : "Selamanya"}
                        </span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border" />

                    {/* Action button */}
                    <button
                      onClick={() => !owned && openConfirm(plan, idx)}
                      disabled={owned}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={owned
                        ? { background: theme.light, color: theme.accent, border: `1px solid ${theme.border}` }
                        : { background: theme.gradient, color: "white" }
                      }
                    >
                      {owned ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> Sudah Dimiliki
                        </span>
                      ) : isFree ? "Aktifkan Gratis" : `Beli — ${formatIDR(plan.price)}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={(o) => !o && setConfirmPlan(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
          {/* Colored top */}
          <div className="h-2" style={{ background: confirmTheme.gradient }} />
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle>Konfirmasi Pembelian</DialogTitle>
              <DialogDescription>
                Beli paket <strong>{confirmPlan?.name}</strong> seharga{" "}
                <strong style={{ color: confirmTheme.accent }}>
                  {confirmPlan?.price === 0 ? "Gratis" : formatIDR(confirmPlan?.price || 0)}
                </strong>?
              </DialogDescription>
            </DialogHeader>

            {confirmPlan && (
              <div className="rounded-xl p-3.5 space-y-2 text-xs mb-4"
                style={{ background: confirmTheme.light, border: `1px solid ${confirmTheme.border}` }}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Klik harian</span>
                  <span className="font-bold text-foreground">+{confirmPlan.daily_clicks_limit} klik/hari</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Komisi per klik</span>
                  <span className="font-bold text-green-600">{formatIDR(confirmPlan.commission_per_click)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Durasi aktif</span>
                  <span className="font-bold text-foreground">{confirmPlan.duration_days > 0 ? `${confirmPlan.duration_days} hari` : "Selamanya"}</span>
                </div>
                {confirmPlan.price > 0 && (
                  <div className="flex justify-between pt-2 border-t border-border mt-1">
                    <span className="text-muted-foreground font-semibold">Total bayar</span>
                    <span className="font-bold text-foreground" style={{ color: confirmTheme.accent }}>
                      {formatIDR(confirmPlan.price)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmPlan(null)} disabled={purchasing} className="flex-1">
                Batal
              </Button>
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-1.5"
                style={{ background: confirmTheme.gradient }}
              >
                {purchasing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Memproses...</>
                  : confirmPlan?.price === 0
                    ? "Aktifkan Gratis"
                    : <><CreditCard className="w-3.5 h-3.5" />Bayar {formatIDR(confirmPlan?.price || 0)}</>
                }
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserPlansPage;
