import { Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import ForgotPassword from "./pages/Auth/ForgotPassword";
import ProtectedRoute from "./components/ProtectedRoute";
import UserLayout from "./components/layout/UserLayout";
import AdminLayout from "./components/layout/AdminLayout";

// User pages
import Dashboard from "./pages/User/Dashboard";
import AdsPage from "./pages/User/AdsPage";
import DepositPage from "./pages/User/DepositPage";
import WithdrawPage from "./pages/User/WithdrawPage";
import TransactionsPage from "./pages/User/TransactionsPage";
import ProfilePage from "./pages/User/ProfilePage";
import UserPlansPage from "./pages/User/PlansPage";
import ReferralPage from "./pages/User/ReferralPage";

// Admin pages
import AdminDashboard from "./pages/Admin/AdminDashboard";
import UsersPage from "./pages/Admin/UsersPage";
import PlansPage from "./pages/Admin/PlansPage";
import AdsManagePage from "./pages/Admin/AdsManagePage";
import DepositsPage from "./pages/Admin/DepositsPage";
import WithdrawalsPage from "./pages/Admin/WithdrawalsPage";
import AdminTransactionsPage from "./pages/Admin/TransactionsPage";
import DownloadsPage from "./pages/Admin/DownloadsPage";
import DownloadPage from "./pages/User/DownloadPage";

export const routers = [
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  { path: "/forgot-password", element: <ForgotPassword /> },

  // User routes
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <UserLayout><Dashboard /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/ads",
    element: (
      <ProtectedRoute>
        <UserLayout><AdsPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/deposit",
    element: (
      <ProtectedRoute>
        <UserLayout><DepositPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/withdraw",
    element: (
      <ProtectedRoute>
        <UserLayout><WithdrawPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/transactions",
    element: (
      <ProtectedRoute>
        <UserLayout><TransactionsPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/referral",
    element: (
      <ProtectedRoute>
        <UserLayout><ReferralPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/plans",
    element: (
      <ProtectedRoute>
        <UserLayout><UserPlansPage /></UserLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/dashboard/profile",
    element: (
      <ProtectedRoute>
        <UserLayout><ProfilePage /></UserLayout>
      </ProtectedRoute>
    ),
  },

  {
    path: "/dashboard/download",
    element: (
      <ProtectedRoute>
        <UserLayout><DownloadPage /></UserLayout>
      </ProtectedRoute>
    ),
  },

  // Admin routes
  {
    path: "/admin",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><AdminDashboard /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><UsersPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/plans",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><PlansPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/ads",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><AdsManagePage /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/deposits",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><DepositsPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/withdrawals",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><WithdrawalsPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/transactions",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><AdminTransactionsPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },

  {
    path: "/admin/downloads",
    element: (
      <ProtectedRoute requireAdmin>
        <AdminLayout><DownloadsPage /></AdminLayout>
      </ProtectedRoute>
    ),
  },

  { path: "*", element: <NotFound /> },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
