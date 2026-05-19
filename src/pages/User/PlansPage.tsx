import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Package, CheckCircle, Zap, MousePointerClick,
  ArrowDownToLine, Crown, Star, Loader2, AlertCircle, CalendarDays, Plus, Sparkles
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

const UserPlansPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [plansRes, userPlansRes] = await Promise.all([
      supabase.from("plans").select("*").eq("is_active", true).order("price"),
      profile
        ? supabase
            .from("user_plans")
            .select("*, plan:plans(*)")
            .eq("user_id", profile.id)
            .eq("is_active", true)
            .order("purchased_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    setPlans(plansRes.data || []);
    setUserPlans((userPlansRes.data as UserPlan[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  // Filter active (non-expired) user plans
  const now = new Date();
  const activeUserPlans = userPlans.filter(up =>
    up.is_active && (!up.expires_at || new Date(up.expires_at) > now)
  );

  // Total daily clicks and commission from all active plans
  const totalDailyClicks = activeUserPlans.reduce((sum, up) => sum + (up.plan?.daily_clicks_limit || 0), 0);
  const maxCommission = Math.max(0, ...activeUserPlans.map(up => up.plan?.commission_per_click || 0));

  const handlePurchase = async () => {
    if (!confirmPlan || !profile) return;
    setPurchasing(true);

    try {
      // Check balance
      if (confirmPlan.price > 0 && (profile.balance || 0) < confirmPlan.price) {
        toast({
          title: "Saldo tidak cukup",
          description: "Silakan top up terlebih dahulu.",
          variant: "destructive",
        });
        setConfirmPlan(null);
        setPurchasing(false);
        navigate("/dashboard/deposit");
        return;
      }

      const expiresAt = confirmPlan.duration_days > 0
        ? new Date(Date.now() + confirmPlan.duration_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // 1. Insert into user_plans (additive, doesn't replace others)
      const { error: upErr } = await supabase.from("user_plans").insert({
        user_id: profile.id,
        plan_id: confirmPlan.id,
        expires_at: expiresAt,
        is_active: true,
      });
      if (upErr) throw upErr;

      // 2. Deduct balance + update profile.plan_id to highest tier (latest purchase)
      if (confirmPlan.price > 0) {
        const newBalance = (profile.balance || 0) - confirmPlan.price;
        await supabase
          .from("profiles")
          .update({ balance: newBalance, plan_id: confirmPlan.id, plan_expires_at: expiresAt })
          .eq("id", profile.id);

        // 3. Transaction record
        await supabase.from("transactions").insert({
          user_id: profile.id,
          type: "plan_purchase",
          amount: confirmPlan.price,
          status: "success",
          notes: `Pembelian paket ${confirmPlan.name}${confirmPlan.duration_days > 0 ? ` (${confirmPlan.duration_days} hari)` : ""}`,
        });
      }

      toast({
        title: "Paket berhasil dibeli!",
        description: `Paket ${confirmPlan.name} sudah aktif dan ditambahkan ke akun Anda.`,
      });
      setConfirmPlan(null);
      await refreshProfile();
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast({ title: "Pembelian gagal", description: message, variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  const getPlanIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("free")) return Star;
    if (lower.includes("premium") || lower.includes("vip")) return Crown;
    return Zap;
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Paket Saya</h2>
        <p className="text-muted-foreground text-sm mt-1">Beli paket sebanyak yang Anda mau — klik dan komisi akan dijumlahkan.</p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl p-5 gradient-primary shadow-elevated text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Total Paket Aktif</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-2xl font-bold">{activeUserPlans.length}</p>
            <p className="text-xs text-white/80">Paket aktif</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{totalDailyClicks}</p>
            <p className="text-xs text-white/80">Klik/hari (total)</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatIDR(maxCommission)}</p>
            <p className="text-xs text-white/80">Komisi tertinggi</p>
          </div>
        </div>
      </div>

      {/* Active plans list */}
      {activeUserPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Paket Aktif Anda ({activeUserPlans.length})</h3>
          <div className="space-y-2">
            {activeUserPlans.map(up => {
              const daysLeft = getDaysRemaining(up.expires_at);
              return (
                <div key={up.id} className="bg-card rounded-xl p-3.5 border border-green-200 dark:border-green-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground text-sm truncate">{up.plan?.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {up.plan?.daily_clicks_limit} klik/hari · {formatIDR(up.plan?.commission_per_click || 0)}/klik
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {up.expires_at ? (
                      <Badge variant={daysLeft && daysLeft <= 3 ? "destructive" : "outline"} className="text-[10px] gap-1">
                        <CalendarDays className="w-2.5 h-2.5" />
                        {daysLeft} hari lagi
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-200">
                        Selamanya
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available plans to purchase */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Beli Paket Tambahan</h3>
        {plans.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-border">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Belum ada paket tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map(plan => {
              const Icon = getPlanIcon(plan.name);
              const isFree = plan.price === 0;
              const ownedCount = activeUserPlans.filter(up => up.plan_id === plan.id).length;

              return (
                <div
                  key={plan.id}
                  className="relative bg-card rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-all hover:-translate-y-0.5"
                >
                  {ownedCount > 0 && (
                    <Badge className="absolute top-3 right-3 bg-green-500/10 text-green-600 border-green-200 text-[10px]">
                      {ownedCount}x dimiliki
                    </Badge>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground">{plan.name}</h4>
                      <p className="text-lg font-bold text-foreground">
                        {isFree ? <span className="text-green-500">Gratis</span> : formatIDR(plan.price)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4 text-xs">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MousePointerClick className="w-3.5 h-3.5 text-primary" />
                      <span><strong>{plan.daily_clicks_limit}</strong> klik/hari</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span><strong>{formatIDR(plan.commission_per_click)}</strong>/klik</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                      <span>{plan.duration_days > 0 ? `${plan.duration_days} hari` : "Selamanya"}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => setConfirmPlan(plan)}
                    disabled={isFree && ownedCount > 0}
                    variant={isFree ? "outline" : "default"}
                  >
                    {isFree && ownedCount > 0 ? (
                      <>Sudah Aktif</>
                    ) : isFree ? (
                      <>Aktifkan Gratis</>
                    ) : (
                      <><Plus className="w-3.5 h-3.5 mr-1" />Beli Paket</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={(o) => !o && setConfirmPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pembelian</DialogTitle>
            <DialogDescription>
              Beli paket <strong>{confirmPlan?.name}</strong> seharga{" "}
              <strong className="text-primary">
                {confirmPlan?.price === 0 ? "Gratis" : formatIDR(confirmPlan?.price || 0)}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          {confirmPlan && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Klik harian</span>
                <span className="font-medium">+{confirmPlan.daily_clicks_limit} klik/hari</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Komisi per klik</span>
                <span className="font-medium">{formatIDR(confirmPlan.commission_per_click)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Durasi aktif</span>
                <span className="font-medium">{confirmPlan.duration_days > 0 ? `${confirmPlan.duration_days} hari` : "Selamanya"}</span>
              </div>
              {confirmPlan.price > 0 && (
                <div className="flex justify-between pt-1.5 border-t border-border mt-1.5">
                  <span className="text-muted-foreground">Saldo Anda</span>
                  <span className={`font-bold ${(profile?.balance || 0) < confirmPlan.price ? "text-red-500" : "text-green-600"}`}>
                    {formatIDR(profile?.balance || 0)}
                  </span>
                </div>
              )}
            </div>
          )}

          {confirmPlan && confirmPlan.price > 0 && (profile?.balance || 0) < confirmPlan.price && (
            <div className="bg-red-500/10 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-red-700 dark:text-red-400">Saldo tidak cukup</p>
                <p className="text-red-600 dark:text-red-500">Silakan top up terlebih dahulu.</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {confirmPlan && confirmPlan.price > 0 && (profile?.balance || 0) < confirmPlan.price ? (
              <Button
                onClick={() => { setConfirmPlan(null); navigate("/dashboard/deposit"); }}
                className="w-full"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" /> Top Up Saldo
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmPlan(null)} disabled={purchasing}>
                  Batal
                </Button>
                <Button onClick={handlePurchase} disabled={purchasing}>
                  {purchasing ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Memproses...</> : "Konfirmasi Beli"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserPlansPage;
