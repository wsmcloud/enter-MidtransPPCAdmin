import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpFromLine, CheckCircle, Clock, XCircle, RefreshCw, Sparkles, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const INDO_NAMES = [
  "Budi Santoso", "Siti Rahayu", "Ahmad Fauzi", "Dewi Lestari", "Eko Prasetyo",
  "Fitriani Sari", "Gunawan", "Hesti Wulandari", "Irawan Putra", "Joko Susilo",
  "Kartika Sari", "Lilis Suryani", "Muhammad Rizki", "Novi Andriani", "Oktavia",
  "Putra Wijaya", "Rudi Hartono", "Sri Wahyuni", "Teguh Santoso", "Umar Bakri",
  "Vera Sari", "Wulandari", "Yusuf Pratama", "Zulkifli", "Anita Permatasari",
  "Bambang Sudiro", "Citra Dewi", "Dian Pratiwi", "Edi Susanto", "Fajar Nugroho",
  "Gita Safitri", "Hendra", "Indah Sari", "Kurniawan", "Laila Fitri",
  "Muhamad Iqbal", "Nadia Amelia", "Rachmat", "Selviana", "Wahyu Nugraha",
  "Yanti Kusuma", "Zahra Maulida", "Aldi Firmansyah", "Bella Anastasia", "Doni Setiawan",
  "Eka Susanti", "Faisal Rahman", "Hasna Putri", "Irma Yanti", "Jihan Fadila",
];

const AMOUNTS = [15000, 20000, 25000, 30000, 50000, 75000, 100000, 150000, 200000, 250000, 300000, 500000];

interface WithdrawReq {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  profiles: { full_name: string; email: string; balance: number } | null;
}

interface FakeWd {
  id: string;
  name: string;
  amount: number;
  created_at: string;
}

const WithdrawalsPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"real" | "fake">("real");

  // Real WD state
  const [requests, setRequests] = useState<WithdrawReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<WithdrawReq | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Fake WD state
  const [fakeWds, setFakeWds] = useState<FakeWd[]>([]);
  const [fakeLoading, setFakeLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase.from("withdrawal_requests").select("*, profiles(full_name, email, balance)").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setRequests(data as unknown as WithdrawReq[]);
    setLoading(false);
  };

  const fetchFakeWds = async () => {
    setFakeLoading(true);
    const { data } = await supabase.from("fake_withdrawals").select("*").order("created_at", { ascending: false });
    setFakeWds(data || []);
    setFakeLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [filter]);
  useEffect(() => { fetchFakeWds(); }, []);

  const generateFakeWds = async () => {
    setGenerating(true);
    const used = new Set<string>();
    const rows = Array.from({ length: 10 }, () => {
      let name: string;
      do { name = INDO_NAMES[Math.floor(Math.random() * INDO_NAMES.length)]; } while (used.has(name) && used.size < INDO_NAMES.length);
      used.add(name);
      const amount = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
      // Spread created_at over last 48 hours for realism
      const minsAgo = Math.floor(Math.random() * 48 * 60);
      const created_at = new Date(Date.now() - minsAgo * 60 * 1000).toISOString();
      return { name, amount, created_at };
    });

    const { error } = await supabase.from("fake_withdrawals").insert(rows);
    if (error) {
      toast({ title: "Gagal generate", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "10 data fake WD berhasil dibuat!" });
      fetchFakeWds();
    }
    setGenerating(false);
  };

  const deleteFakeWd = async (id: string) => {
    await supabase.from("fake_withdrawals").delete().eq("id", id);
    setFakeWds(prev => prev.filter(w => w.id !== id));
    toast({ title: "Data dihapus" });
  };

  const deleteAllFakeWds = async () => {
    const ids = fakeWds.map(w => w.id);
    if (ids.length === 0) return;
    await supabase.from("fake_withdrawals").delete().in("id", ids);
    setFakeWds([]);
    toast({ title: "Semua data fake WD dihapus" });
  };

  const approveRequest = async (req: WithdrawReq) => {
    setProcessingId(req.id);

    await supabase.from("withdrawal_requests").update({ status: "approved", processed_at: new Date().toISOString() }).eq("id", req.id);
    await supabase.from("transactions").update({ status: "success" }).eq("user_id", req.user_id).eq("type", "withdrawal").eq("status", "pending");

    // Send approval notification email
    if (req.profiles?.email) {
      supabase.functions.invoke("send-email", {
        body: {
          to: req.profiles.email,
          toName: req.profiles.full_name,
          subject: "Penarikan Dana Disetujui - IklanCuan",
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
              <div style="background:linear-gradient(135deg,#22c55e,#16a34a);padding:32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">Penarikan Disetujui!</h1>
                <p style="color:#dcfce7;margin:8px 0 0;font-size:14px;">IklanCuan</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#374151;font-size:16px;margin:0 0 16px;">Halo <strong>${req.profiles.full_name}</strong>,</p>
                <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  Permintaan penarikan dana Anda telah <strong style="color:#16a34a;">disetujui</strong>. Dana akan segera dikirim ke rekening yang terdaftar.
                </p>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:0 0 16px;">
                  <table style="width:100%;font-size:14px;">
                    <tr><td style="color:#6b7280;padding:4px 0;">Jumlah</td><td style="text-align:right;font-weight:bold;color:#16a34a;">Rp ${req.amount.toLocaleString("id-ID")}</td></tr>
                    <tr><td style="color:#6b7280;padding:4px 0;">Bank</td><td style="text-align:right;font-weight:bold;color:#374151;">${req.bank_name}</td></tr>
                    <tr><td style="color:#6b7280;padding:4px 0;">No. Rekening</td><td style="text-align:right;font-weight:bold;color:#374151;">${req.account_number}</td></tr>
                    <tr><td style="color:#6b7280;padding:4px 0;">Atas Nama</td><td style="text-align:right;font-weight:bold;color:#374151;">${req.account_holder}</td></tr>
                  </table>
                </div>
                <p style="color:#9ca3af;font-size:13px;margin:0;">Proses transfer mungkin membutuhkan 1-3 hari kerja tergantung kebijakan bank.</p>
              </div>
              <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">IklanCuan &mdash; otp@iklancuan.com</p>
              </div>
            </div>
          `,
        },
      }).catch(console.error);
    }

    toast({ title: `Penarikan ${formatIDR(req.amount)} disetujui` });
    fetchRequests();
    setProcessingId(null);
  };

  const rejectRequest = async () => {
    if (!rejectDialog) return;
    setProcessingId(rejectDialog.id);

    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", rejectDialog.user_id).single();
    if (profile) {
      await supabase.from("profiles").update({ balance: (profile.balance || 0) + rejectDialog.amount }).eq("id", rejectDialog.user_id);
    }

    await supabase.from("withdrawal_requests").update({ status: "rejected", admin_notes: adminNotes || null, processed_at: new Date().toISOString() }).eq("id", rejectDialog.id);
    await supabase.from("transactions").update({ status: "failed" }).eq("user_id", rejectDialog.user_id).eq("type", "withdrawal").eq("status", "pending");

    if (rejectDialog.profiles?.email) {
      supabase.functions.invoke("send-email", {
        body: {
          to: rejectDialog.profiles.email,
          toName: rejectDialog.profiles.full_name,
          subject: "Informasi Penarikan Dana - IklanCuan",
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
              <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">Penarikan Ditolak</h1>
                <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">IklanCuan</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#374151;font-size:16px;margin:0 0 16px;">Halo <strong>${rejectDialog.profiles.full_name}</strong>,</p>
                <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
                  Permintaan penarikan dana Anda sebesar <strong>Rp ${rejectDialog.amount.toLocaleString("id-ID")}</strong> tidak dapat diproses.
                </p>
                ${adminNotes ? `
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
                  <p style="color:#991b1b;font-size:13px;margin:0;font-weight:bold;">Alasan:</p>
                  <p style="color:#dc2626;font-size:14px;margin:4px 0 0;">${adminNotes}</p>
                </div>
                ` : ""}
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;">
                  <p style="color:#16a34a;font-size:13px;margin:0;">Saldo Anda telah dikembalikan ke akun. Anda dapat mengajukan penarikan kembali setelah memperbarui data rekening.</p>
                </div>
              </div>
              <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">IklanCuan &mdash; otp@iklancuan.com</p>
              </div>
            </div>
          `,
        },
      }).catch(console.error);
    }

    toast({ title: "Penarikan ditolak dan saldo dikembalikan" });
    setRejectDialog(null);
    setAdminNotes("");
    fetchRequests();
    setProcessingId(null);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Disetujui</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
  };

  const filters = [{ key: "all", label: "Semua" }, { key: "pending", label: "Menunggu" }, { key: "approved", label: "Disetujui" }, { key: "rejected", label: "Ditolak" }] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kelola Penarikan</h2>
          <p className="text-muted-foreground text-sm mt-1">Proses penarikan & kelola feed sosial proof.</p>
        </div>
        <Button variant="outline" size="sm" onClick={activeTab === "real" ? fetchRequests : fetchFakeWds}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("real")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${activeTab === "real" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:border-primary/50"}`}
        >
          Penarikan Real
        </button>
        <button
          onClick={() => setActiveTab("fake")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === "fake" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:border-primary/50"}`}
        >
          <Sparkles className="w-3.5 h-3.5" />Fake Feed
          {fakeWds.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "fake" ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
              {fakeWds.length}
            </span>
          )}
        </button>
      </div>

      {/* ===== REAL WD TAB ===== */}
      {activeTab === "real" && (
        <>
          <div className="flex gap-2 flex-wrap">
            {filters.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:border-primary/50"}`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                    <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Jumlah</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Rekening</th>
                    <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tanggal</th>
                    <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    [...Array(4)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      <ArrowUpFromLine className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Tidak ada permintaan penarikan
                    </td></tr>
                  ) : (
                    requests.map(req => (
                      <tr key={req.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">{req.profiles?.full_name || "User"}</p>
                          <p className="text-xs text-muted-foreground">{req.profiles?.email}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-amber-600">{formatIDR(req.amount)}</td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-foreground">{req.bank_name}</p>
                          <p className="text-xs text-muted-foreground">{req.account_number} ({req.account_holder})</p>
                        </td>
                        <td className="px-5 py-4 text-center">{statusBadge(req.status)}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(req.created_at)}</td>
                        <td className="px-5 py-4">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-center gap-2">
                              <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-600" disabled={processingId === req.id} onClick={() => approveRequest(req)}>
                                <CheckCircle className="w-3 h-3 mr-1" />Setuju
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" disabled={processingId === req.id} onClick={() => { setRejectDialog(req); setAdminNotes(""); }}>
                                <XCircle className="w-3 h-3 mr-1" />Tolak
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground text-center block">{req.admin_notes || "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ===== FAKE FEED TAB ===== */}
      {activeTab === "fake" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">Generate Fake WD</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Buat 10 data penarikan acak untuk social proof di dashboard member.</p>
              </div>
              <div className="flex gap-2">
                {fakeWds.length > 0 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={deleteAllFakeWds}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />Hapus Semua
                  </Button>
                )}
                <Button size="sm" onClick={generateFakeWds} disabled={generating} className="h-8 text-xs">
                  {generating ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Generating...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate 10 Acak</>}
                </Button>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Data fake akan muncul di feed "Penarikan Member" di halaman dashboard pengguna bersama penarikan real. Nama akan di-masking otomatis.
              </p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
            <div className="border-b border-border px-5 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Daftar Fake WD ({fakeWds.length} entri)</p>
            </div>
            <div className="divide-y divide-border">
              {fakeLoading ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="px-5 py-3.5"><div className="h-4 bg-muted rounded animate-pulse" /></div>
                ))
              ) : fakeWds.length === 0 ? (
                <div className="py-12 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada fake WD. Klik "Generate 10 Acak" untuk mulai.</p>
                </div>
              ) : (
                fakeWds.map(w => (
                  <div key={w.id} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-amber-600">{w.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{w.name}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(w.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-amber-600">{formatIDR(w.amount)}</p>
                      <button onClick={() => deleteFakeWd(w.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!rejectDialog} onOpenChange={v => !v && setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tolak Penarikan</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Penarikan {rejectDialog && formatIDR(rejectDialog.amount)} oleh <strong>{rejectDialog?.profiles?.full_name}</strong> akan ditolak dan saldo dikembalikan.</p>
            <div className="space-y-2">
              <Label>Alasan Penolakan (opsional)</Label>
              <Input value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Contoh: Data rekening tidak valid" />
            </div>
            <div className="flex gap-3">
              <Button onClick={rejectRequest} className="flex-1 bg-destructive hover:bg-destructive/90" disabled={!!processingId}>Konfirmasi Tolak</Button>
              <Button variant="outline" onClick={() => setRejectDialog(null)}>Batal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WithdrawalsPage;
