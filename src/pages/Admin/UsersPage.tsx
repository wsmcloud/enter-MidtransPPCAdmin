import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatIDR, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Edit2, ToggleLeft, ToggleRight, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  balance: number;
  role: string;
  is_active: boolean;
  created_at: string;
  plan_id: string | null;
}

const UsersPage: React.FC = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", balance: 0 });
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase.from("profiles").select("*").eq("role", "user").order("created_at", { ascending: false });
    if (search) query = query.ilike("full_name", `%${search}%`);
    const { data } = await query;
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [search]);

  const toggleActive = async (user: UserProfile) => {
    const { error } = await supabase.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id);
    if (error) {
      toast({ title: "Gagal mengubah status", variant: "destructive" });
    } else {
      toast({ title: `Akun ${!user.is_active ? "diaktifkan" : "dinonaktifkan"}` });
      fetchUsers();
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditUser(user);
    setEditForm({ full_name: user.full_name, phone: user.phone || "", balance: user.balance });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name,
      phone: editForm.phone,
      balance: editForm.balance,
    }).eq("id", editUser.id);

    if (error) {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } else {
      toast({ title: "Data user berhasil diperbarui" });
      setEditUser(null);
      fetchUsers();
    }
    setEditLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Manajemen User</h2>
          <p className="text-muted-foreground text-sm mt-1">Kelola semua pengguna platform.</p>
        </div>
        <div className="flex items-center gap-2 bg-card px-3 py-2 rounded-lg border border-border">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{users.length} user</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Cari nama user..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">No. HP</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">Saldo</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Bergabung</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Tidak ada user ditemukan</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-semibold">
                          {user.full_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{user.phone || "-"}</td>
                    <td className="px-5 py-4 text-right font-semibold text-foreground">{formatIDR(user.balance)}</td>
                    <td className="px-5 py-4 text-center">
                      {user.is_active
                        ? <Badge className="bg-green-500/10 text-green-600 border-green-200">Aktif</Badge>
                        : <Badge className="bg-destructive/10 text-destructive border-destructive/20">Nonaktif</Badge>
                      }
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(user)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toggleActive(user)}>
                          {user.is_active
                            ? <ToggleRight className="w-4 h-4 text-green-500" />
                            : <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          }
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {editUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>No. HP</Label>
              <Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Saldo (IDR)</Label>
              <Input type="number" value={editForm.balance} onChange={e => setEditForm({ ...editForm, balance: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={saveEdit} disabled={editLoading} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {editLoading ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button variant="outline" onClick={() => setEditUser(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
