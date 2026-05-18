import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Calendar, Package, Shield, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ProfilePage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);

    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name,
      phone: form.phone,
    }).eq("id", profile.id);

    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profil berhasil diperbarui" });
      refreshProfile();
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Gagal mengubah password", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password berhasil diubah" });
      setNewPassword("");
    }
    setPwLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Profil Saya</h2>
        <p className="text-muted-foreground text-sm mt-1">Kelola informasi akun Anda.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold">
            {(profile?.full_name || "U")[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">{profile?.full_name}</h3>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">{profile?.role}</Badge>
              {profile?.is_active ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-200 text-xs">Aktif</Badge>
              ) : (
                <Badge className="bg-destructive/10 text-destructive text-xs">Nonaktif</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted rounded-xl">
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="w-3 h-3" /> Saldo</p>
            <p className="font-bold text-foreground">{formatIDR(profile?.balance || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Paket</p>
            <p className="font-bold text-foreground">{profile?.plan_id ? "Member" : "Free"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
            <p className="text-sm text-foreground truncate">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Bergabung</p>
            <p className="text-sm text-foreground">{profile?.created_at ? formatDate(profile.created_at) : "-"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nama Lengkap</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="full_name"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Nomor HP</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="pl-10"
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-card">
        <h3 className="font-semibold text-foreground mb-4">Ganti Password</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">Password Baru</Label>
            <Input
              id="new_password"
              type="password"
              placeholder="Min 6 karakter"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <Button onClick={handleChangePassword} disabled={pwLoading} variant="outline" className="w-full">
            {pwLoading ? "Memproses..." : "Ubah Password"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
