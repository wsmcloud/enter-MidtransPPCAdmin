import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { TrendingUp, Eye, EyeOff, Mail, Lock, User, Phone, Gift, MailCheck, ArrowLeft, Loader2 } from "lucide-react";
import { isAllowedEmailDomain, ALLOWED_EMAIL_DOMAINS_LABEL } from "@/lib/emailDomains";

type Step = "form" | "otp";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refCode = searchParams.get("ref") || "";
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const startResendCountdown = () => {
    setResendCountdown(60);
    const timer = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
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
      },
    });

    if (error) {
      toast({ title: "Registrasi gagal", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({
      title: "Kode OTP terkirim",
      description: `Cek email ${form.email} untuk kode verifikasi.`,
    });
    setStep("otp");
    startResendCountdown();
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast({ title: "Masukkan 6 digit kode OTP", variant: "destructive" });
      return;
    }

    setVerifying(true);

    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token: otp,
      type: "signup",
    });

    if (error) {
      toast({
        title: "Verifikasi gagal",
        description: "Kode OTP salah atau sudah kadaluwarsa.",
        variant: "destructive",
      });
      setOtp("");
      setVerifying(false);
      return;
    }

    toast({ title: "Akun berhasil diaktifkan!", description: "Selamat datang!" });
    navigate("/dashboard");
  };

  const handleResendOTP = async () => {
    if (resendCountdown > 0) return;
    setResending(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: form.email,
    });

    if (error) {
      toast({ title: "Gagal kirim ulang", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Kode OTP baru terkirim", description: `Cek email ${form.email}` });
      startResendCountdown();
    }
    setResending(false);
  };

  // ===== Step: OTP Verification =====
  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Verifikasi Email</h2>
              <p className="text-sm text-muted-foreground">
                Masukkan 6 digit kode OTP yang dikirim ke
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{form.email}</p>
            </div>

            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-11 h-12 text-lg" />
                    <InputOTPSlot index={1} className="w-11 h-12 text-lg" />
                    <InputOTPSlot index={2} className="w-11 h-12 text-lg" />
                    <InputOTPSlot index={3} className="w-11 h-12 text-lg" />
                    <InputOTPSlot index={4} className="w-11 h-12 text-lg" />
                    <InputOTPSlot index={5} className="w-11 h-12 text-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button type="submit" className="w-full" disabled={verifying || otp.length !== 6}>
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memverifikasi...</>
                ) : (
                  "Aktifkan Akun"
                )}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">Tidak menerima kode? </span>
                {resendCountdown > 0 ? (
                  <span className="text-muted-foreground">Kirim ulang dalam {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resending}
                    className="text-primary font-medium hover:underline"
                  >
                    {resending ? "Mengirim..." : "Kirim ulang"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => { setStep("form"); setOtp(""); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ganti email
              </button>
            </form>

            <div className="mt-5 bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                <strong>Tips:</strong> Cek folder <strong>Spam/Promosi</strong> jika tidak menemukan email. Kode berlaku selama 1 jam.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Step: Form =====
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

        {refCode && (
          <div className="mb-4 bg-green-500/10 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
            <Gift className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-400">
              Anda diundang dengan kode referral <strong>{refCode.toUpperCase()}</strong>
            </p>
          </div>
        )}

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
              {loading ? "Memproses..." : "Daftar & Kirim OTP"}
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
