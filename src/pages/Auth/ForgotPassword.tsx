import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { KeyRound, Mail, Lock, Eye, EyeOff, MailCheck, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

type Step = "email" | "otp" | "success";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.functions.invoke("request-password-reset", {
      body: { email },
    });

    if (error) {
      toast({ title: "Gagal mengirim kode", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    toast({ title: "Kode OTP terkirim", description: `Cek email ${email} untuk kode reset password.` });
    setStep("otp");
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast({ title: "Masukkan 6 digit kode OTP", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Password tidak cocok", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { error } = await supabase.functions.invoke("reset-password", {
      body: { email, otp, new_password: newPassword },
    });

    if (error) {
      toast({ title: "Reset password gagal", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setStep("success");
    setLoading(false);
  };

  // ===== Step: Success =====
  if (step === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl p-8 shadow-card border border-border text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Password Berhasil Direset!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Password akun Anda telah diperbarui. Silakan login dengan password baru.
            </p>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Masuk Sekarang
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Step: OTP + New Password =====
  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-1">Masukkan Kode OTP</h2>
              <p className="text-sm text-muted-foreground">Kode dikirim ke</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{email}</p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
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

              <div className="space-y-2">
                <Label>Password Baru</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 karakter"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
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

              <div className="space-y-2">
                <Label>Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</>
                ) : (
                  "Reset Password"
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setStep("email"); setOtp(""); }}
                className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Ganti email
              </button>
            </form>

            <div className="mt-5 bg-amber-500/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                <strong>Tips:</strong> Cek folder <strong>Spam/Promosi</strong> jika tidak menemukan email. Kode berlaku selama 15 menit.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Step: Email =====
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-3 shadow-elevated">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Lupa Password</h1>
          <p className="text-muted-foreground text-sm mt-1">Masukkan email akun Anda</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
          <form onSubmit={handleRequestOTP} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email Akun</Label>
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Mengirim...</>
              ) : (
                "Kirim Kode OTP"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Ingat password?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
