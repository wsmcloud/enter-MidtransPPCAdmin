import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Eye, EyeOff, Mail, Lock, User, Phone, Gift, MailCheck } from "lucide-react";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS_LABEL } from "@/lib/emailDomains";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAllowedEmailDomain(form.email)) {
      toast({
        title: "Domain email tidak diizinkan",
        description: `Hanya email ${ALLOWED_EMAIL_DOMAINS_LABEL} yang dapat digunakan untuk registrasi.`,
        variant: "destructive",
      });
      return;
    }

    if (form.password !== form.confirm_password) {
      toast({ title: "Password tidak cocok", variant: "destructive" });
      return;
    }

    if (form.password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          ref_code: refCode.toUpperCase() || null,
        },
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });

    if (error) {
      toast({ title: "Registrasi gagal", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl p-8 shadow-card border border-border text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Verifikasi Email Anda</h2>
            <p className="text-sm text-muted-foreground mb-1">Kami telah mengirim link verifikasi ke:</p>
            <p className="font-semibold text-foreground mb-4">{form.email}</p>
            <div className="bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-5 text-left">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>Penting:</strong> Akun belum aktif. Buka email Anda dan klik link verifikasi untuk mengaktifkan akun. Cek folder <strong>Spam/Promosi</strong> jika tidak ada di inbox.
              </p>
            </div>
            <Button onClick={() => navigate("/login")} className="w-full">
              Ke Halaman Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Buat Akun Baru</h1>
          <p className="text-muted-foreground text-sm mt-1">Bergabung dan mulai hasilkan uang</p>
        </div>

        {/* Referral Banner */}
        {refCode && (
          <div className="mb-4 bg-green-500/10 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Anda diundang dengan kode referral <strong>{refCode.toUpperCase()}</strong>
            </p>
          </div>
        )}

        {/* Card */}
        <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input name="full_name" id="full_name" placeholder="John Doe" value={form.full_name} onChange={handleChange} className="pl-10" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input name="email" id="email" type="email" placeholder="email@gmail.com" value={form.email} onChange={handleChange} className="pl-10" required />
              </div>
              <p className="text-[11px] text-muted-foreground">Hanya {ALLOWED_EMAIL_DOMAINS_LABEL} yang diizinkan.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input name="phone" id="phone" placeholder="08xxxxxxxxxx" value={form.phone} onChange={handleChange} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  name="password" id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 karakter"
                  value={form.password} onChange={handleChange}
                  className="pl-10 pr-10" required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input name="confirm_password" id="confirm_password" type="password" placeholder="Ulangi password" value={form.confirm_password} onChange={handleChange} className="pl-10" required />
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Memproses..." : "Daftar Sekarang"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
