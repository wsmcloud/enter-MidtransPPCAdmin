import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { Download, Smartphone, Shield, Zap, CheckCircle, RefreshCw, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Release {
  id: string;
  version: string;
  file_url: string;
  file_size: number;
  release_notes: string | null;
  created_at: string;
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FEATURES = [
  { icon: Zap, label: "Klik iklan lebih mudah dari HP" },
  { icon: Shield, label: "Aman & terenkripsi" },
  { icon: CheckCircle, label: "Notifikasi iklan baru otomatis" },
  { icon: Smartphone, label: "Optimal untuk Android" },
];

const DownloadPage: React.FC = () => {
  const [release, setRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchLatest = async () => {
      const { data } = await supabase
        .from("app_releases")
        .select("id, version, file_url, file_size, release_notes, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRelease(data);
      setLoading(false);
    };
    fetchLatest();
  }, []);

  const handleDownload = () => {
    if (!release) return;
    setDownloading(true);
    const link = document.createElement("a");
    link.href = release.file_url;
    link.download = `iklancuan-v${release.version}.apk`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Unduh Aplikasi</h2>
        <p className="text-muted-foreground text-sm mt-1">Dapatkan aplikasi IKLAN CUAN untuk Android.</p>
      </div>

      {/* App Card */}
      <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-6 text-center border-b border-border"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--primary)/0.03))" }}>
          <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-bold text-foreground">IKLAN CUAN</h3>
          <p className="text-sm text-muted-foreground mt-1">Aplikasi PTC Android</p>
          {release && (
            <Badge className="mt-2 bg-primary/10 text-primary border-primary/20">v{release.version}</Badge>
          )}
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-5 bg-muted rounded animate-pulse" />
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
            </div>
          ) : !release ? (
            <div className="text-center py-6">
              <FileArchive className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aplikasi belum tersedia. Cek kembali nanti.</p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Ukuran File</p>
                  <p className="font-semibold text-foreground text-sm mt-0.5">{formatFileSize(release.file_size)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">Diperbarui</p>
                  <p className="font-semibold text-foreground text-sm mt-0.5">{formatDate(release.created_at)}</p>
                </div>
              </div>

              {/* Release notes */}
              {release.release_notes && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Catatan Rilis</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{release.release_notes}</p>
                </div>
              )}

              {/* Download button */}
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                {downloading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" />Mengunduh...</>
                  : <><Download className="w-5 h-5" />Unduh APK v{release.version}</>}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Keunggulan Aplikasi</p>
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-sm text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Install guide */}
      <div className="bg-amber-500/10 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Cara Install</p>
        <ol className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
          <li>Unduh file APK di atas</li>
          <li>Buka <strong>Pengaturan</strong> HP → <strong>Keamanan</strong></li>
          <li>Aktifkan <strong>"Sumber Tidak Dikenal"</strong></li>
          <li>Buka file APK yang sudah diunduh</li>
          <li>Klik <strong>Install</strong> dan tunggu selesai</li>
        </ol>
      </div>
    </div>
  );
};

export default DownloadPage;
