import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { History, ArrowDownToLine, ArrowUpFromLine, MousePointerClick, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

const PAGE_SIZE = 20;

const AdminTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "commission">("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async (reset = false) => {
    setLoading(true);
    const currentPage = reset ? 0 : page;

    let query = supabase.from("transactions").select("*, profiles(full_name, email)").order("created_at", { ascending: false }).range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);
    if (filter !== "all") query = query.eq("type", filter);

    const { data } = await query;
    const txs = data as unknown as Transaction[];

    if (reset || currentPage === 0) setTransactions(txs || []);
    else setTransactions(prev => [...prev, ...(txs || [])]);

    setHasMore((txs || []).length === PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => { setPage(0); fetchTransactions(true); }, [filter]);
  useEffect(() => { if (page > 0) fetchTransactions(); }, [page]);

  const typeIcon = (type: string) => {
    if (type === "deposit") return <ArrowDownToLine className="w-4 h-4 text-green-500" />;
    if (type === "withdrawal") return <ArrowUpFromLine className="w-4 h-4 text-amber-500" />;
    return <MousePointerClick className="w-4 h-4 text-primary" />;
  };

  const typeLabel: Record<string, string> = { deposit: "Deposit", withdrawal: "Penarikan", commission: "Komisi" };
  const typeColor = (type: string) => type === "withdrawal" ? "text-amber-600" : type === "deposit" ? "text-green-600" : "text-primary";

  const statusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Berhasil</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><XCircle className="w-3 h-3 mr-1" />Gagal</Badge>;
  };

  const filters = [{ key: "all", label: "Semua" }, { key: "commission", label: "Komisi" }, { key: "deposit", label: "Deposit" }, { key: "withdrawal", label: "Penarikan" }] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Semua Transaksi</h2>
          <p className="text-muted-foreground text-sm mt-1">Histori seluruh transaksi di platform.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTransactions(true)}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
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
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tipe</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Jumlah</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Keterangan</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && transactions.length === 0 ? (
                [...Array(6)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />Tidak ada transaksi
                </td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{tx.profiles?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground">{tx.profiles?.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">{typeIcon(tx.type)}<span className="text-foreground">{typeLabel[tx.type]}</span></div>
                    </td>
                    <td className={`px-5 py-3 text-right font-bold ${typeColor(tx.type)}`}>{formatIDR(tx.amount)}</td>
                    <td className="px-5 py-3 text-center">{statusBadge(tx.status)}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs truncate">{tx.notes || "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{formatDate(tx.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {hasMore && !loading && (
          <div className="p-4 text-center">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Muat lebih banyak</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransactionsPage;
