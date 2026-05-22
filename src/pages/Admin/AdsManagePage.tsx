import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone, Plus, Edit2, Trash2, Save, X, Play, Pause,
  Timer, Zap, RefreshCw, Info, CheckCircle2, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Ad {
  id: string;
  title: string;
  description: string | null;
  url: string;
  image_url: string | null;
  cpc_rate: number;
  daily_budget: number;
  total_budget: number;
  spent_budget: number;
  view_duration: number;
  plan_id: string | null;
  source: string;
  status: "active" | "paused" | "ended";
  created_at: string;
}

interface PlanOption {
  id: string;
  name: string;
  daily_clicks_limit: number;
  commission_per_click: number;
}

interface MonotagConfig {
  plan_id: string;
  smart_link: string;
  ad_count: number;
  view_duration: number;
}

const emptyForm = {
  title: "", description: "", url: "", image_url: "",
  cpc_rate: 500, daily_budget: 100000, total_budget: 1000000,
  view_duration: 30, plan_id: "", status: "active" as const,
};

const TABS = ["Semua Iklan", "Monetag Auto"] as const;
type Tab = typeof TABS[number];

const AdsManagePage: React.FC = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("Semua Iklan");
  const [ads, setAds] = useState<Ad[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual ad dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Monetag config (one per plan)
  const [monetagConfigs, setMonotagConfigs] = useState<MonotagConfig[]>([]);
  const [generating, setGenerating] = useState<string | null>(null); // plan_id being generated

  const fetchData = async () => {
    setLoading(true);
    const [adsRes, plansRes] = await Promise.all([
      supabase.from("ads").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("id, name, daily_clicks_limit, commission_per_click")
        .eq("is_active", true).order("price"),
    ]);
    const allPlans = plansRes.data || [];
    setAds(adsRes.data || []);
    setPlans(allPlans);
    // Init monetag configs for each plan if not already set
    setMonotagConfigs(prev => {
      const existing = new Map(prev.map(c => [c.plan_id, c]));
      return allPlans.map(p => existing.get(p.id) || {
        plan_id: p.id,
        smart_link: "",
        ad_count: p.daily_clicks_limit || 5,
        view_duration: 30,
      });
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Manual ad CRUD
  const openCreate = () => { setEditAd(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (ad: Ad) => {
    setEditAd(ad);
    setForm({
      title: ad.title, description: ad.description || "", url: ad.url,
      image_url: ad.image_url || "", cpc_rate: ad.cpc_rate,
      daily_budget: ad.daily_budget, total_budget: ad.total_budget,
      view_duration: ad.view_duration || 30, plan_id: ad.plan_id || "", status: ad.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.url) { toast({ title: "Judul dan URL wajib diisi", variant: "destructive" }); return; }
    if (!form.plan_id) { toast({ title: "Pilih paket untuk iklan ini", variant: "destructive" }); return; }
    setSaveLoading(true);
    const payload = { ...form, image_url: form.image_url || null, description: form.description || null, plan_id: form.plan_id || null, source: "manual" };
    if (editAd) {
      const { error } = await supabase.from("ads").update(payload).eq("id", editAd.id);
      if (error) toast({ title: "Gagal menyimpan", variant: "destructive" });
      else { toast({ title: "Iklan diperbarui" }); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("ads").insert(payload);
      if (error) toast({ title: "Gagal membuat iklan", variant: "destructive" });
      else { toast({ title: "Iklan berhasil dibuat" }); setDialogOpen(false); fetchData(); }
    }
    setSaveLoading(false);
  };

  const toggleStatus = async (ad: Ad) => {
    const newStatus = ad.status === "active" ? "paused" : "active";
    await supabase.from("ads").update({ status: newStatus }).eq("id", ad.id);
    toast({ title: `Iklan ${newStatus === "active" ? "diaktifkan" : "dijeda"}` });
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("ads").delete().eq("id", deleteId);
    toast({ title: "Iklan dihapus" });
    setDeleteId(null);
    fetchData();
  };

  // Monetag: generate ads for a plan
  const generateMonotagAds = async (config: MonotagConfig) => {
    if (!config.smart_link) {
      toast({ title: "Smart Link URL wajib diisi", variant: "destructive" });
      return;
    }
    const plan = plans.find(p => p.id === config.plan_id);
    if (!plan) return;

    setGenerating(config.plan_id);

    // 1. Delete existing monetag ads for this plan
    await supabase.from("ads")
      .delete()
      .eq("plan_id", config.plan_id)
      .eq("source", "monetag");

    // 2. Create N new ads
    const rows = Array.from({ length: config.ad_count }, (_, i) => ({
      title: `Monetag ${plan.name} #${i + 1}`,
      description: `Iklan otomatis Monetag untuk paket ${plan.name}`,
      url: config.smart_link,
      image_url: null,
      cpc_rate: plan.commission_per_click,
      daily_budget: 99999999,
      total_budget: 99999999,
      view_duration: config.view_duration,
      plan_id: config.plan_id,
      source: "monetag",
      status: "active" as const,
    }));

    const { error } = await supabase.from("ads").insert(rows);
    if (error) {
      toast({ title: "Gagal generate iklan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${config.ad_count} iklan Monetag berhasil di-generate untuk paket ${plan.name}!` });
      fetchData();
    }
    setGenerating(null);
  };

  const updateConfig = (plan_id: string, field: keyof MonotagConfig, value: string | number) => {
    setMonotagConfigs(prev => prev.map(c => c.plan_id === plan_id ? { ...c, [field]: value } : c));
  };

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-green-500/10 text-green-600 border-green-200">Aktif</Badge>;
    if (status === "paused") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Dijeda</Badge>;
    return <Badge className="bg-muted text-muted-foreground">Berakhir</Badge>;
  };

  const monetagCount = ads.filter(a => a.source === "monetag").length;
  const manualCount = ads.filter(a => a.source !== "monetag").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manajemen Iklan</h2>
          <p className="text-muted-foreground text-sm mt-1">Kelola iklan manual atau generate otomatis via Monetag.</p>
        </div>
        {tab === "Semua Iklan" && (
          <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Tambah Iklan</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              tab === t
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "Semua Iklan" && `Semua Iklan (${manualCount + monetagCount})`}
            {t === "Monetag Auto" && (
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Monetag Auto{monetagCount > 0 && ` (${monetagCount})`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Semua Iklan ═══ */}
      {tab === "Semua Iklan" && (
        <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Iklan</th>
                  <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Sumber</th>
                  <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Paket</th>
                  <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Timer</th>
                  <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Dibuat</th>
                  <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  [...Array(4)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
                ) : ads.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">Belum ada iklan</td></tr>
                ) : (
                  ads.map(ad => (
                    <tr key={ad.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ad.source === "monetag" ? "bg-amber-500/10" : "gradient-primary"}`}>
                            {ad.source === "monetag"
                              ? <Zap className="w-4 h-4 text-amber-500" />
                              : <Megaphone className="w-4 h-4 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{ad.title}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{ad.url}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {ad.source === "monetag"
                          ? <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px]">Monetag</Badge>
                          : <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                          {plans.find(p => p.id === ad.plan_id)?.name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                          <Timer className="w-3 h-3 text-primary" />{ad.view_duration || 30}s
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">{statusBadge(ad.status)}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(ad.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toggleStatus(ad)}>
                            {ad.status === "active" ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-green-500" />}
                          </Button>
                          {ad.source !== "monetag" && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(ad)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(ad.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: Monetag Auto ═══ */}
      {tab === "Monetag Auto" && (
        <div className="space-y-4">
          {/* How it works */}
          <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">Cara Kerja Monetag Smart Link</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                <li>Login ke dashboard Monetag → buat <strong>Direct Link (Smart Link)</strong> zone</li>
                <li>Salin URL Smart Link yang diberikan Monetag</li>
                <li>Paste di kolom di bawah per paket → klik <strong>Generate Otomatis</strong></li>
                <li>Sistem akan membuat N iklan yang mengarah ke Smart Link tersebut</li>
                <li>Monetag otomatis merotasi konten iklan berbeda untuk tiap klik user</li>
              </ol>
            </div>
          </div>

          {/* Per-plan config cards */}
          {plans.length === 0 ? (
            <div className="bg-card rounded-xl p-8 text-center border border-border">
              <p className="text-muted-foreground text-sm">Belum ada paket aktif. Buat paket terlebih dahulu.</p>
            </div>
          ) : (
            monetagConfigs.map(config => {
              const plan = plans.find(p => p.id === config.plan_id);
              if (!plan) return null;
              const existing = ads.filter(a => a.source === "monetag" && a.plan_id === plan.id);
              const isGen = generating === plan.id;

              return (
                <div key={plan.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  {/* Plan header */}
                  <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-foreground text-sm">Paket {plan.name}</span>
                      <span className="text-xs text-muted-foreground">({plan.daily_clicks_limit} klik/hari · {formatIDR(plan.commission_per_click)}/klik)</span>
                    </div>
                    {existing.length > 0 && (
                      <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px] gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />{existing.length} iklan aktif
                      </Badge>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        Smart Link URL dari Monetag
                      </Label>
                      <Input
                        value={config.smart_link}
                        onChange={e => updateConfig(plan.id, "smart_link", e.target.value)}
                        placeholder="https://goldenmines.life/... (Smart Link dari dashboard Monetag)"
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">Jumlah Iklan di-generate</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={config.ad_count}
                          onChange={e => updateConfig(plan.id, "ad_count", parseInt(e.target.value) || 1)}
                        />
                        <p className="text-[11px] text-muted-foreground">Rekomendasi: sesuaikan dengan klik/hari ({plan.daily_clicks_limit})</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm flex items-center gap-1"><Timer className="w-3 h-3" />Durasi Tonton (detik)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={300}
                          value={config.view_duration}
                          onChange={e => updateConfig(plan.id, "view_duration", parseInt(e.target.value) || 30)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        onClick={() => generateMonotagAds(config)}
                        disabled={isGen || !config.smart_link}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        {isGen
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating...</>
                          : <><Zap className="w-3.5 h-3.5" />Generate Otomatis</>}
                      </Button>
                      {existing.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Generate ulang akan menghapus {existing.length} iklan lama paket ini.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Manual Ad Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
            <DialogTitle>{editAd ? "Edit Iklan" : "Tambah Iklan Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1">
            <div className="space-y-2"><Label>Judul Iklan</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Promo Belanja Online" /></div>
            <div className="space-y-2"><Label>URL Tujuan</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>URL Gambar (opsional)</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2">
              <Label>Paket</Label>
              <Select value={form.plan_id} onValueChange={v => setForm({ ...form, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih paket..." /></SelectTrigger>
                <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>CPC Rate (IDR)</Label><Input type="number" value={form.cpc_rate} onChange={e => setForm({ ...form, cpc_rate: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />Durasi (detik)</Label>
                <Input type="number" min={5} max={300} value={form.view_duration} onChange={e => setForm({ ...form, view_duration: parseInt(e.target.value) || 30 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Budget Harian</Label><Input type="number" value={form.daily_budget} onChange={e => setForm({ ...form, daily_budget: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Total Budget</Label><Input type="number" value={form.total_budget} onChange={e => setForm({ ...form, total_budget: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as Ad["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="paused">Dijeda</SelectItem>
                  <SelectItem value="ended">Berakhir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-border bg-card shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1"><X className="w-4 h-4 mr-2" />Batal</Button>
            <Button onClick={handleSave} disabled={saveLoading} className="flex-1"><Save className="w-4 h-4 mr-2" />{saveLoading ? "Menyimpan..." : editAd ? "Perbarui" : "Buat Iklan"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Iklan?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdsManagePage;
