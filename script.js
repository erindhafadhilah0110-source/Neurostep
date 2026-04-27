// ============================================================
// NEUROSTEP - script.js
// Auth & data sepenuhnya menggunakan Supabase
// ============================================================

// --- Inisialisasi Supabase client ---
const supabase = window.supabase.createClient(
  CONFIG.supabase.url,
  CONFIG.supabase.anonKey
);

// --- Elemen DOM ---
const authScreen          = document.getElementById("authScreen");
const dashboardScreen     = document.getElementById("dashboardScreen");
const authMessage         = document.getElementById("authMessage");
const welcomeText         = document.getElementById("welcomeText");
const dailyStatusTitle    = document.getElementById("dailyStatusTitle");
const dailyStatusCopy     = document.getElementById("dailyStatusCopy");
const dashboardStatusBadge = document.getElementById("dashboardStatusBadge");
const totalAssessments    = document.getElementById("totalAssessments");
const totalDailyChecks    = document.getElementById("totalDailyChecks");
const totalNotes          = document.getElementById("totalNotes");
const historyList         = document.getElementById("historyList");
const todayStatusCard     = document.getElementById("todayStatusCard");
const todayStatusLabel    = document.getElementById("todayStatusLabel");
const todayStatusMessage  = document.getElementById("todayStatusMessage");
const assessmentResult    = document.getElementById("assessmentResult");
const painLevel           = document.getElementById("painLevel");
const painValue           = document.getElementById("painValue");

document.getElementById("assessmentDate").value = new Date().toISOString().split("T")[0];

// ============================================================
// UTILITAS UI
// ============================================================
function showMessage(element, text, type = "success") {
  element.textContent = text;
  element.className = `message-box show ${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message-box";
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.textContent = loading ? "Memproses..." : btn.dataset.label;
}

function switchAuthTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.authTab === tab)
  );
  document.getElementById("loginForm").classList.toggle("active", tab === "login");
  document.getElementById("registerForm").classList.toggle("active", tab === "register");
  clearMessage(authMessage);
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove("hidden");
  if (modalId === "historyModal") renderHistory();
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

// ============================================================
// RENDER APP — cek sesi aktif
// ============================================================
async function renderApp() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    authScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
    return;
  }

  // Ambil nama dari tabel profiles
  const { data: profile } = await supabase
    .from(CONFIG.tables.profiles)
    .select("full_name")
    .eq("id", session.user.id)
    .single();

  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
  welcomeText.textContent = `Selamat datang kembali, ${profile?.full_name || session.user.email}`;
  renderDashboardSummary();
}

// ============================================================
// AUTH — REGISTER
// ============================================================
document.getElementById("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const btn = event.target.querySelector(".primary-btn");
  btn.dataset.label = btn.textContent;

  const name     = document.getElementById("registerName").value.trim();
  const email    = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const confirm  = document.getElementById("registerConfirm").value;

  if (!name || !email || !password) {
    showMessage(authMessage, "Semua kolom registrasi wajib diisi.", "error");
    return;
  }
  if (password !== confirm) {
    showMessage(authMessage, "Konfirmasi password tidak sama.", "error");
    return;
  }
  if (password.length < 6) {
    showMessage(authMessage, "Password minimal 6 karakter.", "error");
    return;
  }

  setLoading(btn, true);

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name }   // disimpan ke raw_user_meta_data → trigger buat profil
    }
  });

  setLoading(btn, false);

  if (error) {
    showMessage(authMessage, error.message, "error");
    return;
  }

  event.target.reset();
  switchAuthTab("login");
  showMessage(
    authMessage,
    "Akun berhasil dibuat! Silakan cek email untuk konfirmasi, lalu login.",
    "success"
  );
});

// ============================================================
// AUTH — LOGIN
// ============================================================
document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const btn = event.target.querySelector(".primary-btn");
  btn.dataset.label = btn.textContent;

  const email    = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  setLoading(btn, true);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  setLoading(btn, false);

  if (error) {
    showMessage(authMessage, "Email atau password tidak cocok.", "error");
    return;
  }

  clearMessage(authMessage);
  event.target.reset();
  renderApp();
});

// ============================================================
// AUTH — LOGOUT
// ============================================================
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  renderApp();
  switchAuthTab("login");
});

// ============================================================
// DASHBOARD SUMMARY
// ============================================================
async function renderDashboardSummary() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const uid = session.user.id;

  const [
    { count: countAssessments },
    { count: countChecks },
    { count: countNotes },
    { data: latestAssessments }
  ] = await Promise.all([
    supabase.from(CONFIG.tables.assessments).select("*", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from(CONFIG.tables.dailyChecks).select("*", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from(CONFIG.tables.notes).select("*", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from(CONFIG.tables.assessments)
      .select("risk_level, risk_title, risk_score")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1)
  ]);

  totalAssessments.textContent = countAssessments ?? 0;
  totalDailyChecks.textContent = countChecks ?? 0;
  totalNotes.textContent       = countNotes ?? 0;

  const latest = latestAssessments?.[0];
  if (!latest) {
    dailyStatusTitle.textContent = "Normal";
    dailyStatusCopy.textContent  = "Belum ada hasil penilaian terbaru. Silakan lakukan checklist untuk memulai.";
    dashboardStatusBadge.textContent = "Siap Cek";
    dashboardStatusBadge.style.background = "rgba(22, 119, 216, 0.12)";
    dashboardStatusBadge.style.color = "#0e4f9e";
    return;
  }

  if (latest.risk_level === "high") {
    dailyStatusTitle.textContent = "Risiko Tinggi";
    dailyStatusCopy.textContent  = "Segera hubungi dokter. Sistem mendeteksi kondisi yang perlu tindakan cepat.";
    dashboardStatusBadge.textContent = "Darurat";
    dashboardStatusBadge.style.background = "rgba(214, 73, 95, 0.14)";
    dashboardStatusBadge.style.color = "#b5233b";
  } else if (latest.risk_level === "medium") {
    dailyStatusTitle.textContent = "Risiko Sedang";
    dailyStatusCopy.textContent  = "Ada tanda peringatan. Lanjutkan perawatan dan pertimbangkan konsultasi dokter.";
    dashboardStatusBadge.textContent = "Waspada";
    dashboardStatusBadge.style.background = "rgba(212, 138, 25, 0.14)";
    dashboardStatusBadge.style.color = "#9a6310";
  } else {
    dailyStatusTitle.textContent = "Normal";
    dailyStatusCopy.textContent  = "Kaki Anda dalam kondisi baik.";
    dashboardStatusBadge.textContent = "Aman";
    dashboardStatusBadge.style.background = "rgba(30, 169, 113, 0.14)";
    dashboardStatusBadge.style.color = "#1b7f56";
  }
}

// ============================================================
// KALKULASI RISIKO
// ============================================================
function calculateRisk(payload) {
  let score = 0;
  score += Number(payload.painLevel) * 5;
  score += payload.footTemp >= 38 ? 25 : payload.footTemp >= 37 ? 12 : 0;
  score += payload.skinCondition === "normal" ? 0 : payload.skinCondition === "kering" ? 10 : 18;
  score += payload.nerveSensitivity === "baik" ? 0 : payload.nerveSensitivity === "menurun" ? 15 : 25;
  score += payload.symptoms.length * 10;
  if (payload.symptoms.includes("Luka terbuka")) score += 12;
  if (payload.symptoms.includes("Bengkak"))      score += 10;
  if (payload.symptoms.includes("Nyeri hebat"))  score += 10;

  const s = Math.min(score, 100);
  if (s >= 75) return { level: "high",   title: "Risiko Tinggi",        score: s };
  if (s >= 40) return { level: "medium", title: "Risiko Sedang",        score: s };
  return             { level: "low",    title: "Risiko Rendah (Normal)", score: s };
}

function resultContent(result, payload) {
  const riskFactors = payload.symptoms.length ? payload.symptoms.join(", ") : "Tidak ada gejala tambahan";
  const detail = `Nyeri ${payload.painLevel}/10, suhu ${payload.footTemp}°C, kulit ${payload.skinCondition}, sensitivitas ${payload.nerveSensitivity}.`;

  if (result.level === "high") {
    return `
      <h3>Segera Hubungi Dokter!</h3>
      <p>Skor risiko: <strong>${result.score}/100</strong></p>
      <p>${detail}</p>
      <p>Faktor risiko utama: ${riskFactors}</p>
      <h4>Penjelasan & edukasi</h4>
      <p>Kondisi ini dapat meningkatkan risiko komplikasi, infeksi, dan luka yang sulit sembuh pada kaki diabetes.</p>
      <h4>Rekomendasi perawatan</h4>
      <ul>
        <li>Jangan melakukan perawatan luka sendiri</li>
        <li>Segera hubungi dokter atau rumah sakit</li>
        <li>Hindari aktivitas berat dan tekanan pada kaki</li>
        <li>Cegah luka terbuka bertambah luas</li>
      </ul>
      <button class="primary-btn result-action" type="button">Hubungi Dokter Sekarang</button>
      <p class="system-note">Pesan siap dikirim ke dokter - RISIKO TINGGI</p>`;
  }
  if (result.level === "medium") {
    return `
      <h3>Perlu konsultasi ke dokter</h3>
      <p>Skor risiko: <strong>${result.score}/100</strong></p>
      <p>${detail}</p>
      <p>Faktor risiko: ${riskFactors}</p>
      <h4>Penjelasan & edukasi</h4>
      <p>Ada tanda yang perlu diperhatikan, seperti neuropati, kulit kering, atau peningkatan suhu kaki yang dapat memicu komplikasi.</p>
      <h4>Rekomendasi perawatan</h4>
      <ul>
        <li>Bersihkan dan keringkan kaki dengan lembut</li>
        <li>Gunakan pelembap pada area kulit kering</li>
        <li>Hindari berjalan tanpa alas kaki</li>
        <li>Jadwalkan pemeriksaan ke dokter</li>
      </ul>
      <button class="primary-btn result-action" type="button">Buat Janji Dokter</button>`;
  }
  return `
    <h3>Kondisi normal</h3>
    <p>Skor risiko: <strong>${result.score}/100</strong></p>
    <p>${detail}</p>
    <p>Faktor risiko: ${riskFactors}</p>
    <h4>Penjelasan & edukasi</h4>
    <p>Risiko diabetes terhadap kesehatan kaki masih rendah. Tetap lakukan pemeriksaan rutin untuk mencegah perubahan kondisi.</p>
    <h4>Rekomendasi perawatan</h4>
    <ul>
      <li>Membersihkan dan mengeringkan kaki setiap hari</li>
      <li>Menggunakan pelembap bila perlu</li>
      <li>Menghindari berjalan tanpa alas kaki</li>
      <li>Melakukan pemeriksaan rutin</li>
    </ul>
    <button class="primary-btn result-action" type="button">Lanjutkan Perawatan</button>`;
}

// ============================================================
// FORM — ASSESSMENT
// ============================================================
document.getElementById("assessmentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const btn = event.target.querySelector(".primary-btn");
  btn.dataset.label = btn.textContent;
  setLoading(btn, true);

  const { data: { session } } = await supabase.auth.getSession();
  const symptoms = [...event.target.querySelectorAll('input[type="checkbox"]:checked')].map((i) => i.value);

  const payload = {
    painLevel:        Number(document.getElementById("painLevel").value),
    footTemp:         Number(document.getElementById("footTemp").value),
    skinCondition:    document.getElementById("skinCondition").value,
    nerveSensitivity: document.getElementById("nerveSensitivity").value,
    symptoms
  };
  const result = calculateRisk(payload);

  const { error } = await supabase.from(CONFIG.tables.assessments).insert({
    user_id:          session.user.id,
    assessment_date:  document.getElementById("assessmentDate").value,
    diabetes_status:  document.getElementById("diabetesStatus").value,
    pain_level:       payload.painLevel,
    foot_temp:        payload.footTemp,
    skin_condition:   payload.skinCondition,
    nerve_sensitivity: payload.nerveSensitivity,
    symptoms:         payload.symptoms,
    risk_level:       result.level,
    risk_title:       result.title,
    risk_score:       result.score
  });

  setLoading(btn, false);

  if (error) {
    console.error(error);
    return;
  }

  assessmentResult.className = `result-card ${result.level}`;
  assessmentResult.innerHTML = resultContent(result, payload);
  assessmentResult.classList.remove("hidden");
  renderDashboardSummary();
});

// ============================================================
// FORM — DAILY CHECKLIST
// ============================================================
document.getElementById("dailyChecklistForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const msgEl = document.getElementById("dailyChecklistMessage");
  const btn   = event.target.querySelector(".primary-btn");
  btn.dataset.label = btn.textContent;
  setLoading(btn, true);

  const { data: { session } } = await supabase.auth.getSession();
  const file = document.getElementById("dailyUpload").files[0];

  if (file && file.size > CONFIG.upload.maxSizeBytes) {
    showMessage(msgEl, "Ukuran file melebihi 5MB.", "error");
    setLoading(btn, false);
    return;
  }

  let photoUrl  = null;
  let photoName = null;

  // Upload foto ke Supabase Storage jika ada
  if (file) {
    const ext      = file.name.split(".").pop();
    const filePath = `${session.user.id}/${Date.now()}.${ext}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CONFIG.supabase.storageBucket)
      .upload(filePath, file, { upsert: false });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from(CONFIG.supabase.storageBucket)
        .getPublicUrl(uploadData.path);
      photoUrl  = urlData.publicUrl;
      photoName = file.name;
    }
  }

  const { error } = await supabase.from(CONFIG.tables.dailyChecks).insert({
    user_id:    session.user.id,
    has_wound:  document.getElementById("hasWound").checked,
    feels_numb: document.getElementById("feelsNumb").checked,
    nail_issue: document.getElementById("nailIssue").checked,
    photo_url:  photoUrl,
    photo_name: photoName
  });

  setLoading(btn, false);

  if (error) {
    showMessage(msgEl, "Gagal menyimpan. Coba lagi.", "error");
    return;
  }

  event.target.reset();
  showMessage(msgEl, "Pemeriksaan harian berhasil disimpan.", "success");
  renderDashboardSummary();
});

// ============================================================
// FORM — CATATAN LUKA
// ============================================================
document.getElementById("notesForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const msgEl = document.getElementById("notesMessage");
  const btn   = event.target.querySelector(".primary-btn");
  btn.dataset.label = btn.textContent;
  setLoading(btn, true);

  const { data: { session } } = await supabase.auth.getSession();

  const { error } = await supabase.from(CONFIG.tables.notes).insert({
    user_id:     session.user.id,
    location:    document.getElementById("woundLocation").value,
    description: document.getElementById("woundDescription").value.trim()
  });

  setLoading(btn, false);

  if (error) {
    showMessage(msgEl, "Gagal menyimpan catatan. Coba lagi.", "error");
    return;
  }

  event.target.reset();
  showMessage(msgEl, "Catatan luka berhasil disimpan.", "success");
  renderDashboardSummary();
});

// ============================================================
// RIWAYAT
// ============================================================
async function renderHistory() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: assessments } = await supabase
    .from(CONFIG.tables.assessments)
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  historyList.innerHTML = "";

  if (!assessments || !assessments.length) {
    historyList.innerHTML = '<div class="history-item"><h4>Belum ada riwayat</h4><p>Data pemeriksaan akan muncul di sini setelah Anda melakukan penilaian.</p></div>';
    todayStatusCard.className = "status-alert";
    todayStatusLabel.textContent  = "Belum ada data hari ini";
    todayStatusMessage.textContent = "Silakan lakukan pemeriksaan untuk melihat status terkini.";
    return;
  }

  const latest = assessments[0];
  todayStatusCard.className = `status-alert ${latest.risk_level === "high" ? "danger" : latest.risk_level === "medium" ? "warning" : "normal"}`;
  todayStatusLabel.textContent  = latest.risk_title;
  todayStatusMessage.textContent = latest.risk_level === "high"
    ? "Indikator status menunjukkan kondisi serius. Disarankan segera konsultasi medis."
    : latest.risk_level === "medium"
      ? "Ada faktor risiko yang perlu diperhatikan dan ditindaklanjuti."
      : "Status hari ini stabil. Tetap lakukan perawatan kaki rutin.";

  assessments.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-item";
    card.innerHTML = `
      <h4>${item.risk_title} - ${item.risk_score}/100</h4>
      <p>${item.assessment_date} | DM ${item.diabetes_status} | Kulit ${item.skin_condition} | Saraf ${item.nerve_sensitivity}</p>
      <p>Nyeri ${item.pain_level}/10, suhu ${item.foot_temp}°C, gejala: ${item.symptoms?.length ? item.symptoms.join(", ") : "Tidak ada"}</p>
      <div class="history-meta">
        <span class="tag">${item.risk_level === "high" ? "Risiko tinggi" : item.risk_level === "medium" ? "Risiko sedang" : "Normal"}</span>
        <span class="tag">${new Date(item.created_at).toLocaleString("id-ID")}</span>
      </div>`;
    historyList.appendChild(card);
  });
}

// ============================================================
// EVENT LISTENERS LAINNYA
// ============================================================
document.querySelectorAll("[data-auth-tab]").forEach((b) =>
  b.addEventListener("click", () => switchAuthTab(b.dataset.authTab))
);
document.querySelector("[data-go-register]").addEventListener("click", () => switchAuthTab("register"));
document.querySelector("[data-go-login]").addEventListener("click",    () => switchAuthTab("login"));

document.querySelectorAll("[data-modal-target]").forEach((b) =>
  b.addEventListener("click", () => openModal(b.dataset.modalTarget))
);
document.querySelectorAll("[data-close-modal]").forEach((b) =>
  b.addEventListener("click", () => closeModal(b.closest(".modal")))
);
document.querySelectorAll(".modal").forEach((modal) =>
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); })
);

painLevel.addEventListener("input", () => { painValue.textContent = painLevel.value; });

document.querySelectorAll("[data-edu-tab]").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("[data-edu-tab]").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".education-panel").forEach((p) => p.classList.remove("active"));
    b.classList.add("active");
    document.querySelector(`[data-edu-panel="${b.dataset.eduTab}"]`).classList.add("active");
  });
});

document.getElementById("openProfileBtn").addEventListener("click", () => openModal("historyModal"));

// ============================================================
// INIT — pantau perubahan sesi (login/logout dari tab lain)
// ============================================================
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    renderApp();
  } else {
    authScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
  }
});

// Jalankan saat halaman pertama kali dibuka
renderApp();
