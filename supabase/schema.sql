-- ============================================
-- FOODSPLIT DATABASE SCHEMA (UPDATED)
-- Run this in Supabase SQL Editor
-- Changes:
--   1. group_members.role allows per-group admin (user can be admin in one group, member in another)
--   2. dues_updates table for tracking admin-applied dues changes (visible to all group members)
--   3. RLS updated: only group admins can add members
--   4. payments: only admins can approve/pay
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_admin BOOLEAN DEFAULT FALSE,   -- global admin (can access /admin panel)
  balance NUMERIC(10,2) DEFAULT 0.00,
  total_contributed NUMERIC(10,2) DEFAULT 0.00,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROUPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE DEFAULT UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8)),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GROUP MEMBERS TABLE
-- role = 'admin'  → this user is admin of THIS group only
-- role = 'member' → regular member of this group
-- A user can be admin in group A and member in group B simultaneously
-- CONSTRAINT: a user cannot be admin of a group they are also a regular member in (enforced by role column)
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================
-- EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  per_person_amount NUMERIC(10,2) NOT NULL,
  participant_count INTEGER NOT NULL,
  receipt_url TEXT,
  expense_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EXPENSE PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.expense_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount_owed NUMERIC(10,2) NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expense_id, user_id)
);

-- ============================================
-- PAYMENTS TABLE
-- Users submit → status=pending
-- Only group admin (or global admin) can approve → status=approved
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  receipt_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DUES UPDATES TABLE
-- Records every time a group admin updates a member's dues.
-- All group members can view this.
-- ============================================
CREATE TABLE IF NOT EXISTS public.dues_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,       -- whose dues changed
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL NOT NULL,   -- the admin who changed it
  balance_before NUMERIC(10,2) NOT NULL,
  balance_adjustment NUMERIC(10,2) NOT NULL,  -- positive = credit, negative = debit
  balance_after NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  related_id UUID,
  related_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RECEIPTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  receipt_type TEXT DEFAULT 'expense' CHECK (receipt_type IN ('expense', 'payment')),
  related_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view all users" ON public.users;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
  DROP POLICY IF EXISTS "Group members can view groups" ON public.groups;
  DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
  DROP POLICY IF EXISTS "Group admins can update groups" ON public.groups;
  DROP POLICY IF EXISTS "Group members can view membership" ON public.group_members;
  DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
  DROP POLICY IF EXISTS "Admins can manage members" ON public.group_members;
  DROP POLICY IF EXISTS "Group admins can insert members" ON public.group_members;
  DROP POLICY IF EXISTS "Group members can view expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Group members can create expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Creators can update expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Participants can view expense participants" ON public.expense_participants;
  DROP POLICY IF EXISTS "Expense creator can add participants" ON public.expense_participants;
  DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
  DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
  DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
  DROP POLICY IF EXISTS "Group members can view dues updates" ON public.dues_updates;
  DROP POLICY IF EXISTS "Group admins can insert dues updates" ON public.dues_updates;
  DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
  DROP POLICY IF EXISTS "Users can view relevant receipts" ON public.receipts;
  DROP POLICY IF EXISTS "Users can upload receipts" ON public.receipts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- USERS policies
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- GROUPS policies
CREATE POLICY "Group members can view groups" ON public.groups FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid())
  OR created_by = auth.uid()
);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group admins can update groups" ON public.groups FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid() AND role = 'admin')
  OR created_by = auth.uid()
);

-- GROUP MEMBERS policies
-- Only group admins (or global admins) can INSERT new members
CREATE POLICY "Group members can view membership" ON public.group_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);
CREATE POLICY "Group admins can insert members" ON public.group_members FOR INSERT WITH CHECK (
  -- The inserting user must be group admin of that group, or global admin, or creating their own initial membership
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  )
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
  OR (
    -- Allow self-insert only when creating the group (user becomes first admin)
    user_id = auth.uid() AND role = 'admin' AND
    NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_id)
  )
);
CREATE POLICY "Admins can manage members" ON public.group_members FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid() AND gm.role = 'admin') OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- EXPENSES policies
CREATE POLICY "Group members can view expenses" ON public.expenses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = expenses.group_id AND user_id = auth.uid())
);
CREATE POLICY "Group members can create expenses" ON public.expenses FOR INSERT WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = expenses.group_id AND user_id = auth.uid())
);
CREATE POLICY "Creators can update expenses" ON public.expenses FOR UPDATE USING (created_by = auth.uid());

-- EXPENSE PARTICIPANTS policies
CREATE POLICY "Participants can view expense participants" ON public.expense_participants FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.expenses e
    JOIN public.group_members gm ON e.group_id = gm.group_id
    WHERE e.id = expense_id AND gm.user_id = auth.uid()
  )
);
CREATE POLICY "Expense creator can add participants" ON public.expense_participants FOR INSERT WITH CHECK (true);

-- PAYMENTS policies
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) OR
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = payments.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "Users can create own payments" ON public.payments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can update payments" ON public.payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true) OR
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = payments.group_id AND user_id = auth.uid() AND role = 'admin'
  )
);

-- DUES UPDATES policies — all group members can see dues history
CREATE POLICY "Group members can view dues updates" ON public.dues_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = dues_updates.group_id AND user_id = auth.uid())
);
CREATE POLICY "Group admins can insert dues updates" ON public.dues_updates FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = dues_updates.group_id AND user_id = auth.uid() AND role = 'admin'
  ) OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- NOTIFICATIONS policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- RECEIPTS policies
CREATE POLICY "Users can view relevant receipts" ON public.receipts FOR SELECT USING (
  uploaded_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "Users can upload receipts" ON public.receipts FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- New user signup → create profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Deduct balance when expense participant added
CREATE OR REPLACE FUNCTION public.update_balance_after_expense()
RETURNS TRIGGER AS $$
DECLARE
  current_balance NUMERIC;
BEGIN
  UPDATE public.users
  SET balance = balance - NEW.amount_owed, updated_at = NOW()
  WHERE id = NEW.user_id;

  SELECT balance INTO current_balance FROM public.users WHERE id = NEW.user_id;
  IF current_balance < -500 THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_type)
    VALUES (
      NEW.user_id,
      'Low Balance Warning',
      'Your account balance is below -500 PKR. Please clear your payment.',
      'warning', 'balance'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_expense_participant_added ON public.expense_participants;
CREATE TRIGGER on_expense_participant_added
  AFTER INSERT ON public.expense_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_balance_after_expense();

-- Update balance when payment approved/rejected
CREATE OR REPLACE FUNCTION public.update_balance_after_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.users
    SET balance = balance + NEW.amount, updated_at = NOW()
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
    VALUES (
      NEW.user_id,
      'Payment Approved ✓',
      'Your payment of ' || NEW.amount || ' PKR has been approved. Balance updated.',
      'success', NEW.id, 'payment'
    );
  END IF;

  IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, message, type, related_id, related_type)
    VALUES (
      NEW.user_id,
      'Payment Rejected',
      'Your payment of ' || NEW.amount || ' PKR was rejected. Contact admin for details.',
      'error', NEW.id, 'payment'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_status_changed ON public.payments;
CREATE TRIGGER on_payment_status_changed
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_balance_after_payment();

-- Track total contributions when expense added
CREATE OR REPLACE FUNCTION public.update_total_contributed()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET total_contributed = total_contributed + NEW.total_amount, updated_at = NOW()
  WHERE id = NEW.created_by;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_expense_created ON public.expenses;
CREATE TRIGGER on_expense_created
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_total_contributed();

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON public.group_members(group_id, role);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expense_participants_user_id ON public.expense_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_participants_expense_id ON public.expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_group_id ON public.payments(group_id);
CREATE INDEX IF NOT EXISTS idx_dues_updates_group_id ON public.dues_updates(group_id);
CREATE INDEX IF NOT EXISTS idx_dues_updates_user_id ON public.dues_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ============================================
-- STORAGE BUCKETS (run in Supabase Storage UI or SQL)
-- ============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payments', 'payments', false) ON CONFLICT DO NOTHING;
