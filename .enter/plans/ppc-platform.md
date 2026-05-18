# PPC Platform — Full Implementation Plan

## Context
Build a complete Pay-Per-Click (PPC) advertising platform with two roles:
- **User**: register, browse & click ads to earn commission, deposit IDR via Midtrans, request withdrawal
- **Admin**: manage users, plans, ads, approve deposits & withdrawals

Stack: React + Vite + TypeScript + Enter Cloud (Supabase) + Midtrans API

---

## Database Schema (Migrations)

### Tables:
1. **profiles** — extends auth.users
   - `id` (uuid, FK auth.users), `full_name`, `email`, `phone`, `role` (admin/user), `balance` (numeric), `plan_id` (FK plans), `is_active` (bool), `created_at`

2. **plans** — membership plans
   - `id`, `name`, `price` (IDR), `daily_clicks_limit`, `commission_per_click` (IDR), `description`, `is_active`

3. **ads** — advertisements
   - `id`, `title`, `description`, `url`, `image_url`, `cpc_rate` (IDR), `daily_budget`, `total_budget`, `spent_budget`, `status` (active/paused/ended), `created_by` (FK profiles), `created_at`

4. **ad_clicks** — click tracking per user per ad
   - `id`, `user_id`, `ad_id`, `earned_amount`, `clicked_at`

5. **transactions** — all money movements
   - `id`, `user_id`, `type` (deposit/withdrawal/commission), `amount`, `status` (pending/success/failed), `midtrans_order_id`, `midtrans_token`, `midtrans_redirect_url`, `notes`, `created_at`

6. **withdrawal_requests**
   - `id`, `user_id`, `amount`, `bank_name`, `account_number`, `account_holder`, `status` (pending/approved/rejected), `admin_notes`, `processed_at`, `created_at`

### RLS Policies:
- Users can read/update their own profile
- Users can read active ads, insert their own clicks
- Users can read/insert their own transactions & withdrawals
- Admins have full access to all tables (via role check function)

---

## Edge Functions

### 1. `midtrans-create-transaction`
- Input: `amount`, `user_id`, `order_id`
- Calls Midtrans Snap API (`/snap/v1/transactions`)
- Returns `token` + `redirect_url`
- Stores transaction in DB with status `pending`

### 2. `midtrans-notification`
- Webhook from Midtrans (POST)
- Validates signature key
- Updates transaction status
- If success → add balance to user's profile
- Handles: `settlement`, `capture`, `deny`, `expire`, `cancel`

---

## Design System

Update `index.css` with PPC-themed tokens:
- Primary: Deep blue `222 80% 35%`
- Success/green for earnings
- Warning/amber for pending
- Clean sidebar layout

---

## File Structure

```
src/
  contexts/
    AuthContext.tsx         — auth state, user profile, role
  hooks/
    useAuth.ts
    useBalance.ts
  lib/
    supabase.ts             — re-export client
  pages/
    Auth/
      Login.tsx
      Register.tsx
    User/
      Dashboard.tsx         — balance, stats, recent clicks
      AdsPage.tsx           — browse & click ads
      DepositPage.tsx       — create deposit via Midtrans
      WithdrawPage.tsx      — request withdrawal
      TransactionsPage.tsx  — transaction history
      ProfilePage.tsx
    Admin/
      AdminDashboard.tsx    — stats overview
      UsersPage.tsx         — manage users
      PlansPage.tsx         — manage plans
      AdsManagePage.tsx     — manage ads
      DepositsPage.tsx      — approve/reject deposits
      WithdrawalsPage.tsx   — approve/reject WD
      TransactionsPage.tsx  — all transactions
  components/
    layout/
      UserLayout.tsx        — sidebar for users
      AdminLayout.tsx       — sidebar for admins
    ProtectedRoute.tsx      — role-based route guard
```

---

## Routing (`src/router.tsx`)

```
/                     → redirect based on role
/login                → Login
/register             → Register

/dashboard            → User Dashboard
/dashboard/ads        → Browse Ads
/dashboard/deposit    → Deposit
/dashboard/withdraw   → Withdraw
/dashboard/transactions → History
/dashboard/profile    → Profile

/admin                → Admin Dashboard
/admin/users          → User Management
/admin/plans          → Plan Management
/admin/ads            → Ad Management
/admin/deposits       → Deposit Approval
/admin/withdrawals    → Withdrawal Approval
/admin/transactions   → All Transactions
```

---

## Key Flows

### User Click Ad Flow:
1. User sees list of active ads with earn amount per click
2. User clicks "Klik Iklan" → cooldown checked (1 click/ad/day)
3. Ad URL opens in new tab
4. `ad_clicks` record inserted + `transactions` (type: commission) + user balance updated
5. Ad `spent_budget` incremented

### Deposit Flow:
1. User enters amount (min Rp 10.000)
2. Frontend calls edge function `midtrans-create-transaction`
3. Midtrans Snap popup opens
4. User pays → Midtrans sends webhook to `midtrans-notification`
5. Webhook updates transaction status + adds balance

### Withdrawal Flow:
1. User submits WD request with bank details
2. Admin sees pending request in Withdrawals page
3. Admin clicks "Approve" → user balance deducted, status updated
4. Admin clicks "Reject" → status rejected

---

## Files to Create/Modify

- `src/index.css` — new design tokens
- `src/router.tsx` — full route tree
- `src/App.tsx` — wrap with AuthContext
- `src/contexts/AuthContext.tsx` — new
- `src/components/layout/UserLayout.tsx` — new
- `src/components/layout/AdminLayout.tsx` — new
- `src/components/ProtectedRoute.tsx` — new
- All pages listed above (new)
- `supabase/functions/midtrans-create-transaction/index.ts` — new
- `supabase/functions/midtrans-notification/index.ts` — new
- Migration SQL for all tables

---

## Verification
1. Register as new user → profile created with default free plan
2. Admin can login (seed admin account via migration)
3. User can browse ads and click (one per day per ad)
4. Deposit creates Midtrans token and redirects to payment
5. Midtrans webhook updates balance
6. WD request appears in admin panel
