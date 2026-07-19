-- Lifestyle videos
CREATE TABLE public.lifestyle_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url text NOT NULL,
  title text,
  description text,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lifestyle_videos TO anon, authenticated;
GRANT ALL ON public.lifestyle_videos TO service_role;
ALTER TABLE public.lifestyle_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active lifestyle videos" ON public.lifestyle_videos FOR SELECT TO anon, authenticated USING (active = true);
CREATE TRIGGER trg_lv_updated BEFORE UPDATE ON public.lifestyle_videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Newsletters
CREATE TABLE public.newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.newsletters TO anon, authenticated;
GRANT ALL ON public.newsletters TO service_role;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active newsletters" ON public.newsletters FOR SELECT TO anon, authenticated USING (active = true);
CREATE TRIGGER trg_nl_updated BEFORE UPDATE ON public.newsletters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Home slides
CREATE TABLE public.home_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  caption text,
  link_url text,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.home_slides TO anon, authenticated;
GRANT ALL ON public.home_slides TO service_role;
ALTER TABLE public.home_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active home slides" ON public.home_slides FOR SELECT TO anon, authenticated USING (active = true);
CREATE TRIGGER trg_hs_updated BEFORE UPDATE ON public.home_slides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Push subscriptions (public can subscribe; only server reads/sends)
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can subscribe" ON public.push_subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Follow-up date on OP register
ALTER TABLE public.op_register ADD COLUMN IF NOT EXISTS next_followup_date date;
CREATE INDEX IF NOT EXISTS idx_op_next_followup ON public.op_register(next_followup_date) WHERE next_followup_date IS NOT NULL;