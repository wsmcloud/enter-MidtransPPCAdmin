import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, MailWarning, Loader2, CheckCircle } from "lucide-react";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const verified = searchParams.get("verified") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (verified) {
      toast({
        title: "Email berhasil diverifikasi!",
        description: "Silakan login dengan akun Anda.",
      });
    }
  }, [verified, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsVerification(false);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Detect email not confirmed error
      const msg = error.message.toLowerCase();
      if (msg.includes("email") && (msg.includes("not confirmed") || msg.includes("not verified"))) {
        setNeedsVerification(true);
        toast({
          title: "Email belum diverifikasi",
          description: "Silakan cek email Anda dan klik link verifikasi.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Login gagal", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }

    // Extra safety: block if email not confirmed
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      setNeedsVerification(true);
      toast({
        title: "Email belum diverifikasi",
        description: "Akun Anda belum aktif. Silakan verifikasi email terlebih dahulu.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast({ title: "Masukkan email Anda terlebih dahulu", variant: "destructive" });
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login?verified=1` },
    });
    if (error) {
      toast({ title: "Gagal kirim ulang", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Email verifikasi terkirim",
        description: `Cek inbox/spam ${email}`,
      });
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Hero Banner */}
        <div className="mb-6">
          <img
            src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100054970/4396f677-a978-42.png"
            alt="IklanCuan - Klik Iklan Dapat Uang"
            crossOrigin="anonymous"
            className="w-full rounded-2xl object-cover shadow-lg"
          />
        </div>

        {verified && (
          <div className="mb-4 bg-green-500/10 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Email berhasil diverifikasi. Silakan login.
            </p>
          </div>
        )}

        {/* Card */}
        <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@contoh.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {needsVerification && (
              <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <MailWarning className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-semibold">Email belum diverifikasi</p>
                    <p className="mt-0.5">Akun belum aktif. Buka email Anda dan klik link verifikasi atau kirim ulang di bawah.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleResendVerification}
                  disabled={resending}
                >
                  {resending ? (
                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Mengirim ulang...</>
                  ) : (
                    "Kirim Ulang Email Verifikasi"
                  )}
                </Button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center text-sm">
            <div>
              <Link to="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
                Lupa password?
              </Link>
            </div>
            <p className="text-muted-foreground">
              Belum punya akun?{" "}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
