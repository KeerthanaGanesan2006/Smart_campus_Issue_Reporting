const API = "/api";
const tokenKey = "smartCampusToken";
const userKey = "smartCampusUser";
const $ = (id) => document.getElementById(id);
const token = () => localStorage.getItem(tokenKey);
const currentUser = () => { try { return JSON.parse(localStorage.getItem(userKey) || "null"); } catch { return null; } };
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
function notify(message, type = "error", target = "notice") {
  const box = $(target);
  if (!box) { alert(message); return; }
  box.textContent = message; box.className = `notice show ${type}`;
}
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}
function logout() { localStorage.removeItem(tokenKey); localStorage.removeItem(userKey); window.location.href = "index.html"; }
function guard(roles = []) {
  const user = currentUser();
  if (!token() || !user) { window.location.href = "index.html"; return false; }
  if (roles.length && !roles.includes(user.role)) { window.location.href = user.role === "admin" ? "admin.html" : user.role === "staff" ? "staff.html" : "student.html"; return false; }
  document.querySelectorAll("[data-user-name]").forEach(el => el.textContent = user.name);
  document.querySelectorAll("[data-user-role]").forEach(el => el.textContent = user.role);
  return true;
}
function routeForRole(role) { return role === "admin" ? "admin.html" : role === "staff" ? "staff.html" : "student.html"; }

function setupAuth() {
  const loginForm = $("loginForm"), registerForm = $("registerForm");
  if (!loginForm || !registerForm) return;
  const loginTab = $("loginTab"), registerTab = $("registerTab");
  function show(mode) {
    loginForm.classList.toggle("hide", mode !== "login"); registerForm.classList.toggle("hide", mode !== "register");
    loginTab.classList.toggle("active", mode === "login"); registerTab.classList.toggle("active", mode === "register");
  }
  loginTab.addEventListener("click", () => show("login"));
  registerTab.addEventListener("click", () => show("register"));
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }) });
      localStorage.setItem(tokenKey, data.token); localStorage.setItem(userKey, JSON.stringify(data.user));
      window.location.href = routeForRole(data.user.role);
    } catch (err) { notify(err.message, "error", "authNotice"); }
  });
  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    if ($("registerPassword").value !== $("confirmPassword").value) return notify("Passwords do not match.", "error", "authNotice");
    try {
      const data = await request("/auth/register", { method: "POST", body: JSON.stringify({ name: $("registerName").value.trim(), email: $("registerEmail").value.trim(), password: $("registerPassword").value }) });
      localStorage.setItem(tokenKey, data.token); localStorage.setItem(userKey, JSON.stringify(data.user));
      window.location.href = "student.html";
    } catch (err) { notify(err.message, "error", "authNotice"); }
  });
  if (token() && currentUser()) window.location.href = routeForRole(currentUser().role);
}

function statusClass(status) { return "status-" + status.toLowerCase().replace(/\s+/g, "-"); }
function complaintCard(c, mode = "student", staff = []) {
  const status = escapeHTML(c.status || "Submitted");
  const image = c.image ? `<a href="${escapeHTML(c.image)}" target="_blank" rel="noopener"><img class="complaint-image" src="${escapeHTML(c.image)}" alt="Complaint photo"></a>` : "";
  const student = c.student ? `<span class="chip">👤 ${escapeHTML(c.student.name)}</span>` : "";
  const assignee = c.assignedStaff ? `<span class="chip">🧰 ${escapeHTML(c.assignedStaff.name)}</span>` : "";
  let actions = "";
  if (mode === "admin") {
    actions = `<div class="actions"><select id="staff-${c._id}" aria-label="Assign staff"><option value="">Assign staff…</option>${staff.map(s => `<option value="${s._id}" ${c.assignedStaff && c.assignedStaff._id === s._id ? "selected" : ""}>${escapeHTML(s.name)}</option>`).join("")}</select><button class="small" data-assign="${c._id}">Assign</button><select id="status-${c._id}" aria-label="Update status"><option>Assigned</option><option>In Progress</option><option>Resolved</option><option>Rejected</option></select><button class="small secondary" data-status="${c._id}">Update</button></div>`;
  } else if (mode === "staff") {
    actions = `<div class="actions"><select id="status-${c._id}" aria-label="Update status"><option>In Progress</option><option>Resolved</option></select><button class="small" data-status="${c._id}">Update</button></div>`;
  }
  return `<article class="card complaint"><div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.description)}</p><div class="meta"><span class="chip">${escapeHTML(c.category)}</span><span class="chip">📍 ${escapeHTML(c.location)}</span><span class="chip">Priority: ${escapeHTML(c.priority)}</span><span class="chip ${statusClass(status)}">${status}</span>${student}${assignee}</div><p class="hint">Reported ${new Date(c.createdAt).toLocaleString()}</p>${actions}</div>${image}</article>`;
}
function renderComplaints(container, complaints, mode = "student", staff = []) {
  if (!container) return;
  container.innerHTML = complaints.length ? complaints.map(c => complaintCard(c, mode, staff)).join("") : `<div class="empty"><div class="emoji">🌱</div><strong>No complaints yet</strong><p>When an issue is reported, it will appear here.</p></div>`;
  container.querySelectorAll("[data-assign]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.assign, staffId = $(`staff-${id}`).value;
    if (!staffId) return alert("Please select a staff member first.");
    try { await request(`/complaints/${id}/assign`, { method: "PATCH", body: JSON.stringify({ staffId }) }); loadAdmin(); }
    catch (err) { alert(err.message); }
  }));
  container.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.dataset.status, status = $(`status-${id}`).value;
    try { await request(`/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); mode === "admin" ? loadAdmin() : loadStaff(); }
    catch (err) { alert(err.message); }
  }));
}

async function loadStudent() {
  if (!guard(["student"])) return;
  try {
    const complaints = await request("/complaints");
    $("studentTotal").textContent = complaints.length;
    $("studentOpen").textContent = complaints.filter(c => !["Resolved", "Rejected"].includes(c.status)).length;
    $("studentResolved").textContent = complaints.filter(c => c.status === "Resolved").length;
    renderComplaints($("myComplaints"), complaints.slice(0, 4));
  } catch (err) { notify(err.message); }
}
async function loadMyComplaints() {
  if (!guard(["student"])) return;
  try {
    const complaints = await request("/complaints");
    const search = $("searchComplaints");
    const filter = $("filterStatus");
    const render = () => {
      const q = search.value.toLowerCase();
      renderComplaints($("complaintList"), complaints.filter(c => (c.title + " " + c.location + " " + c.category).toLowerCase().includes(q) && (filter.value === "All" || c.status === filter.value)));
    };
    search.addEventListener("input", render); filter.addEventListener("change", render); render();
  } catch (err) { notify(err.message); }
}
function setupReport() {
  if (!guard(["student"])) return;
  const form = $("reportForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      const data = await request("/complaints", { method: "POST", body: fd });
      notify(data.message + " You can track it in My Complaints.", "success", "reportNotice");
      form.reset();
    } catch (err) { notify(err.message, "error", "reportNotice"); }
  });
}
async function loadAdmin() {
  if (!guard(["admin"])) return;
  try {
    const [complaints, staff, analytics] = await Promise.all([request("/complaints"), request("/users/staff"), request("/analytics")]);
    $("adminTotal").textContent = analytics.total;
    $("adminOpen").textContent = analytics.open;
    $("adminResolved").textContent = analytics.resolved;
    $("adminStaff").textContent = staff.length;
    renderComplaints($("adminComplaints"), complaints, "admin", staff);
    renderBars($("categoryBars"), analytics.byCategory || []);
    renderBars($("statusBars"), analytics.byStatus || []);
  } catch (err) { notify(err.message, "error", "adminNotice"); }
}
function renderBars(container, items) {
  if (!container) return;
  if (!items.length) { container.innerHTML = `<p class="muted">No data available yet.</p>`; return; }
  const max = Math.max(...items.map(x => x.count), 1);
  container.innerHTML = items.map(x => `<div class="bar-row"><span>${escapeHTML(x._id)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, x.count / max * 100)}%"></div></div><strong>${x.count}</strong></div>`).join("");
}
async function loadStaff() {
  if (!guard(["staff"])) return;
  try {
    const complaints = await request("/complaints");
    $("staffAssigned").textContent = complaints.length;
    $("staffProgress").textContent = complaints.filter(c => c.status === "In Progress").length;
    $("staffResolved").textContent = complaints.filter(c => c.status === "Resolved").length;
    renderComplaints($("staffComplaints"), complaints, "staff");
  } catch (err) { notify(err.message, "error", "staffNotice"); }
}
document.addEventListener("DOMContentLoaded", () => {
  setupAuth();
  if ($("studentPage")) loadStudent();
  if ($("reportForm")) setupReport();
  if ($("myComplaintsPage")) loadMyComplaints();
  if ($("adminPage")) loadAdmin();
  if ($("staffPage")) loadStaff();
  document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", logout));
});
