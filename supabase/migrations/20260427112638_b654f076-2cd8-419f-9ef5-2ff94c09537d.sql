-- 1) Excluir usuário admin atual (cascata limpa profile, roles, daily_entries via created_by ficar null)
DELETE FROM public.daily_entries WHERE created_by = '040c7b2e-5c76-4961-bf0d-edcb08024b2f';
DELETE FROM public.user_roles WHERE user_id = '040c7b2e-5c76-4961-bf0d-edcb08024b2f';
DELETE FROM public.profiles WHERE id = '040c7b2e-5c76-4961-bf0d-edcb08024b2f';
DELETE FROM auth.users WHERE id = '040c7b2e-5c76-4961-bf0d-edcb08024b2f';

-- 2) Tabela de horas de mão de obra
CREATE TABLE public.daily_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL UNIQUE,
  -- Supervisão (HH)
  sup_24h NUMERIC NOT NULL DEFAULT 0,
  sup_adm NUMERIC NOT NULL DEFAULT 0,
  sup_adn NUMERIC NOT NULL DEFAULT 0,
  sup_he65 NUMERIC NOT NULL DEFAULT 0,
  sup_he100 NUMERIC NOT NULL DEFAULT 0,
  -- Identificação e Operação (HH)
  ope_24h NUMERIC NOT NULL DEFAULT 0,
  ope_adm NUMERIC NOT NULL DEFAULT 0,
  ope_adn NUMERIC NOT NULL DEFAULT 0,
  ope_he65 NUMERIC NOT NULL DEFAULT 0,
  ope_he100 NUMERIC NOT NULL DEFAULT 0,
  -- Outros (HH)
  enc_adn NUMERIC NOT NULL DEFAULT 0,
  enc_he65 NUMERIC NOT NULL DEFAULT 0,
  enc_he100 NUMERIC NOT NULL DEFAULT 0,
  tst_adn NUMERIC NOT NULL DEFAULT 0,
  tst_he65 NUMERIC NOT NULL DEFAULT 0,
  tst_he100 NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view hours" ON public.daily_hours FOR SELECT TO authenticated USING (true);
CREATE POLICY "Operators insert hours" ON public.daily_hours FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operador'::app_role));
CREATE POLICY "Operators update hours" ON public.daily_hours FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'operador'::app_role));
CREATE POLICY "Admins delete hours" ON public.daily_hours FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_daily_hours_updated BEFORE UPDATE ON public.daily_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Tabela de preços unitários (para o relatório financeiro Controle Diário)
CREATE TABLE public.service_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_no INT NOT NULL UNIQUE,
  ref TEXT,
  description TEXT NOT NULL,
  group_label TEXT NOT NULL, -- 'CONTROLADORIA' ou 'FUNDIÇÃO'
  unit TEXT NOT NULL, -- ton, pilha, hh
  unit_price NUMERIC NOT NULL DEFAULT 0,
  source_kind TEXT NOT NULL, -- 'service_op','service_eq','hour'
  source_key TEXT NOT NULL,  -- chave do serviço ou da hora
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view prices" ON public.service_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage prices" ON public.service_prices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_service_prices_updated BEFORE UPDATE ON public.service_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Seed dos preços (CONTROLADORIA primeiro, depois FUNDIÇÃO — exatamente como no Excel)
INSERT INTO public.service_prices (line_no, ref, description, group_label, unit, unit_price, source_kind, source_key, display_order) VALUES
-- CONTROLADORIA
(90,  '5.',   'Movim. Pilha Pát.Int/Estoc. - Oper',          'CONTROLADORIA','ton', 2.27, 'service_op','s5_mov_estocagem',         1),
(100, '5.',   'Movim. Pilha Pát.Int/Estoc. - Equip',         'CONTROLADORIA','ton', 1.42, 'service_eq','s5_mov_estocagem',         2),
(110, '6.',   'Trans. Pilha Pát.Estoc/Carret - Oper adm',    'CONTROLADORIA','ton', 0.93, 'service_op','s6_transp_carreta_adm',    3),
(120, '6.',   'Trans. Pilha Pát.Estoc/Carret - Equ adm',     'CONTROLADORIA','ton', 0.65, 'service_eq','s6_transp_carreta_adm',    4),
(130, '7.',   'Trans.Pilha Pát.Est./Car. - Oper ForaAdm',    'CONTROLADORIA','ton', 0.93, 'service_op','s7_transp_carreta_fora',   5),
(140, '7.',   'Trans.Pilha Pát.Est./Car - Equip ForaAdm',    'CONTROLADORIA','ton', 0.65, 'service_eq','s7_transp_carreta_fora',   6),
(150, '8.',   'Transp.Pilha Pát.Est/Porto - Oper',           'CONTROLADORIA','ton', 3.47, 'service_op','s8_transp_porto',          7),
(160, '8.',   'Transp.Pilha Pát.Est/Porto - Equip',          'CONTROLADORIA','ton', 8.93, 'service_eq','s8_transp_porto',          8),
(170, '8.hh', 'Supervisor 24 horas',                          'CONTROLADORIA','hh', 78.47, 'hour','sup_24h',                       9),
(180, '9.hh', 'Supervisor Adm',                               'CONTROLADORIA','hh', 66.61, 'hour','sup_adm',                      10),
(190, 'NA',   'Identif. e Operação Expedição - Oper 24h',    'CONTROLADORIA','hh', 40.31, 'hour','ope_24h',                      11),
(200, '10.RH','Identif. e Operação Expedição - Oper adm',    'CONTROLADORIA','hh', 34.22, 'hour','ope_adm',                      12),
(250, 'RH',   'Supervisor - Adicional Noturno',               'CONTROLADORIA','hh', 11.39, 'hour','sup_adn',                      13),
(260, 'RH',   'Supervisor - Horas Extras (65%)',              'CONTROLADORIA','hh', 73.38, 'hour','sup_he65',                     14),
(270, 'RH',   'Supervisor - Horas Extras (100%)',             'CONTROLADORIA','hh', 97.84, 'hour','sup_he100',                    15),
(280, 'RH',   'Operador - Adicional Noturno',                 'CONTROLADORIA','hh',  4.91, 'hour','ope_adn',                      16),
(290, 'RH',   'Operador - Horas Extras (65%)',                'CONTROLADORIA','hh', 31.64, 'hour','ope_he65',                     17),
(300, 'RH',   'Operador - Horas Extras (100%)',               'CONTROLADORIA','hh', 42.18, 'hour','ope_he100',                    18),
(310, 'RH',   'Encarregado - Adicional Noturno',              'CONTROLADORIA','hh', 14.18, 'hour','enc_adn',                      19),
(320, 'RH',   'Encarregado - Horas Extras (65%)',             'CONTROLADORIA','hh', 91.40, 'hour','enc_he65',                     20),
(330, 'RH',   'Encarregado - Horas Extras (100%)',            'CONTROLADORIA','hh',121.86, 'hour','enc_he100',                    21),
(340, 'RH',   'TST - Adicional Noturno',                      'CONTROLADORIA','hh',  8.02, 'hour','tst_adn',                      22),
(350, 'RH',   'TST - Horas Extras (65%)',                     'CONTROLADORIA','hh', 51.68, 'hour','tst_he65',                     23),
(360, 'RH',   'TST - Horas Extras (100%)',                    'CONTROLADORIA','hh', 68.91, 'hour','tst_he100',                    24),
-- FUNDIÇÃO
(10,  '1.',   'Movim. Pilha Lingoteira/Pát.Int. - Oper',     'FUNDIÇÃO','ton', 3.68, 'service_op','s1_mov_lingoteiras',          25),
(20,  '1.',   'Movim. Pilha Lingoteira/Pát.Int. - Equip',    'FUNDIÇÃO','ton', 1.51, 'service_eq','s1_mov_lingoteiras',          26),
(30,  '2.',   'Embalagem de Pilhas - Oper',                  'FUNDIÇÃO','pilha', 7.24, 'service_op','s2_embalagem_pet',          27),
(40,  '2.',   'Embalagem de Pilhas - Equip',                 'FUNDIÇÃO','pilha', 0.78, 'service_eq','s2_embalagem_pet',          28),
(50,  '3.',   'Movim. Pilha Pát.Int./TL - TL/Estoc - Op',    'FUNDIÇÃO','ton', 2.89, 'service_op','s3_mov_toplifting',           29),
(60,  '3.',   'Movim. Pilha Pát.Int./TL - TL/Estoc - Eq',    'FUNDIÇÃO','ton', 1.42, 'service_eq','s3_mov_toplifting',           30),
(70,  '4.',   'Cintagem - Fita Metálica - Oper',             'FUNDIÇÃO','pilha', 3.35, 'service_op','s4_cintagem_metalica',      31),
(80,  '4.',   'Cintagem - Fita Metálica - Equip',            'FUNDIÇÃO','pilha', 1.42, 'service_eq','s4_cintagem_metalica',      32),
(210, NULL,   'Movim.Pilha Pát.Est/TL - Oper',               'FUNDIÇÃO','ton', 2.27, 'service_op','s9_mov_toplifting_estoq',    33),
(220, NULL,   'Movim.Pilha Pát.Est/TL - Equip',              'FUNDIÇÃO','ton', 1.42, 'service_eq','s9_mov_toplifting_estoq',    34),
(230, NULL,   'Movim.Pilha Pát.Est/Prod.NC - Oper',          'FUNDIÇÃO','ton', 2.27, 'service_op','s10_mov_nao_conforme',       35),
(240, NULL,   'Movim.Pilha Pát.Est/Prod.NC - Equip',         'FUNDIÇÃO','ton', 1.42, 'service_eq','s10_mov_nao_conforme',       36);