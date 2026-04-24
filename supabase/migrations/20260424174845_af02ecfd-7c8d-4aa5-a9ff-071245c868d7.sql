
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'operador', 'diretoria');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL UNIQUE,
  -- Cintagem por pilha
  s2_embalagem_pet NUMERIC NOT NULL DEFAULT 0,        -- 2. PET (PILHA) - Fundição
  s4_cintagem_metalica NUMERIC NOT NULL DEFAULT 0,    -- 4. Metálica (PILHA) - Fundição
  -- Movimentação (TON)
  s1_mov_lingoteiras NUMERIC NOT NULL DEFAULT 0,      -- 1. Fundição
  s3_mov_toplifting NUMERIC NOT NULL DEFAULT 0,       -- 3. Fundição
  s5_mov_estocagem NUMERIC NOT NULL DEFAULT 0,        -- 5. Controladoria
  -- Movimentação eventual (TON)
  s6_transp_carreta_adm NUMERIC NOT NULL DEFAULT 0,   -- 6. Controladoria
  s7_transp_carreta_fora NUMERIC NOT NULL DEFAULT 0,  -- 7. Controladoria
  s9_mov_toplifting_estoq NUMERIC NOT NULL DEFAULT 0, -- 9. Fundição
  s10_mov_nao_conforme NUMERIC NOT NULL DEFAULT 0,    -- 10. Fundição
  -- Exportação (TON)
  s8_transp_porto NUMERIC NOT NULL DEFAULT 0,         -- 8. Controladoria
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_entries_date ON public.daily_entries(entry_date DESC);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_entries ENABLE ROW LEVEL SECURITY;

-- Security definer for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$ SELECT auth.uid() IS NOT NULL; $$;

-- Profiles policies
CREATE POLICY "Profiles viewable by authenticated"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- daily_entries policies: anyone authenticated can view; admin/operador can insert/update; admin can delete
CREATE POLICY "Authenticated view entries"
ON public.daily_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Operators insert entries"
ON public.daily_entries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Operators update entries"
ON public.daily_entries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Admins delete entries"
ON public.daily_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to set updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_entries_updated BEFORE UPDATE ON public.daily_entries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO v_count FROM auth.users;
  IF v_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operador');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
