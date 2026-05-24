import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpFromLine, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

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

const WithdrawalsPage: React.FC = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<WithdrawReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<WithdrawReq | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase.from("withdrawal_requests").select("*, profiles(full_name, email, balance)").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setRequests(data as unknown as WithdrawReq[]);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [filter]);

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

    // Restore balance
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", rejectDialog.user_id).single();
    if (profile) {
      await supabase.from("profiles").update({ balance: (profile.balance || 0) + rejectDialog.amount }).eq("id", rejectDialog.user_id);
    }

    await supabase.from("withdrawal_requests").update({ status: "rejected", admin_notes: adminNotes || null, processed_at: new Date().toISOString() }).eq("id", rejectDialog.id);
    await supabase.from("transactions").update({ status: "failed" }).eq("user_id", rejectDialog.user_id).eq("type", "withdrawal").eq("status", "pending");

    // Send rejection notification email
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
          <p className="text-muted-foreground text-sm mt-1">Proses permintaan penarikan dana pengguna.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRequests}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

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
