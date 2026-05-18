import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Copy, CheckCircle, Users, TrendingUp, Wallet,
  AlertCircle, ArrowRight, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_CLAIM = 50000;
const REFERRAL_PERCENT = 2;

interface Commission {
  id: string;
  deposit_amount: number;
  commission_amount: number;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

interface ReferralStats {
  total_referrals: number;
  total_commission: number;
}

const ReferralPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<ReferralStats>({ total_referrals: 0, total_commission: 0 });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const referralLink = profile?.referral_code
    ? `${window.location.origin}/register?ref=${profile.referral_code}`
    : "";

  useEffect(() => {
    if (!profile?.id) return;
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);

    const [commissionsRes, referralsRes] = await Promise.all([
      supabase
        .from("referral_commissions")
        .select("id, deposit_amount, commission_amount, created_at, profiles!referred_id(full_name, email)")
        .eq("referrer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", profile.id),
    ]);

    const commData = (commissionsRes.data || []) as unknown as Commission[];
    const totalCommission = commData.reduce((s, c) => s + Number(c.commission_amount), 0);

    setCommissions(commData);
    setStats({
      total_referrals: referralsRes.count || 0,
      total_commission: totalCommission,
    });
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Link disalin!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    if (!profile) return;
    const bonusBalance = profile.bonus_balance || 0;

    if (bonusBalance < MIN_CLAIM) {
      toast({
        title: `Minimum klaim ${formatIDR(MIN_CLAIM)}`,
        description: `Saldo bonus Anda ${formatIDR(bonusBalance)}. Butuh ${formatIDR(MIN_CLAIM - bonusBalance)} lagi.`,
        variant: "destructive",
      });
      return;
    }

    setClaiming(true);
    try {
      // Move bonus to main balance
      const newBalance = (profile.balance || 0) + bonusBalance;
      const { error } = await supabase
        .from("profiles")
        .update({ balance: newBalance, bonus_balance: 0 })
        .eq("id", profile.id);

      if (error) throw error;

      // Record transaction
      await supabase.from("transactions").insert({
        user_id: profile.id,
        type: "bonus_claim",
        amount: bonusBalance,
        status: "success",
        notes: `Klaim bonus referral ke saldo utama`,
      });

      await refreshProfile();
      toast({
        title: "Klaim berhasil!",
        description: `${formatIDR(bonusBalance)} telah dipindahkan ke saldo utama.`,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Gagal klaim", variant: "destructive" });
    }
    setClaiming(false);
  };

  const bonusBalance = profile?.bonus_balance || 0;
  const canClaim = bonusBalance >= MIN_CLAIM;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Program Referral</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Ajak teman daftar, dapatkan {REFERRAL_PERCENT}% dari setiap deposit mereka.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="gradient-primary p-5">
          <div className="flex items-center gap-2 mb-1">
            <Gift className="w-4 h-4 text-white/80" />
            <span className="text-xs text-white/80 font-medium uppercase tracking-wider">Cara Kerja</span>
          </div>
          <h3 className="text-lg font-bold text-white">Hasilkan dari Referral</h3>
        </div>
        <div className="p-5 grid grid-cols-3 gap-3 text-center">
          {[
            { step: "1", title: "Bagikan Link", desc: "Salin & share link referral Anda" },
            { step: "2", title: "Teman Daftar", desc: "Teman daftar via link Anda" },
            { step: "3", title: "Dapat Bonus", desc: `${REFERRAL_PERCENT}% dari setiap deposit mereka` },
          ].map(item => (
            <div key={item.step} className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                {item.step}
              </div>
              <p className="text-xs font-semibold text-foreground">{item.title}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Link */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-card">
        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          Link Referral Anda
        </p>
        <div className="flex gap-2">
          <div className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-xs text-muted-foreground font-mono truncate">
            {referralLink || "Memuat..."}
          </div>
          <Button size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Disalin!" : "Salin"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <span className="font-semibold text-primary">{profile?.referral_code}</span>
          <span>— Kode referral unik Anda</span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border shadow-card text-center">
          <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats.total_referrals}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Referral</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border shadow-card text-center">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-600">{formatIDR(stats.total_commission)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Komisi</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border shadow-card text-center">
          <Wallet className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-purple-600">{formatIDR(bonusBalance)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Saldo Bonus</p>
        </div>
      </div>

      {/* Claim Bonus */}
      <div className={`rounded-2xl border-2 p-5 ${canClaim ? "border-green-400 bg-green-500/5" : "border-border bg-card"}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">Klaim Saldo Bonus</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canClaim
                ? `Bonus Anda sudah siap diklaim ke saldo utama!`
                : `Kumpulkan minimal ${formatIDR(MIN_CLAIM)} untuk klaim. Kurang ${formatIDR(MIN_CLAIM - bonusBalance)} lagi.`}
            </p>
            {bonusBalance > 0 && !canClaim && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-foreground">{formatIDR(bonusBalance)} / {formatIDR(MIN_CLAIM)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-primary rounded-full transition-all"
                    style={{ width: `${Math.min((bonusBalance / MIN_CLAIM) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <Button
            onClick={handleClaim}
            disabled={!canClaim || claiming}
            className={`shrink-0 gap-1.5 ${canClaim ? "bg-green-500 hover:bg-green-600" : ""}`}
            variant={canClaim ? "default" : "outline"}
          >
            {claiming ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
            ) : canClaim ? (
              <><Wallet className="w-4 h-4" />Klaim {formatIDR(bonusBalance)}</>
            ) : (
              <><AlertCircle className="w-4 h-4" />Belum Cukup</>
            )}
          </Button>
        </div>
      </div>

      {/* Commission History */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Riwayat Komisi Referral</h3>
          <span className="text-xs text-muted-foreground">{REFERRAL_PERCENT}% dari deposit</span>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Memuat...</div>
          ) : commissions.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada komisi referral</p>
              <p className="text-xs text-muted-foreground mt-1">Bagikan link referral Anda untuk mulai menghasilkan</p>
            </div>
          ) : (
            commissions.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Gift className="w-3.5 h-3.5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {c.profiles?.full_name || "Member"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Deposit {formatIDR(c.deposit_amount)} · {formatDate(c.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">+{formatIDR(c.commission_amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{REFERRAL_PERCENT}% komisi</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-muted rounded-xl p-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Komisi referral <strong>2%</strong> akan masuk ke <strong>saldo bonus</strong> setiap kali referral Anda melakukan deposit.</p>
          <p>Saldo bonus dapat diklaim ke saldo utama setelah mencapai minimal <strong>{formatIDR(MIN_CLAIM)}</strong>.</p>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
