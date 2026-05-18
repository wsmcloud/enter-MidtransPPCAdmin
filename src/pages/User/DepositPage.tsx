import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { ArrowDownToLine, CreditCard, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess?: (r: unknown) => void;
        onPending?: (r: unknown) => void;
        onError?: (r: unknown) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

interface Transaction {
  id: string;
  amount: number;
  status: string;
  midtrans_order_id: string | null;
  created_at: string;
}

const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 250000, 500000];

const DepositPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const snapScriptRef = useRef<HTMLScriptElement | null>(null);

  const loadSnapScript = (clientKey: string, isProduction: boolean) => {
    // Remove existing snap script if present
    if (snapScriptRef.current) {
      snapScriptRef.current.remove();
    }
    const script = document.createElement("script");
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    document.head.appendChild(script);
    snapScriptRef.current = script;
  };

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "finish") toast({ title: "Pembayaran diproses", description: "Saldo akan dikreditkan setelah konfirmasi." });
    if (status === "error") toast({ title: "Pembayaran gagal", variant: "destructive" });
    if (status === "pending") toast({ title: "Pembayaran pending", description: "Selesaikan pembayaran Anda." });

    return () => {
      if (snapScriptRef.current) snapScriptRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (profile?.id) fetchTransactions();
  }, [profile?.id]);

  const fetchTransactions = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from("transactions")
      .select("id, amount, status, midtrans_order_id, created_at")
      .eq("user_id", profile.id)
      .eq("type", "deposit")
      .order("created_at", { ascending: false })
      .limit(10);
    setTransactions(data || []);
    setTxLoading(false);
  };

  const handleDeposit = async () => {
    const numAmount = parseInt(amount);
    if (!numAmount || numAmount < 10000) {
      toast({ title: "Minimum deposit Rp 10.000", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("midtrans-create-transaction", {
        body: { amount: numAmount },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      if (error || !data?.token) {
        throw new Error(data?.error || "Gagal membuat transaksi");
      }

      // Load Snap with the client key from backend
      loadSnapScript(data.client_key, data.is_production);

      // Wait for snap to load
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (window.snap) {
        window.snap.pay(data.token, {
          onSuccess: () => {
            toast({ title: "Pembayaran berhasil!" });
            fetchTransactions();
            refreshProfile();
          },
          onPending: () => {
            toast({ title: "Pembayaran pending", description: "Selesaikan pembayaran Anda." });
            fetchTransactions();
          },
          onError: () => {
            toast({ title: "Pembayaran gagal", variant: "destructive" });
          },
          onClose: () => {
            fetchTransactions();
          },
        });
      } else {
        window.location.href = data.redirect_url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast({ title: "Gagal", description: message, variant: "destructive" });
    }

    setLoading(false);
  };

  const statusBadge = (status: string) => {
    if (status === "success") return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Berhasil</Badge>;
    if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><XCircle className="w-3 h-3 mr-1" />Gagal</Badge>;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Deposit Saldo</h2>
        <p className="text-muted-foreground text-sm mt-1">Tambah saldo akun Anda menggunakan berbagai metode pembayaran.</p>
      </div>

      {/* Deposit Form */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Buat Deposit</h3>
            <p className="text-xs text-muted-foreground">Minimum Rp 10.000 via Midtrans</p>
          </div>
        </div>

        {/* Quick Select */}
        <div className="mb-4">
          <Label className="text-sm mb-2 block">Pilih Nominal</Label>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${amount === String(a) ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-foreground"}`}
              >
                {formatIDR(a)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <Label htmlFor="amount">Atau masukkan nominal</Label>
          <Input
            id="amount"
            type="number"
            placeholder="Contoh: 50000"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={10000}
          />
        </div>

        <Button onClick={handleDeposit} disabled={loading || !amount} className="w-full">
          <ArrowDownToLine className="w-4 h-4 mr-2" />
          {loading ? "Memproses..." : `Deposit ${amount ? formatIDR(parseInt(amount)) : ""}`}
        </Button>

        <div className="mt-4 p-3 rounded-lg bg-muted flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">Saldo akan otomatis dikreditkan setelah pembayaran berhasil dikonfirmasi oleh sistem.</p>
        </div>
      </div>

      {/* History */}
      <div className="bg-card rounded-2xl border border-border shadow-card">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Riwayat Deposit</h3>
        </div>
        <div className="divide-y divide-border">
          {txLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Memuat...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Belum ada riwayat deposit</div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{formatIDR(tx.amount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                </div>
                {statusBadge(tx.status)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DepositPage;
