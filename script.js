const storageKeys = {
  users: "neurostep_users",
  currentUser: "neurostep_current_user",
  assessments: "neurostep_assessments",
  dailyChecks: "neurostep_daily_checks",
  notes: "neurostep_notes"
};

const authScreen = document.getElementById("authScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const authMessage = document.getElementById("authMessage");
const welcomeText = document.getElementById("welcomeText");
const dailyStatusTitle = document.getElementById("dailyStatusTitle");
const dailyStatusCopy = document.getElementById("dailyStatusCopy");
const dashboardStatusBadge = document.getElementById("dashboardStatusBadge");
const totalAssessments = document.getElementById("totalAssessments");
const totalDailyChecks = document.getElementById("totalDailyChecks");
const totalNotes = document.getElementById("totalNotes");
const historyList = document.getElementById("historyList");
const todayStatusCard = document.getElementById("todayStatusCard");
const todayStatusLabel = document.getElementById("todayStatusLabel");
const todayStatusMessage = document.getElementById("todayStatusMessage");
const assessmentResult = document.getElementById("assessmentResult");
const painLevel = document.getElementById("painLevel");
const painValue = document.getElementById("painValue");

document.getElementById("assessmentDate").value = new Date().toISOString().split("T")[0];

const getData = (key) => JSON.parse(localStorage.getItem(key) || "[]");
const setData = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const getCurrentUser = () => JSON.parse(localStorage.getItem(storageKeys.currentUser) || "null");
const setCurrentUser = (user) => localStorage.setItem(storageKeys.currentUser, JSON.stringify(user));

function showMessage(element, text, type = "success") {
  element.textContent = text;
  element.className = `message-box show ${type}`;
}

function clearMessage(element) {
  element.textContent = "";
  element.className = "message-box";
}

function switchAuthTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.authTab === tab);
  });

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

function renderApp() {
  const user = getCurrentUser();
  if (!user) {
    authScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
    return;
  }

  authScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");
  welcomeText.textContent = `Selamat datang kembali, ${user.name}`;
  renderDashboardSummary();
}

function getUserItems(key) {
  const user = getCurrentUser();
  return getData(key).filter((item) => item.userEmail === user?.email);
}

function saveUserItem(key, item) {
  const items = getData(key);
  items.unshift(item);
  setData(key, items);
}

function calculateRisk(payload) {
  let score = 0;

  score += Number(payload.painLevel) * 5;
  score += payload.footTemp >= 38 ? 25 : payload.footTemp >= 37 ? 12 : 0;
  score += payload.skinCondition === "normal" ? 0 : payload.skinCondition === "kering" ? 10 : 18;
  score += payload.nerveSensitivity === "baik" ? 0 : payload.nerveSensitivity === "menurun" ? 15 : 25;
  score += payload.symptoms.length * 10;

  if (payload.symptoms.includes("Luka terbuka")) score += 12;
  if (payload.symptoms.includes("Bengkak")) score += 10;
  if (payload.symptoms.includes("Nyeri hebat")) score += 10;

  const boundedScore = Math.min(score, 100);
  if (boundedScore >= 75) return { level: "high", title: "Risiko Tinggi", score: boundedScore };
  if (boundedScore >= 40) return { level: "medium", title: "Risiko Sedang", score: boundedScore };
  return { level: "low", title: "Risiko Rendah (Normal)", score: boundedScore };
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
      <p class="system-note">Pesan siap dikirim ke dokter - RISIKO TINGGI</p>
    `;
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
      <button class="primary-btn result-action" type="button">Buat Janji Dokter</button>
    `;
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
    <button class="primary-btn result-action" type="button">Lanjutkan Perawatan</button>
  `;
}

function renderDashboardSummary() {
  const assessments = getUserItems(storageKeys.assessments);
  const dailyChecks = getUserItems(storageKeys.dailyChecks);
  const notes = getUserItems(storageKeys.notes);

  totalAssessments.textContent = assessments.length;
  totalDailyChecks.textContent = dailyChecks.length;
  totalNotes.textContent = notes.length;

  const latestAssessment = assessments[0];
  if (!latestAssessment) {
    dailyStatusTitle.textContent = "Normal";
    dailyStatusCopy.textContent = "Belum ada hasil penilaian terbaru. Silakan lakukan checklist untuk memulai.";
    dashboardStatusBadge.textContent = "Siap Cek";
    dashboardStatusBadge.style.background = "rgba(22, 119, 216, 0.12)";
    dashboardStatusBadge.style.color = "#0e4f9e";
    return;
  }

  if (latestAssessment.result.level === "high") {
    dailyStatusTitle.textContent = "Risiko Tinggi";
    dailyStatusCopy.textContent = "Segera hubungi dokter. Sistem mendeteksi kondisi yang perlu tindakan cepat.";
    dashboardStatusBadge.textContent = "Darurat";
    dashboardStatusBadge.style.background = "rgba(214, 73, 95, 0.14)";
    dashboardStatusBadge.style.color = "#b5233b";
  } else if (latestAssessment.result.level === "medium") {
    dailyStatusTitle.textContent = "Risiko Sedang";
    dailyStatusCopy.textContent = "Ada tanda peringatan. Lanjutkan perawatan dan pertimbangkan konsultasi dokter.";
    dashboardStatusBadge.textContent = "Waspada";
    dashboardStatusBadge.style.background = "rgba(212, 138, 25, 0.14)";
    dashboardStatusBadge.style.color = "#9a6310";
  } else {
    dailyStatusTitle.textContent = "Normal";
    dailyStatusCopy.textContent = "Kaki Anda dalam kondisi baik.";
    dashboardStatusBadge.textContent = "Aman";
    dashboardStatusBadge.style.background = "rgba(30, 169, 113, 0.14)";
    dashboardStatusBadge.style.color = "#1b7f56";
  }
}

function renderHistory() {
  const assessments = getUserItems(storageKeys.assessments);
  historyList.innerHTML = "";

  if (!assessments.length) {
    historyList.innerHTML = '<div class="history-item"><h4>Belum ada riwayat</h4><p>Data pemeriksaan akan muncul di sini setelah Anda melakukan penilaian.</p></div>';
    todayStatusCard.className = "status-alert";
    todayStatusLabel.textContent = "Belum ada data hari ini";
    todayStatusMessage.textContent = "Silakan lakukan pemeriksaan untuk melihat status terkini.";
    return;
  }

  const latest = assessments[0];
  todayStatusCard.className = `status-alert ${latest.result.level === "high" ? "danger" : latest.result.level === "medium" ? "warning" : "normal"}`;
  todayStatusLabel.textContent = latest.result.title;
  todayStatusMessage.textContent = latest.result.level === "high"
    ? "Indikator status menunjukkan kondisi serius. Disarankan segera konsultasi medis."
    : latest.result.level === "medium"
      ? "Ada faktor risiko yang perlu diperhatikan dan ditindaklanjuti."
      : "Status hari ini stabil. Tetap lakukan perawatan kaki rutin.";

  assessments.forEach((item) => {
    const card = document.createElement("article");
    card.className = "history-item";
    card.innerHTML = `
      <h4>${item.result.title} - ${item.result.score}/100</h4>
      <p>${item.date} | DM ${item.diabetesStatus} | Kulit ${item.skinCondition} | Saraf ${item.nerveSensitivity}</p>
      <p>Nyeri ${item.painLevel}/10, suhu ${item.footTemp}°C, gejala: ${item.symptoms.length ? item.symptoms.join(", ") : "Tidak ada"}</p>
      <div class="history-meta">
        <span class="tag">${item.result.level === "high" ? "Risiko tinggi" : item.result.level === "medium" ? "Risiko sedang" : "Normal"}</span>
        <span class="tag">${new Date(item.savedAt).toLocaleString("id-ID")}</span>
      </div>
    `;
    historyList.appendChild(card);
  });
}

document.querySelectorAll("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
});

document.querySelector("[data-go-register]").addEventListener("click", () => switchAuthTab("register"));
document.querySelector("[data-go-login]").addEventListener("click", () => switchAuthTab("login"));

document.getElementById("registerForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;
  const users = getData(storageKeys.users);

  if (!name || !email || !password) {
    showMessage(authMessage, "Semua kolom registrasi wajib diisi.", "error");
    return;
  }

  if (password !== confirm) {
    showMessage(authMessage, "Konfirmasi password tidak sama.", "error");
    return;
  }

  if (users.some((user) => user.email === email)) {
    showMessage(authMessage, "Email sudah terdaftar. Silakan login.", "error");
    return;
  }

  users.push({ name, email, password });
  setData(storageKeys.users, users);
  event.target.reset();
  switchAuthTab("login");
  showMessage(authMessage, "Akun berhasil dibuat. Silakan login untuk masuk ke dashboard.", "success");
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  const users = getData(storageKeys.users);
  const foundUser = users.find((user) => user.email === email && user.password === password);

  if (!foundUser) {
    showMessage(authMessage, "Email atau password tidak cocok.", "error");
    return;
  }

  setCurrentUser({ name: foundUser.name, email: foundUser.email });
  clearMessage(authMessage);
  event.target.reset();
  renderApp();
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(storageKeys.currentUser);
  renderApp();
  switchAuthTab("login");
});

document.querySelectorAll("[data-modal-target]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.modalTarget));
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.closest(".modal")));
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal(modal);
  });
});

painLevel.addEventListener("input", () => {
  painValue.textContent = painLevel.value;
});

document.getElementById("assessmentForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const symptoms = [...event.target.querySelectorAll('input[type="checkbox"]:checked')].map((item) => item.value);
  const payload = {
    userEmail: getCurrentUser().email,
    date: document.getElementById("assessmentDate").value,
    diabetesStatus: document.getElementById("diabetesStatus").value,
    painLevel: Number(document.getElementById("painLevel").value),
    footTemp: Number(document.getElementById("footTemp").value),
    skinCondition: document.getElementById("skinCondition").value,
    nerveSensitivity: document.getElementById("nerveSensitivity").value,
    symptoms,
    savedAt: new Date().toISOString()
  };

  const result = calculateRisk(payload);
  payload.result = result;
  saveUserItem(storageKeys.assessments, payload);

  assessmentResult.className = `result-card ${result.level}`;
  assessmentResult.innerHTML = resultContent(result, payload);
  assessmentResult.classList.remove("hidden");
  renderDashboardSummary();
});

document.getElementById("dailyChecklistForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const file = document.getElementById("dailyUpload").files[0];

  if (file && file.size > 5 * 1024 * 1024) {
    showMessage(document.getElementById("dailyChecklistMessage"), "Ukuran file melebihi 5MB.", "error");
    return;
  }

  saveUserItem(storageKeys.dailyChecks, {
    userEmail: getCurrentUser().email,
    hasWound: document.getElementById("hasWound").checked,
    feelsNumb: document.getElementById("feelsNumb").checked,
    nailIssue: document.getElementById("nailIssue").checked,
    fileName: file ? file.name : null,
    savedAt: new Date().toISOString()
  });

  event.target.reset();
  showMessage(document.getElementById("dailyChecklistMessage"), "Pemeriksaan harian berhasil disimpan.", "success");
  renderDashboardSummary();
});

document.getElementById("notesForm").addEventListener("submit", (event) => {
  event.preventDefault();

  saveUserItem(storageKeys.notes, {
    userEmail: getCurrentUser().email,
    location: document.getElementById("woundLocation").value,
    description: document.getElementById("woundDescription").value.trim(),
    savedAt: new Date().toISOString()
  });

  event.target.reset();
  showMessage(document.getElementById("notesMessage"), "Catatan luka berhasil disimpan.", "success");
  renderDashboardSummary();
});

document.querySelectorAll("[data-edu-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-edu-tab]").forEach((pill) => pill.classList.remove("active"));
    document.querySelectorAll(".education-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`[data-edu-panel="${button.dataset.eduTab}"]`).classList.add("active");
  });
});

document.getElementById("openProfileBtn").addEventListener("click", () => openModal("historyModal"));

renderApp();
