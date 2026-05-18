import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Package, CheckCircle, Zap, MousePointerClick,
  ArrowDownToLine, Crown, Star, Loader2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

interface Plan {
  id: string;
  name: string;
  price: number;
  daily_clicks_limit: number;
  commission_per_click: number;
  description: string | null;
  is_active: boolean;
}

const planIcons = [Package, Star, Zap, Crown];
const planColors = [
  { bg: "bg-muted", border: "border-border", badge: "bg-muted text-muted-foreground", btn: "secondary" as const },
  { bg: "bg-blue-500/5", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-500/10 text-blue-600", btn: "default" as const },
  { bg: "bg-purple-500/5", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-500/10 text-purple-600", btn: "default" as const },
  { bg: "bg-amber-500/5", border: "border-amber-200 dark:border-amber-800", badge: "bg-amber-500/10 text-amber-600", btn: "default" as const },
];

const UserPlansPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });
      setPlans(data || []);
      setLoading(false);
    };
    fetchPlans();
  }, []);

  const handleBuy = async (plan: Plan) => {
    if (!profile) return;

    // Free plan — just assign it
    if (plan.price === 0) {
      setConfirmPlan(plan);
      return;
    }

    // Not enough balance → redirect to deposit
    if ((profile.balance || 0) < plan.price) {
      toast({
        title: "Saldo tidak cukup",
        description: `Anda butuh ${formatIDR(plan.price - (profile.balance || 0))} lagi. Silakan deposit terlebih dahulu.`,
        variant: "destructive",
      });
      navigate("/dashboard/deposit");
      return;
    }

    setConfirmPlan(plan);
  };

  const confirmPurchase = async () => {
    if (!profile || !confirmPlan) return;
    setBuying(confirmPlan.id);

    try {
      // 1. Deduct balance (only if price > 0)
      if (confirmPlan.price > 0) {
        const newBalance = (profile.balance || 0) - confirmPlan.price;
        const { error: balErr } = await supabase
          .from("profiles")
          .update({ balance: newBalance, plan_id: confirmPlan.id })
          .eq("id", profile.id);
        if (balErr) throw balErr;

        // 2. Create transaction record
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: profile.id,
          type: "plan_purchase",
          amount: confirmPlan.price,
          status: "success",
          notes: `Pembelian paket ${confirmPlan.name}`,
        });
        if (txErr) throw txErr;
      } else {
        // Free plan - just update plan_id
        const { error } = await supabase
          .from("profiles")
          .update({ plan_id: confirmPlan.id })
          .eq("id", profile.id);
        if (error) throw error;
      }

      await refreshProfile();
      toast({
        title: "Paket berhasil diaktifkan!",
        description: `Paket ${confirmPlan.name} sekarang aktif. Nikmati ${confirmPlan.daily_clicks_limit} klik/hari.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal membeli paket", description: "Silakan coba lagi.", variant: "destructive" });
    } finally {
      setBuying(null);
      setConfirmPlan(null);
    }
  };

  const currentPlanId = profile?.plan_id;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Pilih Paket</h2>
        <p className="text-muted-foreground text-sm mt-0.5">Tingkatkan paket untuk lebih banyak klik dan komisi lebih besar.</p>
      </div>

      {/* Balance Info */}
      <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Anda</p>
            <p className="text-xl font-bold text-foreground">{formatIDR(profile?.balance || 0)}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/deposit")} className="gap-1">
          <ArrowDownToLine className="w-3.5 h-3.5" />Top Up
        </Button>
      </div>

      {/* Paket Aktif */}
      {currentPlanId && (
        <div className="bg-green-500/10 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Paket aktif: <span className="font-bold">{plans.find(p => p.id === currentPlanId)?.name || "–"}</span>
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              {plans.find(p => p.id === currentPlanId)?.daily_clicks_limit} klik/hari · komisi {formatIDR(plans.find(p => p.id === currentPlanId)?.commission_per_click || 0)}/klik
            </p>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div className="grid gap-4">
        {plans.map((plan, idx) => {
          const Icon = planIcons[idx % planIcons.length];
          const color = planColors[idx % planColors.length];
          const isOwned = plan.id === currentPlanId;
          const canAfford = (profile?.balance || 0) >= plan.price || plan.price === 0;
          const isFree = plan.price === 0;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-5 transition-all ${color.bg} ${isOwned ? "border-green-400 dark:border-green-600" : color.border}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.badge}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{plan.name}</h3>
                      {isOwned && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-green-500/10 text-green-600 border-green-200">
                          Aktif
                        </Badge>
                      )}
                      {idx === 2 && !isOwned && (
                        <Badge className="text-[10px] h-4 px-1.5 bg-purple-500/10 text-purple-600 border-purple-200">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {isFree ? <span className="text-green-500">Gratis</span> : formatIDR(plan.price)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 bg-background/60 rounded-lg p-2">
                  <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{plan.daily_clicks_limit} klik/hari</p>
                    <p className="text-[10px] text-muted-foreground">Batas klik harian</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-background/60 rounded-lg p-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{formatIDR(plan.commission_per_click)}/klik</p>
                    <p className="text-[10px] text-muted-foreground">Komisi per klik</p>
                  </div>
                </div>
              </div>

              {plan.description && (
                <p className="text-xs text-muted-foreground mt-3">{plan.description}</p>
              )}

              {/* Potensi per hari */}
              <div className="mt-3 bg-background/60 rounded-lg px-3 py-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Potensi komisi/hari</p>
                <p className="text-sm font-bold text-green-600">
                  {formatIDR(plan.daily_clicks_limit * plan.commission_per_click)}
                </p>
              </div>

              {/* Action */}
              <div className="mt-4">
                {isOwned ? (
                  <Button disabled className="w-full h-10 text-sm" variant="outline">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Paket Aktif
                  </Button>
                ) : !canAfford ? (
                  <Button
                    className="w-full h-10 text-sm gap-2"
                    variant="outline"
                    onClick={() => navigate("/dashboard/deposit")}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Saldo Kurang — Top Up
                  </Button>
                ) : (
                  <Button
                    className="w-full h-10 text-sm"
                    onClick={() => handleBuy(plan)}
                    disabled={buying === plan.id}
                  >
                    {buying === plan.id ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                    ) : isFree ? (
                      "Gunakan Paket Gratis"
                    ) : (
                      `Beli — ${formatIDR(plan.price)}`
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmPlan} onOpenChange={(o) => !o && setConfirmPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembelian Paket</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPlan && (
                <span className="space-y-1 block">
                  <span className="block">Anda akan membeli <strong>Paket {confirmPlan.name}</strong>.</span>
                  {confirmPlan.price > 0 && (
                    <span className="block">
                      Saldo akan dipotong <strong>{formatIDR(confirmPlan.price)}</strong>.
                      <br />
                      Sisa saldo: <strong>{formatIDR((profile?.balance || 0) - confirmPlan.price)}</strong>
                    </span>
                  )}
                  <span className="block mt-2">
                    Anda akan mendapat <strong>{confirmPlan.daily_clicks_limit} klik/hari</strong> dengan komisi <strong>{formatIDR(confirmPlan.commission_per_click)}/klik</strong>.
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPurchase} disabled={!!buying}>
              {buying ? "Memproses..." : "Ya, Beli Sekarang"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserPlansPage;
