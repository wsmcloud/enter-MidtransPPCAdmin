import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpFromLine, Clock, CheckCircle, XCircle, AlertCircle, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface WithdrawRequest {
  id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

const BANKS = ["BCA", "BNI", "BRI", "Mandiri", "BSI", "CIMB Niaga", "Danamon", "Permata", "BTN", "OVO", "GoPay", "DANA"];

const MIN_WITHDRAW = 10000;
const WITHDRAW_FEE = 4500;

const WithdrawPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    amount: "",
    bank_name: "",
    account_number: "",
    account_holder: "",
  });
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(true);

  useEffect(() => { fetchRequests(); }, [profile?.id]);

  const fetchRequests = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setReqLoading(false);
  };

  const numAmount = parseInt(form.amount) || 0;
  const receivedAmount = numAmount > WITHDRAW_FEE ? numAmount - WITHDRAW_FEE : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numAmount || numAmount < MIN_WITHDRAW) {
      toast({ title: `Minimum penarikan ${formatIDR(MIN_WITHDRAW)}`, variant: "destructive" });
      return;
    }

    if (numAmount > (profile?.balance || 0)) {
      toast({ title: "Saldo tidak cukup", variant: "destructive" });
      return;
    }

    if (!form.bank_name || !form.account_number || !form.account_holder) {
      toast({ title: "Lengkapi semua data rekening", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("withdrawal_requests").insert({
      user_id: profile!.id,
      amount: receivedAmount,
      bank_name: form.bank_name,
      account_number: form.account_number,
      account_holder: form.account_holder,
    });

    if (error) {
      toast({ title: "Gagal mengajukan penarikan", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Deduct full amount (including fee) from balance
    await supabase.from("profiles").update({ balance: (profile!.balance || 0) - numAmount }).eq("id", profile!.id);
    await supabase.from("transactions").insert({
      user_id: profile!.id,
      type: "withdrawal",
      amount: numAmount,
      status: "pending",
      notes: `Penarikan ke ${form.bank_name} - ${form.account_number} (fee: ${formatIDR(WITHDRAW_FEE)})`,
    });

    toast({ title: "Pengajuan berhasil!", description: "Penarikan akan diproses otomatis oleh sistem mohon tunggu. Terimakasih." });
    setForm({ amount: "", bank_name: "", account_number: "", account_holder: "" });
    fetchRequests();
    refreshProfile();
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Disetujui</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tarik Dana</h2>
        <p className="text-muted-foreground text-sm mt-1">Cairkan saldo Anda ke rekening bank.</p>
      </div>

      {/* Balance Info */}
      <div className="bg-card rounded-2xl p-5 border border-border shadow-card">
        <p className="text-sm text-muted-foreground">Saldo tersedia</p>
        <p className="text-3xl font-bold text-foreground mt-1">{formatIDR(profile?.balance || 0)}</p>
      </div>

      {/* Withdraw Form */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Building className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Data Penarikan</h3>
            <p className="text-xs text-muted-foreground">Minimum {formatIDR(MIN_WITHDRAW)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Jumlah Penarikan (IDR)</Label>
            <Input
              type="number"
              placeholder={`Min ${formatIDR(MIN_WITHDRAW)}`}
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              min={MIN_WITHDRAW}
              max={profile?.balance || 0}
            />
            {numAmount >= MIN_WITHDRAW && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Jumlah penarikan</span>
                  <span>{formatIDR(numAmount)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Biaya admin</span>
                  <span>- {formatIDR(WITHDRAW_FEE)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5">
                  <span>Dana diterima</span>
                  <span className="text-green-600">{formatIDR(receivedAmount)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Bank / E-Wallet</Label>
            <Select value={form.bank_name} onValueChange={v => setForm({ ...form, bank_name: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih bank" /></SelectTrigger>
              <SelectContent>
                {BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nomor Rekening</Label>
            <Input
              placeholder="Contoh: 1234567890"
              value={form.account_number}
              onChange={e => setForm({ ...form, account_number: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Nama Pemilik Rekening</Label>
            <Input
              placeholder="Sesuai buku tabungan"
              value={form.account_holder}
              onChange={e => setForm({ ...form, account_holder: e.target.value })}
            />
          </div>

          <div className="p-3 rounded-lg bg-muted flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Penarikan akan diproses otomatis oleh sistem mohon tunggu. Terimakasih.</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            <ArrowUpFromLine className="w-4 h-4 mr-2" />
            {loading ? "Memproses..." : "Ajukan Penarikan"}
          </Button>
        </form>
      </div>

      {/* History */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Riwayat Penarikan</h3>
        </div>
        <div className="divide-y divide-border">
          {reqLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Memuat...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Belum ada riwayat penarikan</div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="px-5 py-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-foreground">{formatIDR(req.amount)}</p>
                  {statusBadge(req.status)}
                </div>
                <p className="text-xs text-muted-foreground">{req.bank_name} - {req.account_number} ({req.account_holder})</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(req.created_at)}</p>
                {req.admin_notes && <p className="text-xs text-destructive mt-1">Catatan: {req.admin_notes}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default WithdrawPage;
