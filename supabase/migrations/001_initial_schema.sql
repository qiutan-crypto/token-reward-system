-- Token Reward System: Initial Schema
-- Run this in Supabase SQL Editor to set up all tables, RLS, and functions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('parent', 'kid')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Behavior rules catalog
CREATE TABLE IF NOT EXISTS public.behavior_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  token_value INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Token entries (ledger)
CREATE TABLE IF NOT EXISTS public.token_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kid_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  behavior_rule_id UUID REFERENCES public.behavior_rules(id) ON DELETE SET NULL,
  token_amount INTEGER NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('earn','spend','redeem','adjust')),
  note TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Prizes catalog
CREATE TABLE IF NOT EXISTS public.prizes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  token_cost INTEGER NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Redemptions log
CREATE TABLE IF NOT EXISTS public.redemptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  kid_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  prize_id UUID REFERENCES public.prizes(id) ON DELETE SET NULL,
  token_cost INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','cancelled')),
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.behavior_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- RLS: profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "parents_view_all_profiles" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'parent'));

-- RLS: behavior_rules
CREATE POLICY "auth_read_behaviors" ON public.behavior_rules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "parents_manage_behaviors" ON public.behavior_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

-- RLS: token_entries
CREATE POLICY "kids_view_own_entries" ON public.token_entries FOR SELECT USING (auth.uid() = kid_id);
CREATE POLICY "kids_insert_redeem" ON public.token_entries FOR INSERT WITH CHECK (auth.uid() = kid_id AND entry_type = 'redeem');
CREATE POLICY "parents_manage_entries" ON public.token_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

-- RLS: prizes
CREATE POLICY "auth_read_prizes" ON public.prizes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "parents_manage_prizes" ON public.prizes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

-- RLS: redemptions
CREATE POLICY "kids_own_redemptions" ON public.redemptions FOR ALL
  USING (auth.uid() = kid_id) WITH CHECK (auth.uid() = kid_id);
CREATE POLICY "parents_view_redemptions" ON public.redemptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'parent'));

-- Trigger: auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name','User'), COALESCE(NEW.raw_user_meta_data->>'role','kid'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function: get_token_balance
CREATE OR REPLACE FUNCTION public.get_token_balance(p_kid_id UUID)
RETURNS INTEGER AS $$
DECLARE v_earned INTEGER; v_spent INTEGER;
BEGIN
  SELECT COALESCE(SUM(token_amount),0) INTO v_earned FROM public.token_entries WHERE kid_id=p_kid_id AND entry_type='earn';
  SELECT COALESCE(SUM(token_amount),0) INTO v_spent FROM public.token_entries WHERE kid_id=p_kid_id AND entry_type IN ('spend','redeem');
  RETURN v_earned - v_spent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_monthly_report
CREATE OR REPLACE FUNCTION public.get_monthly_report(p_kid_id UUID, p_year INT, p_month INT)
RETURNS TABLE(behavior_title TEXT, count BIGINT, total_tokens BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(br.title, te.note, 'Other'), COUNT(*), SUM(te.token_amount)::BIGINT
  FROM public.token_entries te LEFT JOIN public.behavior_rules br ON te.behavior_rule_id=br.id
  WHERE te.kid_id=p_kid_id AND EXTRACT(YEAR FROM te.occurred_at)=p_year AND EXTRACT(MONTH FROM te.occurred_at)=p_month AND te.entry_type='earn'
  GROUP BY 1 ORDER BY 3 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data
INSERT INTO public.behavior_rules (title, description, token_value, category) VALUES
  ('按时完成作业','按时完成学校作业',5,'学习'),
  ('主动帮助家务','主动帮助做家务',3,'家务'),
  ('按时起床就寝','按时起床和就寝',2,'个人健康'),
  ('读书半小时','主动阅读半小时',4,'学习'),
  ('尊重长辈','对长辈礼貌周到',3,'品德'),
  ('认错并道歉','主动承认错误',5,'品德'),
  ('帮助小朋友','主动帮助小朋友',3,'品德')
ON CONFLICT DO NOTHING;
