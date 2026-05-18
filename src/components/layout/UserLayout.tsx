import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn, formatIDR } from "@/lib/utils";
import {
  LayoutDashboard, MousePointerClick, Wallet, ArrowDownToLine,
  ArrowUpFromLine, History, User, LogOut, Menu, X, ChevronRight,
  Bell, TrendingUp, Package, Gift
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/dashboard/ads", label: "Klik Iklan", icon: MousePointerClick },
  { path: "/dashboard/plans", label: "Paket", icon: Package },
  { path: "/dashboard/referral", label: "Referral", icon: Gift },
  { path: "/dashboard/deposit", label: "Deposit", icon: ArrowDownToLine },
  { path: "/dashboard/withdraw", label: "Tarik Dana", icon: ArrowUpFromLine },
  { path: "/dashboard/transactions", label: "Riwayat", icon: History },
  { path: "/dashboard/profile", label: "Profil", icon: User },
];

const UserLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground">PPC Ads</span>
        </div>
      </div>

      {/* Balance Card */}
      <div className="mx-4 mt-4 p-4 rounded-xl bg-sidebar-accent">
        <p className="text-xs text-sidebar-foreground/60 mb-1">Saldo Anda</p>
        <p className="text-xl font-bold text-white">{formatIDR(profile?.balance || 0)}</p>
        {(profile?.bonus_balance || 0) > 0 && (
          <p className="text-xs text-amber-300 mt-1 flex items-center gap-1">
            <Gift className="w-3 h-3" />
            Bonus: {formatIDR(profile?.bonus_balance || 0)}
          </p>
        )}
        <p className="text-xs text-sidebar-foreground/60 mt-1 capitalize">{profile?.full_name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Signout */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-sidebar transform transition-transform duration-300 lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-4 shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex text-xs">
              {profile?.plan_id ? "Member" : "Free"}
            </Badge>
            <Button variant="ghost" size="icon" className="w-9 h-9">
              <Bell className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-semibold">
              {(profile?.full_name || "U")[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
