import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  Wallet, MousePointerClick, TrendingUp, ArrowUpFromLine, History,
  ArrowRight, ArrowDownToLine, Clock, CheckCircle, Info,
  Zap, Shield, Star, Users, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Stats {
  total_earned: number;
  today_clicks: number;
  total_clicks: number;
  pending_deposit: number;
}

interface RecentClick {
  id: string;
  earned_amount: number;
  clicked_at: string;
  ads: { title: string } | null;
}

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<Stats>({ total_earned: 0, today_clicks: 0, total_clicks: 0, pending_deposit: 0 });
  const [recentClicks, setRecentClicks] = useState<RecentClick[]>([]);
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      // If profile loading is done but profile is still null, stop loading
      const timer = setTimeout(() => setLoading(false), 3000);
      return () => clearTimeout(timer);
    }

    const fetchData = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      try {
        const [clicksRes, todayClicksRes, txRes, allTxRes] = await Promise.all([
          supabase.from("ad_clicks").select("id, earned_amount, clicked_at, ads(title)").eq("user_id", profile.id).order("clicked_at", { ascending: false }).limit(5),
          supabase.from("ad_clicks").select("id", { count: "exact", head: true }).eq("user_id", profile.id).gte("clicked_at", today),
          supabase.from("transactions").select("type, amount, status").eq("user_id", profile.id),
          supabase.from("transactions").select("id, type, amount, status, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(5),
        ]);

        const clicks = clicksRes.data || [];
        const allTx = txRes.data || [];
        const totalEarned = allTx.filter(t => t.type === "commission" && t.status === "success").reduce((s, t) => s + Number(t.amount), 0);
        const pendingDeposit = allTx.filter(t => t.type === "deposit" && t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);

        setStats({
          total_earned: totalEarned,
          today_clicks: todayClicksRes.count || 0,
          total_clicks: clicks.length,
          pending_deposit: pendingDeposit,
        });
        setRecentClicks(clicks as unknown as RecentClick[]);
        setRecentTx(allTxRes.data || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }

      setLoading(false);
      refreshProfile();
    };

    fetchData();
  }, [profile?.id]);

  const txTypeLabel: Record<string, string> = { deposit: "Deposit", withdrawal: "Penarikan", commission: "Komisi Klik" };
  const txTypeColor = (type: string) => type === "commission" ? "text-green-600" : type === "deposit" ? "text-blue-600" : "text-amber-600";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-40 bg-muted rounded-2xl animate-pulse" />
        <div className="h-56 bg-muted rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Hai, {profile?.full_name?.split(" ")[0] || "Member"}!
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5">Pantau penghasilan dan aktivitas PPC Anda.</p>
      </div>

      {/* Pending Deposit Alert */}
      {stats.pending_deposit > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Deposit Menunggu Konfirmasi</p>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
              {formatIDR(stats.pending_deposit)} sedang diproses. Saldo akan masuk setelah admin mengkonfirmasi.
            </p>
          </div>
          <Link to="/dashboard/deposit">
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100">
              Cek
            </Button>
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border shadow-card col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Saldo Aktif</p>
              <p className="text-3xl font-bold text-foreground mt-1">{formatIDR(profile?.balance || 0)}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/dashboard/deposit">
                <Button size="sm" className="h-8 text-xs gap-1">
                  <ArrowDownToLine className="w-3 h-3" />Deposit
                </Button>
              </Link>
              <Link to="/dashboard/withdraw">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1">
                  <ArrowUpFromLine className="w-3 h-3" />Tarik
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Total Komisi</p>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-bold text-green-600">{formatIDR(stats.total_earned)}</p>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border shadow-card">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Klik Hari Ini</p>
            <MousePointerClick className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold text-foreground">{stats.today_clicks} <span className="text-sm font-normal text-muted-foreground">klik</span></p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: "/dashboard/ads", icon: MousePointerClick, label: "Klik Iklan", color: "text-primary", bg: "bg-primary/10" },
          { to: "/dashboard/deposit", icon: ArrowDownToLine, label: "Deposit", color: "text-green-500", bg: "bg-green-500/10" },
          { to: "/dashboard/transactions", icon: History, label: "Riwayat", color: "text-purple-500", bg: "bg-purple-500/10" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}>
              <div className="bg-card rounded-xl p-3 border border-border shadow-card hover:shadow-elevated transition-all text-center group">
                <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="text-xs font-medium text-foreground">{item.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Tentang PPC */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="gradient-primary p-5">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-white/80" />
            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Tentang Platform PPC</span>
          </div>
          <h3 className="text-lg font-bold text-white">Hasilkan Uang dengan Klik Iklan</h3>
          <p className="text-sm text-white/80 mt-1">Platform Pay-Per-Click (PPC) terpercaya. Klik iklan dan dapatkan komisi langsung ke saldo Anda.</p>
        </div>

        <div className="p-5 grid grid-cols-2 gap-4">
          {[
            { icon: Zap, title: "Langsung Dikreditkan", desc: "Komisi masuk ke saldo otomatis setelah klik", color: "text-amber-500" },
            { icon: Shield, title: "Aman & Terpercaya", desc: "Pembayaran dijamin dan terverifikasi sistem", color: "text-green-500" },
            { icon: Star, title: "Upgrade Plan", desc: "Lebih banyak klik & komisi lebih besar per klik", color: "text-purple-500" },
            { icon: Users, title: "Komunitas Aktif", desc: "Bergabung dengan ribuan member aktif", color: "text-blue-500" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-2">
                <Icon className={`w-4 h-4 ${item.color} shrink-0 mt-0.5`} />
                <div>
                  <p className="text-xs font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 pb-5">
          <div className="bg-muted rounded-xl p-4">
            <p className="text-xs font-semibold text-foreground mb-3">Cara Kerja PPC:</p>
            {[
              "Deposit saldo ke akun Anda",
              "Pilih paket sesuai kebutuhan",
              "Klik iklan yang tersedia setiap hari",
              "Komisi masuk otomatis ke saldo",
              "Tarik dana ke rekening bank kapan saja",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                <div className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white">{i + 1}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Transaksi Terbaru</h3>
          <Link to="/dashboard/transactions">
            <Button variant="ghost" size="sm" className="text-primary gap-1 h-7 text-xs">
              Semua <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentTx.length === 0 ? (
            <div className="p-8 text-center">
              <History className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
              <Link to="/dashboard/deposit">
                <Button size="sm" className="mt-3 h-8 text-xs">Deposit Sekarang</Button>
              </Link>
            </div>
          ) : (
            recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                    ${tx.type === "deposit" ? "bg-blue-500/10" : tx.type === "commission" ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    {tx.type === "deposit" && <ArrowDownToLine className="w-3.5 h-3.5 text-blue-500" />}
                    {tx.type === "commission" && <MousePointerClick className="w-3.5 h-3.5 text-green-500" />}
                    {tx.type === "withdrawal" && <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{txTypeLabel[tx.type] || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txTypeColor(tx.type)}`}>
                    {tx.type === "withdrawal" ? "-" : "+"}{formatIDR(tx.amount)}
                  </p>
                  <Badge className={`text-[10px] h-4 px-1.5 ${tx.status === "success" ? "bg-green-500/10 text-green-600 border-green-200" : tx.status === "pending" ? "bg-amber-500/10 text-amber-600 border-amber-200" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                    {tx.status === "success" ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> : tx.status === "pending" ? <Clock className="w-2.5 h-2.5 mr-0.5" /> : null}
                    {tx.status === "success" ? "Berhasil" : tx.status === "pending" ? "Pending" : "Gagal"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Banner: Mulai Klik */}
      <div className="bg-card rounded-2xl border border-border p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-foreground">Siap dapat komisi hari ini?</p>
          <p className="text-xs text-muted-foreground mt-0.5">Iklan sudah tersedia untuk diklik dan hasilkan komisi</p>
        </div>
        <Link to="/dashboard/ads">
          <Button size="sm" className="gap-1 shrink-0">
            Klik Sekarang <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
