// ============================================================
// NEUROSTEP - Konfigurasi Aplikasi
// ============================================================
// File ini membaca variabel dari .env (jika menggunakan bundler
// seperti Vite/Webpack) atau dapat diisi langsung untuk
// penggunaan vanilla HTML/JS tanpa build tool.
// ============================================================

const CONFIG = {
  // --- Supabase ---
  // Ganti nilai di bawah ini dengan kredensial dari dashboard Supabase Anda:
  // https://app.supabase.com → Project Settings → API
  supabase: {
    url: typeof process !== "undefined"
      ? process.env.SUPABASE_URL
      : "https://xssbuaatzhfhxsqckjxb.supabase.co",

    anonKey: typeof process !== "undefined"
      ? process.env.SUPABASE_ANON_KEY
      : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzc2J1YWF0emhmaHhzcWNranhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTcwMjksImV4cCI6MjA5Mjg3MzAyOX0.Djy9XsBAY3ABZROWQjAkMGk3KxtwtQWqbs1OOIfHo6k",

    storageBucket: typeof process !== "undefined"
      ? process.env.SUPABASE_STORAGE_BUCKET
      : "neurostep-uploads",
  },

  // --- Aplikasi ---
  app: {
    name: "NEUROSTEP",
    version: "1.0.0",
    env: typeof process !== "undefined"
      ? process.env.APP_ENV
      : "development",
  },

  // --- Tabel Supabase ---
  // Nama tabel yang digunakan di database
  tables: {
    profiles:    "profiles",
    assessments: "assessments",
    dailyChecks: "daily_checks",
    notes:       "wound_notes",
  },

  // --- Batas upload file ---
  upload: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedTypes: ["image/jpeg", "image/png"],
  },
};

// Validasi konfigurasi saat startup (hanya di development)
if (CONFIG.app.env === "development") {
  if (
    CONFIG.supabase.url.includes("your-project-id") ||
    CONFIG.supabase.anonKey.includes("your-anon-public-key")
  ) {
    console.warn(
      "[NEUROSTEP] Supabase belum dikonfigurasi. " +
      "Isi SUPABASE_URL dan SUPABASE_ANON_KEY di file .env atau config.js."
    );
  }
}
