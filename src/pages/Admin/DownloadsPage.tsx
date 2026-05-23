import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, Trash2, CheckCircle, AlertCircle,
  Smartphone, FileArchive, RefreshCw, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Release {
  id: string;
  version: string;
  file_url: string;
  file_path: string;
  file_size: number;
  release_notes: string | null;
  is_active: boolean;
  created_at: string;
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DownloadsPage: React.FC = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ version: "", release_notes: "" });

  const fetchReleases = async () => {
    setLoading(true);
    const { data } = await supabase.from("app_releases").select("*").order("created_at", { ascending: false });
    setReleases(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchReleases(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".apk") && file.type !== "application/vnd.android.package-archive") {
      toast({ title: "Hanya file .apk yang diizinkan", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast({ title: "Pilih file APK terlebih dahulu", variant: "destructive" }); return; }
    if (!form.version) { toast({ title: "Versi wajib diisi", variant: "destructive" }); return; }

    setUploading(true);
    setUploadProgress(10);

    const fileName = `iklancuan-v${form.version}.apk`;
    const filePath = `apk/${fileName}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("downloads")
      .upload(filePath, selectedFile, { upsert: true });

    if (uploadError) {
      toast({ title: "Gagal upload file", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    setUploadProgress(70);

    // Get public URL
    const { data: urlData } = supabase.storage.from("downloads").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    setUploadProgress(85);

    // Save release record
    const { error: dbError } = await supabase.from("app_releases").insert({
      version: form.version,
      file_url: publicUrl,
      file_path: filePath,
      file_size: selectedFile.size,
      release_notes: form.release_notes || null,
      is_active: true,
    });

    setUploadProgress(100);

    if (dbError) {
      toast({ title: "Gagal menyimpan data rilis", description: dbError.message, variant: "destructive" });
    } else {
      toast({ title: `APK v${form.version} berhasil diupload!` });
      setDialogOpen(false);
      setSelectedFile(null);
      setForm({ version: "", release_notes: "" });
      fetchReleases();
    }

    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async () => {
    if (!deleteId || !deletePath) return;
    await supabase.storage.from("downloads").remove([deletePath]);
    await supabase.from("app_releases").delete().eq("id", deleteId);
    toast({ title: "Rilis dihapus" });
    setDeleteId(null);
    setDeletePath(null);
    fetchReleases();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("app_releases").update({ is_active: !current }).eq("id", id);
    toast({ title: !current ? "Rilis diaktifkan" : "Rilis dinonaktifkan" });
    fetchReleases();
  };

  const latestActive = releases.find(r => r.is_active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Unduh Aplikasi</h2>
          <p className="text-muted-foreground text-sm mt-1">Kelola file APK yang bisa diunduh oleh member.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Upload APK</Button>
      </div>

      {/* Latest Active */}
      {latestActive && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Versi Aktif: v{latestActive.version}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatFileSize(latestActive.file_size)} · Diupload {formatDate(latestActive.created_at)}</p>
          </div>
          <a href={latestActive.file_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="w-3.5 h-3.5" />Test Download
            </Button>
          </a>
        </div>
      )}

      {/* Releases Table */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center gap-2">
          <FileArchive className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Riwayat Rilis ({releases.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Versi</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Ukuran</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Catatan</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Diupload</th>
                <th className="text-center px-5 py-3 font-semibold text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-muted rounded animate-pulse" /></td></tr>)
              ) : releases.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Belum ada APK yang diupload</td></tr>
              ) : (
                releases.map(r => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-semibold text-foreground">v{r.version}</td>
                    <td className="px-5 py-4 text-muted-foreground">{formatFileSize(r.file_size)}</td>
                    <td className="px-5 py-4 text-muted-foreground max-w-xs truncate">{r.release_notes || "—"}</td>
                    <td className="px-5 py-4 text-center">
                      {r.is_active
                        ? <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Aktif</Badge>
                        : <Badge variant="outline" className="text-muted-foreground">Nonaktif</Badge>}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <a href={r.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download className="w-3.5 h-3.5" /></Button>
                        </a>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => toggleActive(r.id, r.is_active)}>
                          {r.is_active ? <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => { setDeleteId(r.id); setDeletePath(r.file_path); }}>
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Upload Dialog */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!uploading) setDialogOpen(v); }}>
        <DialogContent className="max-w-md flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4 text-primary" />Upload APK Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            {/* File picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${selectedFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
            >
              <input ref={fileInputRef} type="file" accept=".apk" className="hidden" onChange={handleFileChange} />
              {selectedFile ? (
                <div>
                  <FileArchive className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-foreground text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatFileSize(selectedFile.size)}</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Klik untuk pilih file <span className="font-semibold text-foreground">.apk</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Maks. 100 MB</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nomor Versi</Label>
              <Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="contoh: 1.0.0" />
            </div>
            <div className="space-y-2">
              <Label>Catatan Rilis (opsional)</Label>
              <Textarea value={form.release_notes} onChange={e => setForm({ ...form, release_notes: e.target.value })} rows={3} placeholder="Deskripsi fitur baru, perbaikan bug, dll." />
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" />Mengupload...</span>
                  <span className="font-semibold text-foreground">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full gradient-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-border bg-card shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading} className="flex-1">Batal</Button>
            <Button onClick={handleUpload} disabled={uploading || !selectedFile} className="flex-1">
              {uploading ? "Mengupload..." : <><Upload className="w-4 h-4 mr-2" />Upload APK</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus Rilis?</AlertDialogTitle><AlertDialogDescription>File APK akan dihapus permanen dari storage.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DownloadsPage;
