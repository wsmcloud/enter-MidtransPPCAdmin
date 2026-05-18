import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Edit2, Trash2, Save, X, Play, Pause, Timer } from "lucide-react";
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
  status: "active" | "paused" | "ended";
  created_at: string;
}

const emptyForm = { title: "", description: "", url: "", image_url: "", cpc_rate: 500, daily_budget: 100000, total_budget: 1000000, view_duration: 30, status: "active" as const };

const AdsManagePage: React.FC = () => {
  const { toast } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAd, setEditAd] = useState<Ad | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchAds = async () => {
    setLoading(true);
    const { data } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
    setAds(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAds(); }, []);

  const openCreate = () => { setEditAd(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (ad: Ad) => {
    setEditAd(ad);
    setForm({ title: ad.title, description: ad.description || "", url: ad.url, image_url: ad.image_url || "", cpc_rate: ad.cpc_rate, daily_budget: ad.daily_budget, total_budget: ad.total_budget, view_duration: ad.view_duration || 30, status: ad.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.url) { toast({ title: "Judul dan URL wajib diisi", variant: "destructive" }); return; }
    setSaveLoading(true);
    const payload = { ...form, image_url: form.image_url || null, description: form.description || null };

    if (editAd) {
      const { error } = await supabase.from("ads").update(payload).eq("id", editAd.id);
      if (error) toast({ title: "Gagal menyimpan", variant: "destructive" });
      else { toast({ title: "Iklan diperbarui" }); setDialogOpen(false); fetchAds(); }
    } else {
      const { error } = await supabase.from("ads").insert(payload);
      if (error) toast({ title: "Gagal membuat iklan", variant: "destructive" });
      else { toast({ title: "Iklan berhasil dibuat" }); setDialogOpen(false); fetchAds(); }
    }
    setSaveLoading(false);
  };

  const toggleStatus = async (ad: Ad) => {
    const newStatus = ad.status === "active" ? "paused" : "active";
    await supabase.from("ads").update({ status: newStatus }).eq("id", ad.id);
    toast({ title: `Iklan ${newStatus === "active" ? "diaktifkan" : "dijeda"}` });
    fetchAds();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("ads").delete().eq("id", deleteId);
    toast({ title: "Iklan dihapus" });
    setDeleteId(null);
    fetchAds();
  };

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-green-500/10 text-green-600 border-green-200">Aktif</Badge>;
    if (status === "paused") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Dijeda</Badge>;
    return <Badge className="bg-muted text-muted-foreground">Berakhir</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manajemen Iklan</h2>
          <p className="text-muted-foreground text-sm mt-1">Kelola semua iklan yang tersedia di platform.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Tambah Iklan</Button>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Iklan</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">CPC</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Timer</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Budget</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Terpakai</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Dibuat</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(4)].map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
              ) : ads.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Belum ada iklan</td></tr>
              ) : (
                ads.map(ad => (
                  <tr key={ad.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {ad.image_url ? (
                          <img src={ad.image_url} alt={ad.title} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                            <Megaphone className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{ad.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{ad.url}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-green-600">{formatIDR(ad.cpc_rate)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                        <Timer className="w-3 h-3 text-primary" />{ad.view_duration || 30}s
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-foreground">{formatIDR(ad.total_budget)}</td>
                    <td className="px-5 py-4 text-right text-muted-foreground">{formatIDR(ad.spent_budget)}</td>
                    <td className="px-5 py-4 text-center">{statusBadge(ad.status)}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(ad.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toggleStatus(ad)}>
                          {ad.status === "active" ? <Pause className="w-3.5 h-3.5 text-amber-500" /> : <Play className="w-3.5 h-3.5 text-green-500" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(ad)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editAd ? "Edit Iklan" : "Tambah Iklan Baru"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Judul Iklan</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Contoh: Promo Belanja Online" /></div>
            <div className="space-y-2"><Label>URL Tujuan</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>URL Gambar (opsional)</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." /></div>
            <div className="space-y-2"><Label>Deskripsi</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>CPC Rate (IDR)</Label><Input type="number" value={form.cpc_rate} onChange={e => setForm({ ...form, cpc_rate: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />Durasi Tonton (detik)</Label>
                <Input type="number" min={5} max={300} value={form.view_duration} onChange={e => setForm({ ...form, view_duration: parseInt(e.target.value) || 30 })} placeholder="30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Budget Harian (IDR)</Label><Input type="number" value={form.daily_budget} onChange={e => setForm({ ...form, daily_budget: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Total Budget (IDR)</Label><Input type="number" value={form.total_budget} onChange={e => setForm({ ...form, total_budget: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={saveLoading} className="flex-1"><Save className="w-4 h-4 mr-2" />{saveLoading ? "Menyimpan..." : editAd ? "Perbarui" : "Buat Iklan"}</Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Iklan?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdsManagePage;
