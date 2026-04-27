-- ============================================================
-- NEUROSTEP - Supabase Database Setup (v2 - Fixed)
-- ============================================================
-- Jalankan script ini di Supabase SQL Editor:
-- https://app.supabase.com → SQL Editor → New Query
--
-- Jalankan SEKALI dari atas ke bawah.
-- Jika ingin reset, jalankan bagian DROP di bawah dulu.
-- ============================================================


-- ============================================================
-- [OPSIONAL] RESET — hapus semua jika ingin mulai ulang
-- ============================================================
-- DROP TABLE IF EXISTS public.wound_notes CASCADE;
-- DROP TABLE IF EXISTS public.daily_checks CASCADE;
-- DROP TABLE IF EXISTS public.assessments CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_user();
-- DROP FUNCTION IF EXISTS public.set_updated_at();
-- DROP TYPE IF EXISTS diabetes_status_enum;
-- DROP TYPE IF EXISTS skin_condition_enum;
-- DROP TYPE IF EXISTS nerve_sensitivity_enum;
-- DROP TYPE IF EXISTS risk_level_enum;
-- DROP TYPE IF EXISTS wound_location_enum;


-- ============================================================
-- 1. EKSTENSI
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. TIPE ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE diabetes_status_enum AS ENUM ('Tipe 1','Tipe 2','Gestasional','Pra-diabetes');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE skin_condition_enum AS ENUM ('normal','kering','kemerahan','pecah-pecah');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE nerve_sensitivity_enum AS ENUM ('baik','menurun','sangat menurun');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE risk_level_enum AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wound_location_enum AS ENUM ('Telapak kaki','Sela jari','Tumit','Punggung kaki','Sekitar kuku');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 3. TABEL
-- ============================================================

-- ------------------------------------------------------------
-- 3a. profiles
-- Satu baris per user, dibuat otomatis via trigger saat signup.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3b. assessments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_date   DATE        NOT NULL,
  diabetes_status   diabetes_status_enum  NOT NULL,
  pain_level        SMALLINT    NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
  foot_temp         NUMERIC(4,1) NOT NULL CHECK (foot_temp BETWEEN 20 AND 50),
  skin_condition    skin_condition_enum   NOT NULL,
  nerve_sensitivity nerve_sensitivity_enum NOT NULL,
  symptoms          TEXT[]      NOT NULL DEFAULT '{}',
  risk_level        risk_level_enum NOT NULL,
  risk_title        TEXT        NOT NULL,
  risk_score        SMALLINT    NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assessments_user_id_idx
  ON public.assessments (user_id, created_at DESC);

-- ------------------------------------------------------------
-- 3c. daily_checks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_wound   BOOLEAN     NOT NULL DEFAULT FALSE,
  feels_numb  BOOLEAN     NOT NULL DEFAULT FALSE,
  nail_issue  BOOLEAN     NOT NULL DEFAULT FALSE,
  photo_url   TEXT,
  photo_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_checks_user_id_idx
  ON public.daily_checks (user_id, created_at DESC);

-- ------------------------------------------------------------
-- 3d. wound_notes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wound_notes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location    wound_location_enum NOT NULL,
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wound_notes_user_id_idx
  ON public.wound_notes (user_id, created_at DESC);


-- ============================================================
-- 4. FUNGSI & TRIGGER
-- ============================================================

-- Fungsi: buat profil otomatis saat user baru mendaftar via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Pasang trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fungsi: perbarui kolom updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- --- profiles ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- INSERT diizinkan agar trigger SECURITY DEFINER bisa menulis
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);


-- --- assessments ---
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessments_select" ON public.assessments;
DROP POLICY IF EXISTS "assessments_insert" ON public.assessments;
DROP POLICY IF EXISTS "assessments_delete" ON public.assessments;

CREATE POLICY "assessments_select" ON public.assessments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "assessments_insert" ON public.assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assessments_delete" ON public.assessments
  FOR DELETE USING (auth.uid() = user_id);


-- --- daily_checks ---
ALTER TABLE public.daily_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_checks_select" ON public.daily_checks;
DROP POLICY IF EXISTS "daily_checks_insert" ON public.daily_checks;
DROP POLICY IF EXISTS "daily_checks_delete" ON public.daily_checks;

CREATE POLICY "daily_checks_select" ON public.daily_checks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_checks_insert" ON public.daily_checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_checks_delete" ON public.daily_checks
  FOR DELETE USING (auth.uid() = user_id);


-- --- wound_notes ---
ALTER TABLE public.wound_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wound_notes_select" ON public.wound_notes;
DROP POLICY IF EXISTS "wound_notes_insert" ON public.wound_notes;
DROP POLICY IF EXISTS "wound_notes_delete" ON public.wound_notes;

CREATE POLICY "wound_notes_select" ON public.wound_notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wound_notes_insert" ON public.wound_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wound_notes_delete" ON public.wound_notes
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- 6. STORAGE BUCKET
-- ============================================================
-- Buat bucket di: Supabase Dashboard → Storage → New Bucket
--   Name   : neurostep-uploads
--   Public : false
--
-- Lalu tambahkan policy storage berikut di SQL Editor:
-- (Ganti 'neurostep-uploads' jika nama bucket berbeda)

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('neurostep-uploads', 'neurostep-uploads', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage RLS — user hanya bisa akses folder miliknya sendiri:
-- CREATE POLICY "storage_user_upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'neurostep-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "storage_user_select"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'neurostep-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);


-- ============================================================
-- SELESAI
-- ============================================================
-- Tabel:
--   public.profiles       → profil user (dibuat otomatis saat signup)
--   public.assessments    → penilaian kondisi kaki
--   public.daily_checks   → pemeriksaan harian
--   public.wound_notes    → catatan luka
--
-- Pastikan di Supabase Dashboard → Authentication → Settings:
--   "Enable email confirmations" → matikan dulu saat testing
--   agar user bisa langsung login tanpa konfirmasi email.
-- ============================================================
