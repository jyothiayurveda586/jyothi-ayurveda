-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  bio TEXT,
  timings TEXT,
  photo_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  available_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_minutes integer NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon, authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors public read" ON public.doctors FOR SELECT USING (active = true);
CREATE TRIGGER trg_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INT,
  price NUMERIC(10,2),
  display_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.treatments TO anon, authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Treatments public read" ON public.treatments FOR SELECT USING (active = true);
CREATE TRIGGER trg_treatments_updated BEFORE UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE POLICY "Patients create own appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (auth.uid() = patient_id);
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.op_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_number SERIAL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  age INT,
  gender TEXT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint TEXT,
  diagnosis TEXT,
  treatment_notes TEXT,
  prescription TEXT,
  fee NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.op_register TO authenticated;
GRANT ALL ON public.op_register TO service_role;
ALTER TABLE public.op_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients read own op entries" ON public.op_register FOR SELECT TO authenticated USING (auth.uid() = patient_id);
CREATE TRIGGER trg_op_updated BEFORE UPDATE ON public.op_register FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.hospital_settings (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Ayurveda Hospital',
  tagline TEXT DEFAULT 'Ancient healing, modern care',
  about TEXT DEFAULT 'Welcome to our Ayurveda hospital, dedicated to authentic traditional healing.',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  hours TEXT DEFAULT 'Mon-Sat: 8:00 AM - 8:00 PM',
  map_url text,
  banners jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_statuses jsonb NOT NULL DEFAULT '[]'::jsonb,
  whatsapp_url text,
  instagram_url text,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.hospital_settings TO anon, authenticated;
GRANT ALL ON public.hospital_settings TO service_role;
ALTER TABLE public.hospital_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hospital settings public read" ON public.hospital_settings FOR SELECT USING (true);
INSERT INTO public.hospital_settings (id) VALUES (1);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_admin CHECK (id = 1)
);
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_config (id, password_hash)
VALUES (1, encode(digest('ayurveda-admin', 'sha256'), 'hex'));

INSERT INTO public.treatments (name, description, duration_minutes, price, display_order) VALUES
  ('Panchakarma', 'Complete detoxification therapy involving five cleansing procedures.', 90, 3500, 1),
  ('Shirodhara', 'Warm medicated oil is poured over the forehead to calm the mind.', 60, 2000, 2),
  ('Abhyanga', 'Full-body warm oil massage to balance doshas.', 60, 1800, 3),
  ('Kizhi', 'Herbal poultice therapy for joint and muscle pain.', 45, 1500, 4),
  ('Nasya', 'Nasal administration of medicated oils for sinus and head conditions.', 30, 900, 5),
  ('Consultation', 'One-on-one consultation with an Ayurvedic physician.', 30, 500, 6);

INSERT INTO public.doctors (name, specialization, bio, timings, display_order) VALUES
  ('Dr. Aparna Menon', 'Panchakarma Specialist', '20+ years of clinical experience in classical Panchakarma treatments.', 'Mon-Fri, 9 AM - 1 PM', 1),
  ('Dr. Ravi Sharma', 'Ayurvedic Physician', 'BAMS, MD (Ayu). Focus on lifestyle and chronic disease management.', 'Mon-Sat, 2 PM - 7 PM', 2);

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE POLICY "Public read hospital-media public folders"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'hospital-media'
  AND (storage.foldername(name))[1] IN ('banner', 'video', 'thumb')
);