-- 002_align_schema: Align DB schema with frontend code
-- Run once against Supabase SQL Editor

-- 1. families
CREATE TABLE IF NOT EXISTS public.families (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages family" ON public.families;
CREATE POLICY "Owner manages family" ON public.families
  FOR ALL USING (owner_user_id = auth.uid());

-- 2. children
CREATE TABLE IF NOT EXISTS public.children (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pin_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parents manage children" ON public.children;
DROP POLICY IF EXISTS "Kids view own record" ON public.children;
CREATE POLICY "Parents manage children" ON public.children
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));
CREATE POLICY "Kids view own record" ON public.children
  FOR SELECT USING (user_id = auth.uid());

-- 3. behavior_rules: is_active->active, add family_id
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='behavior_rules' AND column_name='is_active') THEN
    ALTER TABLE public.behavior_rules RENAME COLUMN is_active TO active;
  END IF;
END $$;
ALTER TABLE public.behavior_rules ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;

-- 4. prizes -> reward_catalog
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='prizes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prizes' AND column_name='name') THEN
      ALTER TABLE public.prizes RENAME COLUMN name TO title;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prizes' AND column_name='is_active') THEN
      ALTER TABLE public.prizes RENAME COLUMN is_active TO active;
    END IF;
    ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.families(id) ON DELETE CASCADE;
    ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS stock_qty INTEGER;
    ALTER TABLE public.prizes RENAME TO reward_catalog;
  END IF;
END $$;

-- 5. token_entries -> token_ledger
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='token_entries') THEN
    ALTER TABLE public.token_entries DROP CONSTRAINT IF EXISTS token_entries_kid_id_fkey;
    ALTER TABLE public.token_entries DROP CONSTRAINT IF EXISTS token_entries_parent_id_fkey;
    ALTER TABLE public.token_entries DROP CONSTRAINT IF EXISTS token_entries_behavior_rule_id_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='token_entries' AND column_name='kid_id') THEN
      ALTER TABLE public.token_entries RENAME COLUMN kid_id TO child_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='token_entries' AND column_name='parent_id') THEN
      ALTER TABLE public.token_entries RENAME COLUMN parent_id TO awarded_by;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='token_entries' AND column_name='behavior_rule_id') THEN
      ALTER TABLE public.token_entries RENAME COLUMN behavior_rule_id TO rule_id;
    END IF;
    ALTER TABLE public.token_entries ADD COLUMN IF NOT EXISTS family_id UUID;
    ALTER TABLE public.token_entries ADD COLUMN IF NOT EXISTS year_month TEXT;
    ALTER TABLE public.token_entries RENAME TO token_ledger;
  END IF;
END $$;

-- 6. redemptions -> reward_redemptions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='redemptions') THEN
    ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_kid_id_fkey;
    ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_prize_id_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='redemptions' AND column_name='kid_id') THEN
      ALTER TABLE public.redemptions RENAME COLUMN kid_id TO child_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='redemptions' AND column_name='prize_id') THEN
      ALTER TABLE public.redemptions RENAME COLUMN prize_id TO reward_id;
    END IF;
    ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS family_id UUID;
    ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS approved_by UUID;
    ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_status_check;
    ALTER TABLE public.redemptions RENAME TO reward_redemptions;
  END IF;
END $$;

ALTER TABLE public.reward_redemptions DROP CONSTRAINT IF EXISTS reward_redemptions_status_check;
ALTER TABLE public.reward_redemptions ADD CONSTRAINT reward_redemptions_status_check
  CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled'));

-- 7. child_balances view
CREATE OR REPLACE VIEW public.child_balances AS
SELECT child_id,
  COALESCE(SUM(CASE WHEN entry_type='earn' THEN token_amount
                    WHEN entry_type IN ('spend','redeem') THEN -token_amount
                    ELSE 0 END),0)::INTEGER AS current_balance
FROM public.token_ledger GROUP BY child_id;

-- 8. RPCs
DROP FUNCTION IF EXISTS public.get_monthly_report(UUID, INT, INT);
DROP FUNCTION IF EXISTS public.get_token_balance(UUID);

CREATE FUNCTION public.get_token_balance(p_kid_id UUID)
RETURNS INTEGER AS $$
DECLARE v_balance INTEGER; v_child_id UUID;
BEGIN
  SELECT id INTO v_child_id FROM public.children WHERE user_id = p_kid_id LIMIT 1;
  IF v_child_id IS NULL THEN v_child_id := p_kid_id; END IF;
  SELECT COALESCE(SUM(CASE WHEN entry_type='earn' THEN token_amount
                           WHEN entry_type IN ('spend','redeem') THEN -token_amount
                           ELSE 0 END),0)
  INTO v_balance FROM public.token_ledger WHERE child_id = v_child_id;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION public.get_monthly_report(p_kid_id UUID, p_year INT, p_month INT)
RETURNS TABLE (behavior_title TEXT, entry_count BIGINT, total_tokens BIGINT) AS $$
DECLARE v_child_id UUID;
BEGIN
  SELECT id INTO v_child_id FROM public.children WHERE user_id = p_kid_id LIMIT 1;
  IF v_child_id IS NULL THEN v_child_id := p_kid_id; END IF;
  RETURN QUERY
  SELECT COALESCE(br.title, tl.note, 'Other')::TEXT,
    COUNT(*)::BIGINT, SUM(tl.token_amount)::BIGINT
  FROM public.token_ledger tl
  LEFT JOIN public.behavior_rules br ON tl.rule_id = br.id
  WHERE tl.child_id = v_child_id
    AND EXTRACT(YEAR FROM tl.occurred_at) = p_year
    AND EXTRACT(MONTH FROM tl.occurred_at) = p_month
    AND tl.entry_type = 'earn'
  GROUP BY COALESCE(br.title, tl.note, 'Other')
  ORDER BY SUM(tl.token_amount) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.award_tokens(
  p_child_id UUID, p_rule_id UUID DEFAULT NULL,
  p_token_amount INTEGER DEFAULT NULL, p_note TEXT DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS VOID AS $$
DECLARE v_amount INTEGER;
BEGIN
  IF p_token_amount IS NOT NULL THEN v_amount := p_token_amount;
  ELSIF p_rule_id IS NOT NULL THEN
    SELECT token_value INTO v_amount FROM public.behavior_rules WHERE id = p_rule_id AND active = true;
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Invalid token amount'; END IF;
  INSERT INTO public.token_ledger (child_id, awarded_by, rule_id, token_amount, entry_type, note, occurred_at, year_month)
  VALUES (p_child_id, auth.uid(), p_rule_id, v_amount, 'earn', p_note, p_occurred_at, TO_CHAR(p_occurred_at, 'YYYY-MM'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RLS policies
ALTER TABLE public.token_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kids view own entries" ON public.token_ledger;
DROP POLICY IF EXISTS "Parents manage all entries" ON public.token_ledger;
DROP POLICY IF EXISTS "Kids create redeem entries" ON public.token_ledger;
DROP POLICY IF EXISTS "Kids view own ledger entries" ON public.token_ledger;
DROP POLICY IF EXISTS "Parents manage token ledger" ON public.token_ledger;
CREATE POLICY "Kids view own ledger entries" ON public.token_ledger
  FOR SELECT USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Parents manage token ledger" ON public.token_ledger
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read prizes" ON public.reward_catalog;
DROP POLICY IF EXISTS "Parents manage prizes" ON public.reward_catalog;
DROP POLICY IF EXISTS "Authenticated read rewards" ON public.reward_catalog;
DROP POLICY IF EXISTS "Parents manage rewards" ON public.reward_catalog;
CREATE POLICY "Authenticated read rewards" ON public.reward_catalog
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Parents manage rewards" ON public.reward_catalog
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Kids manage own redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Parents view all redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Kids insert redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Kids view own redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Parents manage all redemptions" ON public.reward_redemptions;
CREATE POLICY "Kids insert redemptions" ON public.reward_redemptions
  FOR INSERT WITH CHECK (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Kids view own redemptions" ON public.reward_redemptions
  FOR SELECT USING (child_id IN (SELECT id FROM public.children WHERE user_id = auth.uid()));
CREATE POLICY "Parents manage all redemptions" ON public.reward_redemptions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));
