-- ============================================================
-- NEUROSTEP - Supabase Database Setup
-- ============================================================
-- Jalankan script ini di Supabase SQL Editor:
-- https://app.supabase.com → SQL Editor → New Query
--
-- Urutan eksekusi:
--   1. Ekstensi & tipe enum
--   2. Tabel
--   3. Row Level Security (RLS)
--   4. Storage bucket
-- ============================================================


-- ============================================================
-- 1. EKSTENSI
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- 2. TIPE ENUM
-- ============================================================

CREATE TYPE diabetes_status_enum AS ENUM (
  'Tipe 1',
  'Tipe 2',
  'Gestasional',
  'Pra-diabetes'
);

CREATE TYPE skin_condition_enum AS ENUM (
  'normal',
  'kering',
  'kemerahan',
  'pecah-pecah'
);

CREATE TYPE nerve_sensitivity_enum AS ENUM (
  'baik',
  'menurun',
  'sangat menurun'
);

CREATE TYPE risk_level_enum AS ENUM (
  'low',
  'medium',
  'high'
);

CREATE TYPE wound_location_enum AS ENUM (
  'Telapak kaki',
  'Sela jari',
  'Tumit',
  'Punggung kaki',
  'Sekitar kuku'
);


-- ============================================================
-- 3. TABEL
-- ============================================================

-- ------------------------------------------------------------
-- 3a. profiles
-- Diperluas dari auth.users bawaan Supabase.
-- Dibuat otomatis saat user baru mendaftar (lihat trigger di bawah).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: buat profil otomatis saat user baru mendaftar
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
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: perbarui updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ------------------------------------------------------------
-- 3b. assessments
-- Hasil penilaian kondisi kaki (Tahap 3 di UI).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assessments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_date     DATE NOT NULL,
  diabetes_status     diabetes_status_enum NOT NULL,
  pain_level          SMALLINT NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
  foot_temp           NUMERIC(4, 1) NOT NULL CHECK (foot_temp BETWEEN 20 AND 50),
  skin_condition      skin_condition_enum NOT NULL,
  nerve_sensitivity   nerve_sensitivity_enum NOT NULL,
  symptoms            TEXT[] NOT NULL DEFAULT '{}',
  risk_level          risk_level_enum NOT NULL,
  risk_title          TEXT NOT NULL,
  risk_score          SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assessments_user_id_idx
  ON public.assessments (user_id, created_at DESC);


-- ------------------------------------------------------------
-- 3c. daily_checks
-- Pemeriksaan kaki harian (Tahap 4 di UI).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_checks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  has_wound     BOOLEAN NOT NULL DEFAULT FALSE,
  feels_numb    BOOLEAN NOT NULL DEFAULT FALSE,
  nail_issue    BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url     TEXT,                    -- URL dari Supabase Storage
  photo_name    TEXT,                    -- Nama file asli
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS daily_checks_user_id_idx
  ON public.daily_checks (user_id, created_at DESC);


-- ------------------------------------------------------------
-- 3d. wound_notes
-- Catatan kondisi luka kaki (Tahap 7 di UI).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wound_notes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location      wound_location_enum NOT NULL,
  description   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wound_notes_user_id_idx
  ON public.wound_notes (user_id, created_at DESC);


-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- Setiap user hanya bisa membaca dan menulis data miliknya sendiri.
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User dapat melihat profil sendiri"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "User dapat memperbarui profil sendiri"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- assessments
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User dapat melihat assessment sendiri"
  ON public.assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User dapat membuat assessment"
  ON public.assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User dapat menghapus assessment sendiri"
  ON public.assessments FOR DELETE
  USING (auth.uid() = user_id);


-- daily_checks
ALTER TABLE public.daily_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User dapat melihat daily check sendiri"
  ON public.daily_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User dapat membuat daily check"
  ON public.daily_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User dapat menghapus daily check sendiri"
  ON public.daily_checks FOR DELETE
  USING (auth.uid() = user_id);


-- wound_notes
ALTER TABLE public.wound_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User dapat melihat catatan luka sendiri"
  ON public.wound_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User dapat membuat catatan luka"
  ON public.wound_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User dapat menghapus catatan luka sendiri"
  ON public.wound_notes FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- 5. STORAGE BUCKET (jalankan via Supabase Dashboard atau API)
-- ============================================================
-- Buat bucket "neurostep-uploads" di:
-- Supabase Dashboard → Storage → New Bucket
--   Name    : neurostep-uploads
--   Public  : false (private, akses via signed URL)
--
-- Atau jalankan query berikut jika menggunakan service role:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('neurostep-uploads', 'neurostep-uploads', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- Policy storage (jalankan setelah bucket dibuat):

-- INSERT INTO storage.policies (name, bucket_id, definition)
-- VALUES (
--   'User upload foto sendiri',
--   'neurostep-uploads',
--   '(auth.uid()::text = (storage.foldername(name))[1])'
-- );


-- ============================================================
-- SELESAI
-- ============================================================
-- Tabel yang dibuat:
--   public.profiles       → data profil user
--   public.assessments    → penilaian kondisi kaki
--   public.daily_checks   → pemeriksaan harian
--   public.wound_notes    → catatan luka
-- ============================================================
