import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { Users, Megaphone, ArrowDownToLine, ArrowUpFromLine, TrendingUp, DollarSign, Clock } from "lucide-react";

interface DashStats {
  totalUsers: number;
  activeAds: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDeposited: number;
  totalWithdrawn: number;
  todayEarnings: number;
}

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashStats>({
    totalUsers: 0, activeAds: 0, pendingDeposits: 0, pendingWithdrawals: 0,
    totalDeposited: 0, totalWithdrawn: 0, todayEarnings: 0,
  });
  const [recentTx, setRecentTx] = useState<RecentTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [usersRes, adsRes, depositPendingRes, withdrawPendingRes, txRes, recentRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "user"),
        supabase.from("ads").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("transactions").select("amount").eq("type", "deposit").eq("status", "pending"),
        supabase.from("withdrawal_requests").select("amount").eq("status", "pending"),
        supabase.from("transactions").select("type, amount, status, created_at"),
        supabase.from("transactions").select("id, type, amount, status, created_at, profiles(full_name)")
          .order("created_at", { ascending: false }).limit(8),
      ]);

      const allTx = txRes.data || [];
      const totalDeposited = allTx.filter(t => t.type === "deposit" && t.status === "success").reduce((s, t) => s + t.amount, 0);
      const totalWithdrawn = allTx.filter(t => t.type === "withdrawal" && t.status === "success").reduce((s, t) => s + t.amount, 0);
      const todayEarnings = allTx.filter(t => t.type === "commission" && t.created_at.startsWith(today)).reduce((s, t) => s + t.amount, 0);
      const pendingDeposits = (depositPendingRes.data || []).reduce((s, t) => s + t.amount, 0);
      const pendingWithdrawals = (withdrawPendingRes.data || []).reduce((s, t) => s + t.amount, 0);

      setStats({
        totalUsers: usersRes.count || 0,
        activeAds: adsRes.count || 0,
        pendingDeposits,
        pendingWithdrawals,
        totalDeposited,
        totalWithdrawn,
        todayEarnings,
      });

      setRecentTx(recentRes.data as unknown as RecentTx[]);
      setLoading(false);
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: "Total User", value: String(stats.totalUsers), icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Iklan Aktif", value: String(stats.activeAds), icon: Megaphone, color: "bg-purple-500/10 text-purple-500" },
    { label: "Total Deposit", value: formatIDR(stats.totalDeposited), icon: ArrowDownToLine, color: "bg-green-500/10 text-green-500" },
    { label: "Total WD", value: formatIDR(stats.totalWithdrawn), icon: ArrowUpFromLine, color: "bg-amber-500/10 text-amber-500" },
    { label: "Pending Deposit", value: formatIDR(stats.pendingDeposits), icon: Clock, color: "bg-blue-500/10 text-blue-500", sub: "menunggu konfirmasi" },
    { label: "Pending Penarikan", value: formatIDR(stats.pendingWithdrawals), icon: Clock, color: "bg-orange-500/10 text-orange-500", sub: "menunggu diproses" },
    { label: "Komisi Hari Ini", value: formatIDR(stats.todayEarnings), icon: TrendingUp, color: "bg-emerald-500/10 text-emerald-500" },
    { label: "Estimasi Pendapatan", value: formatIDR(stats.totalDeposited - stats.totalWithdrawn), icon: DollarSign, color: "bg-indigo-500/10 text-indigo-500" },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  const typeLabelMap: Record<string, string> = { deposit: "Deposit", withdrawal: "Penarikan", commission: "Komisi" };
  const typeColor = (type: string) => {
    if (type === "deposit") return "text-green-600";
    if (type === "withdrawal") return "text-amber-600";
    return "text-primary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard Admin</h2>
        <p className="text-muted-foreground text-sm mt-1">Ringkasan keseluruhan platform PPC Ads.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card rounded-2xl p-5 border border-border shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{c.value}</p>
                  {c.sub && <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>}
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Transaksi Terbaru</h3>
        </div>
        <div className="divide-y divide-border">
          {recentTx.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Belum ada transaksi</div>
          ) : (
            recentTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{tx.profiles?.full_name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{typeLabelMap[tx.type]} • {formatDate(tx.created_at)}</p>
                </div>
                <p className={`text-sm font-bold ${typeColor(tx.type)}`}>{formatIDR(tx.amount)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
