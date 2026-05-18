import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MousePointerClick, ExternalLink, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  cpc_rate: number;
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
  const [clickingId, setClickingId] = useState<string | null>(null);

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

  const handleClick = async (ad: Ad) => {
    if (!profile) return;
    if (ad.clicked_today) {
      toast({ title: "Sudah diklik", description: "Anda sudah mengklik iklan ini hari ini.", variant: "destructive" });
      return;
    }

    const limit = plan?.daily_clicks_limit || 5;
    if (todayClicks >= limit) {
      toast({ title: "Batas klik tercapai", description: `Anda sudah mencapai batas ${limit} klik hari ini.`, variant: "destructive" });
      return;
    }

    setClickingId(ad.id);

    // Open ad URL
    window.open(ad.url, "_blank");

    const earnAmount = plan?.commission_per_click || 200;

    // Record click
    const { error: clickError } = await supabase.from("ad_clicks").insert({
      user_id: profile.id,
      ad_id: ad.id,
      earned_amount: earnAmount,
    });

    if (clickError) {
      toast({ title: "Gagal merekam klik", variant: "destructive" });
      setClickingId(null);
      return;
    }

    // Add balance & commission transaction
    const newBalance = (profile.balance || 0) + earnAmount;
    await Promise.all([
      supabase.from("profiles").update({ balance: newBalance }).eq("id", profile.id),
      supabase.from("transactions").insert({
        user_id: profile.id,
        type: "commission",
        amount: earnAmount,
        status: "success",
        notes: `Komisi klik iklan: ${ad.title}`,
      }),
      supabase.from("ads").update({ spent_budget: ad.cpc_rate }).eq("id", ad.id),
    ]);

    toast({ title: `+${formatIDR(earnAmount)} ditambahkan!`, description: "Komisi berhasil dikreditkan ke saldo Anda." });

    setClickingId(null);
    fetchData();
    refreshProfile();
  };

  const limit = plan?.daily_clicks_limit || 5;
  const remaining = Math.max(0, limit - todayClicks);

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
        <p className="text-muted-foreground text-sm mt-1">Klik iklan untuk mendapatkan komisi. Setiap iklan bisa diklik 1x per hari.</p>
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
        <p className="text-xs text-muted-foreground mt-2">
          {remaining > 0 ? `Sisa ${remaining} klik hari ini` : "Batas klik hari ini sudah terpenuhi"}
        </p>
      </div>

      {/* Ads Grid */}
      {ads.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center border border-border">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Belum ada iklan aktif saat ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ads.map(ad => (
            <div key={ad.id} className={`bg-card rounded-2xl border shadow-card overflow-hidden transition-all duration-200 ${ad.clicked_today ? "opacity-60 border-border" : "border-border hover:shadow-elevated hover:-translate-y-0.5"}`}>
              {ad.image_url && (
                <div className="h-36 bg-muted overflow-hidden">
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                </div>
              )}
              {!ad.image_url && (
                <div className="h-36 gradient-primary flex items-center justify-center">
                  <ExternalLink className="w-10 h-10 text-white/60" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{ad.title}</h3>
                {ad.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ad.description}</p>}

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Komisi per klik</p>
                    <p className="text-lg font-bold text-green-500">{formatIDR(plan?.commission_per_click || 200)}</p>
                  </div>
                  {ad.clicked_today ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-200">
                      <CheckCircle className="w-3 h-3 mr-1" /> Diklik
                    </Badge>
                  ) : remaining === 0 ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="w-3 h-3 mr-1" /> Besok
                    </Badge>
                  ) : null}
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  disabled={ad.clicked_today || remaining === 0 || clickingId === ad.id}
                  onClick={() => handleClick(ad)}
                  variant={ad.clicked_today ? "outline" : "default"}
                >
                  {clickingId === ad.id ? "Memproses..." : ad.clicked_today ? "Sudah Diklik" : "Klik & Kunjungi"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdsPage;
