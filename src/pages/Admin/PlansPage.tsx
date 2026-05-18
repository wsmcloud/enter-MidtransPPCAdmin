import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Edit2, Trash2, Save, X, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

const emptyForm = { name: "", price: 0, daily_clicks_limit: 10, commission_per_click: 500, duration_days: 30, description: "", is_active: true };

const PlansPage: React.FC = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("price");
    setPlans(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setForm({ name: plan.name, price: plan.price, daily_clicks_limit: plan.daily_clicks_limit, commission_per_click: plan.commission_per_click, duration_days: plan.duration_days || 30, description: plan.description || "", is_active: plan.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast({ title: "Nama plan wajib diisi", variant: "destructive" }); return; }
    setSaveLoading(true);

    if (editPlan) {
      const { error } = await supabase.from("plans").update(form).eq("id", editPlan.id);
      if (error) toast({ title: "Gagal menyimpan", variant: "destructive" });
      else { toast({ title: "Plan berhasil diperbarui" }); setDialogOpen(false); fetchPlans(); }
    } else {
      const { error } = await supabase.from("plans").insert(form);
      if (error) toast({ title: "Gagal membuat plan", variant: "destructive" });
      else { toast({ title: "Plan berhasil dibuat" }); setDialogOpen(false); fetchPlans(); }
    }
    setSaveLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("plans").delete().eq("id", deleteId);
    if (error) toast({ title: "Gagal menghapus", variant: "destructive" });
    else { toast({ title: "Plan dihapus" }); fetchPlans(); }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manajemen Paket</h2>
          <p className="text-muted-foreground text-sm mt-1">Kelola paket membership untuk pengguna.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Tambah Paket</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-card rounded-2xl p-5 border border-border shadow-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                </div>
                {plan.is_active
                  ? <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
                  : <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><XCircle className="w-3 h-3 mr-1" />Nonaktif</Badge>
                }
              </div>

              <p className="text-2xl font-bold text-foreground mb-1">{plan.price === 0 ? "Gratis" : formatIDR(plan.price)}</p>
              {plan.price > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  {plan.duration_days > 0 ? `untuk ${plan.duration_days} hari` : "tanpa batas waktu"}
                </p>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Durasi aktif</span>
                  <span className="font-medium text-foreground">
                    {plan.duration_days > 0 ? `${plan.duration_days} hari` : "Selamanya"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Klik per hari</span>
                  <span className="font-medium text-foreground">{plan.daily_clicks_limit}x</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Komisi per klik</span>
                  <span className="font-medium text-green-600">{formatIDR(plan.commission_per_click)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Potensi/hari</span>
                  <span className="font-medium text-foreground">{formatIDR(plan.daily_clicks_limit * plan.commission_per_click)}</span>
                </div>
              </div>

              {plan.description && <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(plan)}>
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(plan.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editPlan ? "Edit Paket" : "Tambah Paket Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nama Paket</Label>
              <Input placeholder="Contoh: Basic" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Harga (IDR, 0 = Gratis)</Label>
              <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Max Klik/Hari</Label>
                <Input type="number" value={form.daily_clicks_limit} onChange={e => setForm({ ...form, daily_clicks_limit: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Komisi/Klik (IDR)</Label>
                <Input type="number" value={form.commission_per_click} onChange={e => setForm({ ...form, commission_per_click: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durasi Sewa Paket (hari)</Label>
              <Input
                type="number"
                min={0}
                value={form.duration_days}
                onChange={e => setForm({ ...form, duration_days: parseInt(e.target.value) || 0 })}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">Isi 0 untuk paket tanpa batas waktu (selamanya).</p>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea placeholder="Deskripsi paket..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="active_toggle">Status Aktif</Label>
              <button
                id="active_toggle"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className={`w-11 h-6 rounded-full transition-colors ${form.is_active ? "bg-primary" : "bg-muted"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_active ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={handleSave} disabled={saveLoading} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {saveLoading ? "Menyimpan..." : editPlan ? "Perbarui" : "Buat Paket"}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Paket?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlansPage;
