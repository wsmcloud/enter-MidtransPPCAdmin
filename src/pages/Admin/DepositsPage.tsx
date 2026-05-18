import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownToLine, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DepositTx {
  id: string;
  amount: number;
  status: string;
  midtrans_order_id: string | null;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  user_id: string;
}

const DepositsPage: React.FC = () => {
  const { toast } = useToast();
  const [deposits, setDeposits] = useState<DepositTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "success" | "failed">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDeposits = async () => {
    setLoading(true);
    let query = supabase.from("transactions").select("*, profiles(full_name, email)").eq("type", "deposit").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setDeposits(data as unknown as DepositTx[]);
    setLoading(false);
  };

  useEffect(() => { fetchDeposits(); }, [filter]);

  const approveDeposit = async (deposit: DepositTx) => {
    setProcessingId(deposit.id);

    // Update transaction to success
    await supabase.from("transactions").update({ status: "success" }).eq("id", deposit.id);

    // Add balance to user
    const { data: profile } = await supabase.from("profiles").select("balance").eq("id", deposit.user_id).single();
    if (profile) {
      const newBalance = (profile.balance || 0) + deposit.amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("id", deposit.user_id);
    }

    toast({ title: `Deposit ${formatIDR(deposit.amount)} disetujui` });
    fetchDeposits();
    setProcessingId(null);
  };

  const rejectDeposit = async (deposit: DepositTx) => {
    setProcessingId(deposit.id);
    await supabase.from("transactions").update({ status: "failed" }).eq("id", deposit.id);
    toast({ title: "Deposit ditolak" });
    fetchDeposits();
    setProcessingId(null);
  };

  const statusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Berhasil</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Gagal</Badge>;
  };

  const filters = [{ key: "all", label: "Semua" }, { key: "pending", label: "Menunggu" }, { key: "success", label: "Berhasil" }, { key: "failed", label: "Gagal" }] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kelola Deposit</h2>
          <p className="text-muted-foreground text-sm mt-1">Pantau dan konfirmasi deposit pengguna.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDeposits}>
          <RefreshCw className="w-4 h-4 mr-2" />Refresh
        </Button>
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
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Order ID</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tanggal</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(5)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
              ) : deposits.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  <ArrowDownToLine className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Tidak ada deposit
                </td></tr>
              ) : (
                deposits.map(d => (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-foreground">{d.profiles?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{d.profiles?.email}</p>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-green-600">{formatIDR(d.amount)}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground font-mono">{d.midtrans_order_id || "-"}</td>
                    <td className="px-5 py-4 text-center">{statusBadge(d.status)}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(d.created_at)}</td>
                    <td className="px-5 py-4">
                      {d.status === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" className="h-7 text-xs bg-green-500 hover:bg-green-600" disabled={processingId === d.id} onClick={() => approveDeposit(d)}>
                            <CheckCircle className="w-3 h-3 mr-1" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" disabled={processingId === d.id} onClick={() => rejectDeposit(d)}>
                            <XCircle className="w-3 h-3 mr-1" />Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center block">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DepositsPage;
