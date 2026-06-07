# 🍕 FoodSplit

> **Split meals, not friendships** — A group food expense manager built for friend groups, flatmates, and teams.

FoodSplit is a full-stack web application that helps groups track shared food expenses, manage dues, submit payments, and get notifications — all in one place.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [User Roles & Permissions](#user-roles--permissions)
- [Key Workflows](#key-workflows)
- [Deployment](#deployment)

---

## Overview

FoodSplit allows users to:

- Create or join groups
- Track shared expenses split among selected participants
- Submit payment receipts for admin approval
- View real-time balance and dues
- Receive in-app notifications for all activity

The app uses a **dual admin model**: a **Global Admin** (platform-wide) and **Group Admins** (per-group). This allows fine-grained control over who can manage expenses and approve payments.

---

## ✨ Features

### Authentication
- Email/password signup and login
- Forgot password with email reset link
- Password reset via secure token
- JWT-based session management (tokens stored in localStorage)

### Groups
- Create groups with a name and optional description
- Auto-generated unique invite code (e.g. `D69517FC`) for sharing
- Join groups via invite code
- Invite members by email (sends an in-app invitation with Accept/Decline)
- Remove members (group admin only)
- Leave a group (only if balance ≥ 0, i.e., no outstanding dues)
- View per-member balances and dues history

### Expenses
- Group admins add expenses with a title, amount, and selected participants
- Expenses are split equally among selected participants only (others are excluded)
- Live split preview before submission
- Balance is automatically deducted via Supabase trigger when an expense is created
- Warning notification sent if balance drops below –500 PKR

### Payments
- Members submit payment receipts (image/PDF) with amount and optional notes
- Receipts are uploaded to Supabase Storage via signed URLs
- Payments default to `pending` status
- Group admins or Global Admins can approve or reject payments
- On approval, balance is automatically updated via Supabase trigger
- Signed receipt URLs (valid 60 min) are generated on-demand to protect privacy

### Dues Management
- Group-level dues dashboard showing every member's balance
- Group admins can manually adjust a member's balance (positive = credit, negative = deduct)
- All adjustments are logged in the `dues_updates` table and visible to all group members
- Full dues history with timestamps, notes, and before/after balances

### Notifications & Invitations
- In-app notification system with types: `info`, `success`, `warning`, `error`, `invite`
- Notifications for: new expenses, payment submissions, payment approval/rejection, dues updates, group invitations, low balance warnings
- Mark individual or all notifications as read
- Pending group invitations shown prominently in the Alerts tab with Accept/Decline buttons

### Admin Panel (Global Admin)
- Dashboard with stats: total users, groups, expenses, pending payments
- Manage all users: view balances, toggle admin status
- Review and approve/reject all pending payments across the platform
- View full payment history

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (private buckets) |
| Hosting (Backend) | Railway / any Node host (via `Procfile`) |
| Hosting (Frontend) | Vercel / any Next.js host |

---

## 📁 Project Structure

```
FoodSplit/
├── backend/                    # Express.js API server
│   ├── lib/
│   │   └── supabase.js         # Supabase client (service role)
│   ├── middleware/
│   │   └── auth.js             # JWT authentication + admin guard
│   ├── routes/
│   │   ├── auth.js             # Signup, login, logout, password reset
│   │   ├── dashboard.js        # User dashboard summary
│   │   ├── groups.js           # Group CRUD, members, dues, roles
│   │   ├── expenses.js         # Expense creation and listing
│   │   ├── payments.js         # Payment submission, approval, receipts
│   │   ├── notifications.js    # Notification read/list
│   │   ├── invitations.js      # Send, respond, join-by-code
│   │   └── admin.js            # Global admin panel endpoints
│   ├── server.js               # Express app entry point
│   ├── package.json
│   ├── Procfile                # For Railway deployment
│   └── nixpacks.toml           # Node 20 build config
│
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── page.tsx            # Root redirect (→ dashboard or login)
│   │   ├── layout.tsx          # Root layout with AuthProvider
│   │   ├── globals.css         # Tailwind base styles
│   │   ├── auth/
│   │   │   ├── login/          # Login page
│   │   │   ├── signup/         # Signup page
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── dashboard/          # Main dashboard
│   │   ├── groups/
│   │   │   ├── page.tsx        # Groups list
│   │   │   └── [id]/page.tsx   # Group detail (members, expenses, dues tabs)
│   │   ├── expenses/
│   │   │   ├── page.tsx        # All expenses
│   │   │   └── new/page.tsx    # Create expense (admin only)
│   │   ├── payments/
│   │   │   ├── page.tsx        # Payment history + admin review tab
│   │   │   └── new/page.tsx    # Submit payment with receipt
│   │   ├── notifications/      # Alerts + invitations
│   │   ├── admin/              # Global admin panel
│   │   └── settings/           # User profile + logout
│   ├── components/
│   │   └── layout/
│   │       └── BottomNav.tsx   # Mobile bottom navigation bar
│   ├── lib/
│   │   ├── api.ts              # Typed API client (all fetch calls)
│   │   └── auth-context.tsx    # React Auth context (user, login, logout)
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── tsconfig.json
│
└── supabase/
    └── schema.sql              # Full DB schema, RLS policies, triggers
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- npm

### 1. Clone the repository

```bash
git clone <repo-url>
cd FoodSplit
```

### 2. Set up the database

Open your Supabase project → SQL Editor → paste and run the full contents of `supabase/schema.sql`.

Also create two **private** Storage buckets in Supabase Storage:
- `receipts`
- `payments`

### 3. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in your Supabase credentials in .env
npm install
npm run dev       # Starts on http://localhost:4000
```

### 4. Frontend setup

```bash
cd frontend
cp .env.example .env.local
# Fill in your API URL and Supabase public keys
npm install
npm run dev       # Starts on http://localhost:3000
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 4000) |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, keep secret) |
| `FRONTEND_URL` | Frontend URL for CORS and password reset redirect |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:4000/api`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

> ⚠️ Never commit `.env` files. The `SUPABASE_SERVICE_ROLE_KEY` must remain server-side only.

---

## 🗄 Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `users` | User profiles, global admin flag, balance, total contributed |
| `groups` | Groups with name, description, invite code |
| `group_members` | Many-to-many: users ↔ groups, with per-group `role` (admin/member) |
| `expenses` | Expense records with total amount, per-person split, participant count |
| `expense_participants` | Which users participated in each expense and how much they owe |
| `payments` | Payment submissions with status (pending/approved/rejected) |
| `dues_updates` | Audit log of manual balance adjustments by group admins |
| `notifications` | In-app notification feed per user |
| `group_invitations` | Pending invitations sent by group admins |
| `receipts` | File metadata for uploaded receipt images |

### Automatic Triggers

- **`on_auth_user_created`** — Creates a `users` profile row when someone signs up via Supabase Auth
- **`on_expense_participant_added`** — Deducts `amount_owed` from a user's balance when added as expense participant; sends low-balance warning if < –500 PKR
- **`on_payment_status_changed`** — Adds `amount` back to user's balance when a payment is approved; sends appropriate notification on approve/reject
- **`on_expense_created`** — Increments `total_contributed` for the expense creator

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Register new user |
| POST | `/login` | Login, returns user + session |
| POST | `/logout` | Logout current session |
| POST | `/forgot-password` | Send password reset email |
| POST | `/reset-password` | Reset password using recovery token |
| GET | `/me` | Get current authenticated user profile |

### Groups — `/api/groups`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | User | List user's groups |
| POST | `/` | User | Create a new group |
| POST | `/join` | Admin | Add member by email or invite code |
| GET | `/:id` | Member | Get group details + members |
| DELETE | `/:id/leave` | Member | Leave group (requires balance ≥ 0) |
| GET | `/:id/dues` | Member | Get all member balances |
| GET | `/:id/dues-history` | Member | Get dues update audit log |
| PATCH | `/:id/members/:userId/dues` | Group Admin | Adjust member balance |
| PATCH | `/:id/members/:userId/role` | Group Admin | Change member role |
| DELETE | `/:id/members/:userId` | Group Admin | Remove a member |

### Expenses — `/api/expenses`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Member | List expenses (filter by `?group_id=`) |
| POST | `/` | Group Admin | Create expense with participant selection |
| GET | `/:id` | Member | Get single expense detail |
| DELETE | `/:id` | Group Admin | Delete expense |

### Payments — `/api/payments`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/storage-url` | User | Get signed upload URL for receipt |
| GET | `/receipt-url/:id` | Owner/Admin | Get signed read URL for receipt |
| GET | `/pending` | Group/Global Admin | List all pending payments |
| PATCH | `/approve/:id` | Group/Global Admin | Approve or reject a payment |
| POST | `/upload-receipt` | User | Submit a payment for review |
| GET | `/` | User | List own payments (admins see all) |

### Invitations — `/api/invitations`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/send` | Group Admin | Send invitation to user by email |
| POST | `/join-by-code` | User | Join group using invite code |
| PATCH | `/:id/respond` | Invited User | Accept or decline invitation |
| GET | `/pending` | User | List pending invitations |

### Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | User | List notifications (`?unread_only=true`) |
| PATCH | `/:id/read` | User | Mark single notification read |
| PATCH | `/read-all` | User | Mark all notifications read |

### Admin — `/api/admin` *(Global Admin only)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Stats + recent activity |
| GET | `/users` | List all users |
| PATCH | `/users/:id` | Update user (toggle admin, adjust balance) |
| DELETE | `/users/:id` | Delete user |
| DELETE | `/expenses/:id` | Delete any expense |
| DELETE | `/groups/:id` | Delete any group |
| POST | `/groups/:id/remove-member` | Remove member from any group |
| GET | `/payments` | List all payments |

---

## 👥 User Roles & Permissions

### Regular Member
- View group info, expenses, and dues for groups they belong to
- Submit payment receipts for review
- Accept or decline group invitations
- Leave a group (if balance is cleared)

### Group Admin
- All member permissions
- Add members to their group (by email invitation or direct add)
- Remove members from their group
- Create and delete expenses within their group
- Approve or reject payment submissions for their group
- Manually adjust member dues balances
- View the invite code and share it

### Global Admin (`is_admin = true` in `users` table)
- All group admin permissions across all groups
- Access the `/admin` panel
- View all users and toggle their admin status
- Approve/reject payments from any group
- Delete any user, group, or expense from the platform

---

## 🔄 Key Workflows

### Expense Split Flow
1. Group admin navigates to **Add Expense**
2. Selects group, enters title and total amount
3. Toggles which members participated (defaults to all)
4. Preview shows per-person amount = total ÷ participant count
5. On submit → `expense_participants` rows inserted → trigger fires → each participant's balance decremented

### Payment Approval Flow
1. Member goes to **Pay Dues** → enters amount, selects group, optionally uploads receipt
2. Payment created with `status = pending`
3. Group admin receives notification → reviews in **Payments → Review** tab
4. Admin optionally views receipt (fresh signed URL generated)
5. Admin approves or rejects with optional notes
6. On approval → trigger fires → member's balance incremented → member notified

### Member Invitation Flow
1. Group admin goes to **Group → Members → Add New Member**
2. Enters the invitee's registered email
3. Invitation record created → invitee receives notification in Alerts tab
4. Invitee taps **Accept & Join** → added to group → both parties notified
   — or taps **Decline** → admin notified

---

## 🚢 Deployment

### Backend (Railway)

The backend includes a `Procfile` (`web: node server.js`) and `nixpacks.toml` for Railway deployment.

1. Push the `backend/` folder to a Railway project
2. Set all environment variables in the Railway dashboard
3. Railway auto-detects and builds using Nixpacks

### Frontend (Vercel)

1. Import the `frontend/` folder into a Vercel project
2. Set `NEXT_PUBLIC_API_URL` and Supabase keys in Vercel environment variables
3. Deploy — Next.js is auto-detected

### CORS

The backend restricts CORS to `FRONTEND_URL`. Make sure this is set to your deployed frontend domain in production.

---

## 📝 Notes

- All monetary values are in **PKR (Pakistani Rupees)**
- Balances are negative when a user owes money (expenses deduct, payments credit)
- The `-500 PKR` threshold triggers an automatic low-balance warning notification
- Receipt files are stored in private Supabase Storage buckets; access requires a fresh signed URL generated server-side
- The backend sanitizes database errors before returning them to clients to avoid leaking schema details
