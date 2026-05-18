import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { History, ArrowDownToLine, ArrowUpFromLine, MousePointerClick, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "commission";
  amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

const PAGE_SIZE = 15;

const TransactionsPage: React.FC = () => {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<"all" | "deposit" | "withdrawal" | "commission">("all");

  useEffect(() => {
    setPage(0);
    setTransactions([]);
  }, [filter]);

  useEffect(() => {
    fetchTransactions();
  }, [profile?.id, page, filter]);

  const fetchTransactions = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filter !== "all") query = query.eq("type", filter);

    const { data } = await query;
    if (data) {
      if (page === 0) setTransactions(data as Transaction[]);
      else setTransactions(prev => [...prev, ...(data as Transaction[])]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoading(false);
  };

  const typeIcon = (type: string) => {
    if (type === "deposit") return <ArrowDownToLine className="w-4 h-4 text-green-500" />;
    if (type === "withdrawal") return <ArrowUpFromLine className="w-4 h-4 text-amber-500" />;
    return <MousePointerClick className="w-4 h-4 text-primary" />;
  };

  const typeLabel = (type: string) => {
    if (type === "deposit") return "Deposit";
    if (type === "withdrawal") return "Penarikan";
    return "Komisi Klik";
  };

  const statusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Berhasil</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-xs"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><XCircle className="w-3 h-3 mr-1" />Gagal</Badge>;
  };

  const amountColor = (type: string) => {
    if (type === "withdrawal") return "text-destructive";
    return "text-green-600";
  };

  const amountPrefix = (type: string) => type === "withdrawal" ? "-" : "+";

  const filters = [
    { key: "all", label: "Semua" },
    { key: "commission", label: "Komisi" },
    { key: "deposit", label: "Deposit" },
    { key: "withdrawal", label: "Penarikan" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Riwayat Transaksi</h2>
        <p className="text-muted-foreground text-sm mt-1">Semua aktivitas keuangan akun Anda.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:border-primary/50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="flex items-center gap-2 p-5 border-b border-border">
          <History className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Transaksi</h3>
        </div>
        <div className="divide-y divide-border">
          {loading && transactions.length === 0 ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/30 m-3 rounded-lg animate-pulse" />)
          ) : transactions.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Belum ada transaksi</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-start justify-between px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                    ${tx.type === "deposit" ? "bg-green-500/10" : tx.type === "withdrawal" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                    {typeIcon(tx.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{typeLabel(tx.type)}</p>
                    {tx.notes && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{tx.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${amountColor(tx.type)}`}>
                    {amountPrefix(tx.type)}{formatIDR(tx.amount)}
                  </p>
                  <div className="mt-1">{statusBadge(tx.status)}</div>
                </div>
              </div>
            ))
          )}
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

export default TransactionsPage;
