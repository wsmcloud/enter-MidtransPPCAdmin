import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Wallet, MousePointerClick, TrendingUp, ArrowUpFromLine, History, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Stats {
  total_earned: number;
  today_clicks: number;
  total_clicks: number;
  pending_deposit: number;
  pending_withdraw: number;
}

interface RecentClick {
  id: string;
  earned_amount: number;
  clicked_at: string;
  ads: { title: string } | null;
}

const Dashboard: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [stats, setStats] = useState<Stats>({ total_earned: 0, today_clicks: 0, total_clicks: 0, pending_deposit: 0, pending_withdraw: 0 });
  const [recentClicks, setRecentClicks] = useState<RecentClick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      const today = new Date().toISOString().split("T")[0];

      const [clicksRes, todayClicksRes, txRes] = await Promise.all([
        supabase.from("ad_clicks").select("earned_amount, clicked_at, ads(title)").eq("user_id", profile.id).order("clicked_at", { ascending: false }).limit(10),
        supabase.from("ad_clicks").select("id", { count: "exact", head: true }).eq("user_id", profile.id).gte("clicked_at", today),
        supabase.from("transactions").select("type, amount, status").eq("user_id", profile.id),
      ]);

      const clicks = clicksRes.data || [];
      const totalEarned = clicks.reduce((sum, c) => sum + (c.earned_amount || 0), 0);
      const pendingDeposit = txRes.data?.filter(t => t.type === "deposit" && t.status === "pending").reduce((s, t) => s + t.amount, 0) || 0;
      const pendingWithdraw = txRes.data?.filter(t => t.type === "withdrawal" && t.status === "pending").reduce((s, t) => s + t.amount, 0) || 0;

      setStats({
        total_earned: totalEarned,
        today_clicks: todayClicksRes.count || 0,
        total_clicks: clicks.length,
        pending_deposit: pendingDeposit,
        pending_withdraw: pendingWithdraw,
      });
      setRecentClicks(clicks as RecentClick[]);
      setLoading(false);
      refreshProfile();
    };

    fetchData();
  }, [profile?.id]);

  const StatCard = ({ icon: Icon, label, value, color, sub }: { icon: React.ElementType, label: string, value: string, color: string, sub?: string }) => (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Selamat datang, {profile?.full_name?.split(" ")[0]}!</h2>
        <p className="text-muted-foreground text-sm mt-1">Pantau penghasilan dan aktivitas Anda hari ini.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Saldo" value={formatIDR(profile?.balance || 0)} color="bg-primary/10 text-primary" />
        <StatCard icon={TrendingUp} label="Total Penghasilan" value={formatIDR(stats.total_earned)} color="bg-green-500/10 text-green-500" />
        <StatCard icon={MousePointerClick} label="Klik Hari Ini" value={`${stats.today_clicks}`} color="bg-amber-500/10 text-amber-500" sub="klik" />
        <StatCard icon={History} label="Total Klik" value={`${stats.total_clicks}`} color="bg-purple-500/10 text-purple-500" sub="klik" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/dashboard/ads">
          <div className="bg-card rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-all cursor-pointer group">
            <MousePointerClick className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-foreground">Klik Iklan</h3>
            <p className="text-sm text-muted-foreground mt-1">Lihat & klik iklan untuk dapat komisi</p>
          </div>
        </Link>
        <Link to="/dashboard/deposit">
          <div className="bg-card rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-all cursor-pointer group">
            <ArrowUpFromLine className="w-8 h-8 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-foreground">Deposit</h3>
            <p className="text-sm text-muted-foreground mt-1">Tambah saldo akun Anda</p>
          </div>
        </Link>
        <Link to="/dashboard/withdraw">
          <div className="bg-card rounded-2xl p-5 border border-border shadow-card hover:shadow-elevated transition-all cursor-pointer group">
            <ArrowUpFromLine className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-foreground">Tarik Dana</h3>
            <p className="text-sm text-muted-foreground mt-1">Cairkan saldo ke rekening bank</p>
          </div>
        </Link>
      </div>

      {/* Recent Clicks */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Klik Terbaru</h3>
          <Link to="/dashboard/transactions">
            <Button variant="ghost" size="sm" className="text-primary gap-1 h-8">
              Lihat semua <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
        <div className="divide-y divide-border">
          {recentClicks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Belum ada klik. <Link to="/dashboard/ads" className="text-primary hover:underline">Mulai klik iklan</Link>
            </div>
          ) : (
            recentClicks.slice(0, 5).map(click => (
              <div key={click.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{click.ads?.title || "Iklan"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(click.clicked_at)}</p>
                </div>
                <Badge className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/10">
                  +{formatIDR(click.earned_amount)}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
