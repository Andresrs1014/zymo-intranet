const columns = ["Backlog", "Planificado", "En curso", "Revision", "Terminado"];
const storageKey = "projectflow-tasks";
const teamStorageKey = "projectflow-team";
const subprojectStorageKey = "projectflow-subprojects";
const instructionStorageKey = "projectflow-instructions";
const surveyStorageKey = "projectflow-satisfaction";
const updateAlertStorageKey = "projectflow-update-alerts";
const seedTeam = [
  { name: "Ana Ruiz", initials: "AR", color: "#ef3340", email: "ana@empresa.com", phone: "573001112233" },
  { name: "Carlos Diaz", initials: "CD", color: "#5461c8", email: "carlos@empresa.com", phone: "573002223344" },
  { name: "Luisa Mora", initials: "LM", color: "#002f43", email: "luisa@empresa.com", phone: "573003334455" },
  { name: "Mateo Gil", initials: "MG", color: "#1f9d6a", email: "mateo@empresa.com", phone: "573004445566" }
];

const seedSubprojects = [
  { id: 1, name: "Implementacion MVP", goal: "Herramienta base de gestion para Zymo", investment: 18000000, expectedReturn: 32000000 },
  { id: 2, name: "Experiencia del cliente", goal: "Mejorar visibilidad, alertas y cumplimiento", investment: 12000000, expectedReturn: 24500000 },
  { id: 3, name: "Automatizacion operativa", goal: "Alertas y seguimiento de responsables", investment: 15000000, expectedReturn: 36000000 }
];

const seedTasks = [
  { id: 1, subprojectId: 1, name: "Definir alcance del modulo de clientes", owner: "Ana Ruiz", status: "Terminado", priority: "Alta", start: "2026-05-01", end: "2026-05-04", progress: 100, points: 5, investmentCost: 1800000, optimizationCost: 450000, executionCost: 950000, blocked: false, dependencyId: "", completedAt: "2026-05-04", comments: [{ text: "Alcance aprobado por el equipo funcional.", date: "2026-05-04" }], evidence: [] },
  { id: 2, subprojectId: 1, name: "Prototipo responsive para celular", owner: "Luisa Mora", status: "Revision", priority: "Media", start: "2026-05-03", end: "2026-05-10", progress: 82, points: 8, investmentCost: 4200000, optimizationCost: 900000, executionCost: 2100000, blocked: false, dependencyId: 1, comments: [{ text: "Pendiente validar experiencia en pantalla pequena.", date: "2026-05-08" }], evidence: [] },
  { id: 3, subprojectId: 3, name: "Integracion de alertas por correo", owner: "Carlos Diaz", status: "En curso", priority: "Alta", start: "2026-05-06", end: "2026-05-14", progress: 46, points: 8, investmentCost: 2600000, optimizationCost: 700000, executionCost: 1800000, blocked: true, dependencyId: 2, comments: [{ text: "Falta definir correo corporativo de salida.", date: "2026-05-08" }], evidence: [] },
  { id: 4, subprojectId: 3, name: "Reglas de analisis IA para riesgos", owner: "Mateo Gil", status: "En curso", priority: "Alta", start: "2026-05-08", end: "2026-05-17", progress: 35, points: 13, investmentCost: 5200000, optimizationCost: 1500000, executionCost: 2400000, blocked: false, dependencyId: "", comments: [], evidence: [] },
  { id: 5, subprojectId: 2, name: "Plantilla de estado semanal", owner: "Ana Ruiz", status: "Planificado", priority: "Media", start: "2026-05-12", end: "2026-05-18", progress: 15, points: 3, investmentCost: 1200000, optimizationCost: 350000, executionCost: 600000, blocked: false, dependencyId: 4, comments: [], evidence: [] },
  { id: 6, subprojectId: 2, name: "Backlog de mejoras posteriores", owner: "Luisa Mora", status: "Backlog", priority: "Baja", start: "2026-05-18", end: "2026-05-22", progress: 0, points: 2, investmentCost: 900000, optimizationCost: 250000, executionCost: 400000, blocked: false, dependencyId: "", comments: [], evidence: [] }
];

let tasks = JSON.parse(localStorage.getItem(storageKey) || "null") || seedTasks;
let team = JSON.parse(localStorage.getItem(teamStorageKey) || "null") || seedTeam;
let subprojects = JSON.parse(localStorage.getItem(subprojectStorageKey) || "null") || seedSubprojects;
let uploadedInstructions = JSON.parse(localStorage.getItem(instructionStorageKey) || "null") || [];
let satisfactionResponses = JSON.parse(localStorage.getItem(surveyStorageKey) || "null") || [];
let updateAlerts = JSON.parse(localStorage.getItem(updateAlertStorageKey) || "null") || [];
let currentFilter = "all";
let currentOwnerFilter = "all";
let currentSubprojectFilter = "all";
let dashboardSubprojectFilter = "all";
let searchQuery = "";
let showBlockedOnly = false;
let whatsappObservationTaskId = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const today = new Date();
const dayMs = 1000 * 60 * 60 * 24;
const icon = {
  rocket: "\u{1F680}",
  wave: "\u{1F44B}",
  party: "\u{1F389}",
  pin: "\u{1F4CC}",
  target: "\u{1F3AF}",
  calendar: "\u{1F4C5}",
  chart: "\u{1F4CA}",
  link: "\u{1F517}",
  star: "\u{1F31F}",
  muscle: "\u{1F4AA}",
  sparkle: "\u{2728}",
  tag: "\u{1F3F7}\u{FE0F}"
};

tasks = tasks.map(normalizeTask);
team = team.map(normalizePerson);
subprojects = subprojects.map(normalizeSubproject);
saveTasks();
saveSubprojects();

function normalizeSubproject(subproject) {
  const seeded = seedSubprojects.find((item) => String(item.id) === String(subproject.id) || item.name === subproject.name);
  return {
    id: subproject.id || Date.now() + Math.random(),
    name: subproject.name,
    goal: subproject.goal || "",
    investment: Number(subproject.investment ?? seeded?.investment ?? 0),
    expectedReturn: Number(subproject.expectedReturn ?? seeded?.expectedReturn ?? 0)
  };
}

function normalizePerson(person) {
  const initials = person.initials || person.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return {
    id: person.id || Date.now() + Math.random(),
    name: person.name,
    initials,
    color: person.color || "#5461c8",
    email: person.email || "",
    phone: person.phone || ""
  };
}

function normalizeTask(task) {
  const seeded = seedTasks.find((item) => String(item.id) === String(task.id) || item.name === task.name);
  return {
    ...task,
    points: Number(task.points || 3),
    investmentCost: Number(task.investmentCost ?? seeded?.investmentCost ?? 0),
    optimizationCost: Number(task.optimizationCost ?? seeded?.optimizationCost ?? 0),
    executionCost: Number(task.executionCost ?? seeded?.executionCost ?? 0),
    subprojectId: task.subprojectId || subprojects[0]?.id || "",
    blocked: Boolean(task.blocked),
    dependencyId: task.dependencyId || "",
    completedAt: task.completedAt || (task.status === "Terminado" ? task.end : ""),
    comments: task.comments || [],
    evidence: task.evidence || []
  };
}

function saveTasks() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
    return true;
  } catch {
    showToast("No se pudo guardar. Reduce el peso de las evidencias o usa menos archivos.");
    return false;
  }
}

function saveTeam() {
  localStorage.setItem(teamStorageKey, JSON.stringify(team));
}

function saveSubprojects() {
  localStorage.setItem(subprojectStorageKey, JSON.stringify(subprojects));
}

function saveInstructions() {
  localStorage.setItem(instructionStorageKey, JSON.stringify(uploadedInstructions));
}

function saveSurveyResponses() {
  localStorage.setItem(surveyStorageKey, JSON.stringify(satisfactionResponses));
}

function saveUpdateAlerts() {
  localStorage.setItem(updateAlertStorageKey, JSON.stringify(updateAlerts.slice(0, 30)));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readEvidenceFiles(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: Date.now() + Math.random(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result,
      date: today.toISOString().slice(0, 10)
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function readInstructionFiles(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(files.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: Date.now() + Math.random(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result,
      date: today.toISOString().slice(0, 10)
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(new Date(`${dateString}T12:00:00`));
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function daysBetween(start, end) {
  return Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / dayMs) + 1);
}

function taskById(id) {
  return tasks.find((task) => String(task.id) === String(id));
}

function dependencyName(task) {
  return task.dependencyId ? taskById(task.dependencyId)?.name || "Dependencia externa" : "Sin dependencia";
}

function subprojectName(id) {
  return subprojects.find((item) => String(item.id) === String(id))?.name || "Sin subproyecto";
}

function dashboardTasks() {
  return dashboardSubprojectFilter === "all"
    ? tasks
    : tasks.filter((task) => String(task.subprojectId) === String(dashboardSubprojectFilter));
}

function dashboardSubprojectLabel() {
  return dashboardSubprojectFilter === "all" ? "Todos los subproyectos" : subprojectName(dashboardSubprojectFilter);
}

function overdueTasks() {
  return tasks.filter((task) => new Date(`${task.end}T12:00:00`) < today && task.progress < 100);
}

function blockedTasks() {
  return tasks.filter((task) => task.blocked && task.status !== "Terminado");
}

function riskTasks() {
  return tasks.filter((task) => (task.priority === "Alta" && task.progress < 60 && task.status !== "Terminado") || task.blocked);
}

function alertTasks() {
  return [...new Set([...overdueTasks(), ...blockedTasks(), ...riskTasks()])];
}

function dueSoonTasks() {
  return tasks
    .filter((task) => task.status !== "Terminado")
    .filter((task) => {
      const remaining = Math.round((new Date(`${task.end}T12:00:00`) - today) / dayMs);
      return remaining >= 0 && remaining <= 7;
    })
    .sort((a, b) => new Date(`${a.end}T12:00:00`) - new Date(`${b.end}T12:00:00`));
}

function automaticAlertItems() {
  const todayIso = today.toISOString().slice(0, 10);
  return tasks
    .filter((task) => task.status !== "Terminado")
    .map((task) => {
      const daysToEnd = Math.round((new Date(`${task.end}T12:00:00`) - new Date(today.toDateString())) / dayMs);
      const recentUpdate = (task.comments || []).some((comment) => comment.date === todayIso);
      const reasons = [];
      if (daysToEnd < 0) reasons.push("vencida");
      if (daysToEnd >= 0 && daysToEnd <= 2) reasons.push("proxima a vencer");
      if (task.blocked) reasons.push("bloqueada");
      if (task.priority === "Alta" && task.progress < 60) reasons.push("prioridad alta con avance bajo");
      if (recentUpdate) reasons.push("actualizacion reciente");
      return { task, reasons };
    })
    .filter((item) => item.reasons.length);
}

function completionRate() {
  const total = tasks.length || 1;
  return Math.round((tasks.filter((task) => task.status === "Terminado").length / total) * 100);
}

function pointsSummary(sourceTasks = tasks) {
  const total = sourceTasks.reduce((sum, task) => sum + task.points, 0) || 1;
  const done = sourceTasks.filter((task) => task.status === "Terminado").reduce((sum, task) => sum + task.points, 0);
  return { done, total, rate: Math.round((done / total) * 100) };
}

function taskCostSummary(task) {
  const investment = Number(task.investmentCost || 0);
  const optimization = Number(task.optimizationCost || 0);
  const execution = Number(task.executionCost || 0);
  const total = investment + optimization + execution;
  const executed = Math.round(total * (Number(task.progress || 0) / 100));
  const pending = Math.max(0, total - executed);
  const executionRate = total > 0 ? Math.round((executed / total) * 100) : 0;
  return { investment, optimization, execution, total, executed, pending, executionRate };
}

function costSummary(sourceTasks = tasks) {
  const totals = sourceTasks.reduce((summary, task) => {
    const cost = taskCostSummary(task);
    summary.investment += cost.investment;
    summary.optimization += cost.optimization;
    summary.execution += cost.execution;
    summary.total += cost.total;
    summary.executed += cost.executed;
    summary.pending += cost.pending;
    return summary;
  }, { investment: 0, optimization: 0, execution: 0, total: 0, executed: 0, pending: 0 });
  totals.executionRate = totals.total > 0 ? Math.round((totals.executed / totals.total) * 100) : 0;
  return totals;
}

function averageValue(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

function medianValue(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function subprojectTasks(subprojectId) {
  return tasks.filter((task) => String(task.subprojectId) === String(subprojectId));
}

function subprojectProgress(subprojectId) {
  const sourceTasks = subprojectTasks(subprojectId);
  if (!sourceTasks.length) return 0;
  return Math.round(sourceTasks.reduce((sum, task) => sum + task.progress, 0) / sourceTasks.length);
}

function roiSummary(subproject) {
  const investment = Number(subproject.investment || 0);
  const expectedReturn = Number(subproject.expectedReturn || 0);
  const roi = investment > 0 ? Math.round(((expectedReturn - investment) / investment) * 100) : 0;
  const margin = expectedReturn - investment;
  let label = "ROI pendiente";
  if (investment > 0 && roi >= 80) label = "Alto potencial";
  if (investment > 0 && roi >= 25 && roi < 80) label = "Potencial favorable";
  if (investment > 0 && roi >= 0 && roi < 25) label = "Retorno controlado";
  if (investment > 0 && roi < 0) label = "Revisar alcance";
  return { investment, expectedReturn, roi, margin, label };
}

function subprojectPrediction(subproject) {
  const sourceTasks = subprojectTasks(subproject.id);
  const progress = subprojectProgress(subproject.id);
  const blocked = sourceTasks.filter((task) => task.blocked && task.status !== "Terminado").length;
  const overdue = sourceTasks.filter((task) => new Date(`${task.end}T12:00:00`) < today && task.progress < 100).length;
  const highRisk = sourceTasks.filter((task) => task.priority === "Alta" && task.progress < 60 && task.status !== "Terminado").length;
  if (!sourceTasks.length) return "Sin actividades registradas; se recomienda definir alcance y responsables.";
  if (blocked || overdue) return `Riesgo alto: ${blocked} bloqueo(s) y ${overdue} vencimiento(s). Priorizar desbloqueos para proteger fecha y ROI.`;
  if (progress >= 75 && highRisk === 0) return "Alta probabilidad de cierre oportuno; mantener validacion de evidencias y comunicacion al cliente.";
  if (progress >= 45) return "Probabilidad media de cierre; conviene reforzar responsables de actividades criticas esta semana.";
  return "Riesgo medio: avance inicial bajo; revisar capacidad, dependencias y valor esperado antes del siguiente comite.";
}

function subprojectHighlight(subproject) {
  const sourceTasks = subprojectTasks(subproject.id);
  const blocked = sourceTasks.find((task) => task.blocked && task.status !== "Terminado");
  if (blocked) return `Bloqueo relevante: ${blocked.name} (${blocked.owner}).`;
  const dueSoon = sourceTasks
    .filter((task) => task.status !== "Terminado")
    .sort((a, b) => new Date(`${a.end}T12:00:00`) - new Date(`${b.end}T12:00:00`))[0];
  if (dueSoon) return `Actividad clave: ${dueSoon.name}, vence ${formatDate(dueSoon.end)} con ${dueSoon.progress}% de avance.`;
  const done = sourceTasks.find((task) => task.status === "Terminado");
  if (done) return `Logro relevante: ${done.name} cerrado por ${done.owner}.`;
  return "Pendiente registrar actividades para iniciar seguimiento ejecutivo.";
}

function flowSummaryLines(sourceTasks = dashboardTasks()) {
  return columns.map((column) => {
    const columnTasks = sourceTasks.filter((task) => task.status === column);
    const names = columnTasks.slice(0, 2).map((task) => task.name).join("; ") || "sin actividades";
    return `- ${column}: ${columnTasks.length} actividad(es). Relevante: ${names}.`;
  });
}

function executiveHealth() {
  const overdue = overdueTasks().length;
  const blocked = blockedTasks().length;
  const risks = riskTasks().length;
  if (blocked || overdue) return { label: "Rojo", message: "requiere intervencion gerencial por bloqueos o vencimientos que comprometen fecha, costo o experiencia del cliente." };
  if (risks) return { label: "Amarillo", message: "mantiene control, pero requiere foco directivo en actividades de alta prioridad con avance bajo." };
  return { label: "Verde", message: "se mantiene estable, con avance controlado y sin alertas criticas activas." };
}

function executiveRecommendation() {
  if (blockedTasks().length) return "Decidir responsable y fecha de desbloqueo para las dependencias criticas antes del proximo comite.";
  if (overdueTasks().length) return "Reprogramar compromisos vencidos y comunicar plan de recuperacion a los responsables y cliente interno.";
  if (riskTasks().length) return "Concentrar capacidad en actividades de alta prioridad y limitar nuevos alcances hasta estabilizar el sprint.";
  return "Mantener la cadencia actual, cerrar actividades en revision y proteger el alcance aprobado.";
}

function strategicFocusTasks() {
  return [...blockedTasks(), ...overdueTasks(), ...riskTasks()]
    .filter((task, index, source) => source.findIndex((item) => item.id === task.id) === index)
    .sort((a, b) => (b.points - a.points) || (b.progress - a.progress))
    .slice(0, 3);
}

function wasClosedOnTime(task) {
  if (task.status !== "Terminado" || !task.completedAt) return false;
  return new Date(`${task.completedAt}T12:00:00`) <= new Date(`${task.end}T12:00:00`);
}

function getBadgesForPerson(personName) {
  const done = tasks.filter((task) => task.owner === personName && task.status === "Terminado");
  const onTime = done.filter(wasClosedOnTime);
  const totalPoints = onTime.reduce((sum, task) => sum + task.points, 0);
  const badges = [];
  if (onTime.length >= 1) badges.push({ label: "Cumplidor", icon: "OK", detail: `${onTime.length} tarea(s) a tiempo` });
  if (onTime.length >= 3) badges.push({ label: "Racha Scrum", icon: "3X", detail: "3 cierres a tiempo" });
  if (totalPoints >= 13) badges.push({ label: "Alto impacto", icon: "PT", detail: `${totalPoints} puntos a tiempo` });
  if (done.length && onTime.length === done.length) badges.push({ label: "Sin retrasos", icon: "100", detail: "Todo lo cerrado fue a tiempo" });
  return { done, onTime, totalPoints, badges };
}

function filteredTasks() {
  return tasks.filter((task) => {
    const matchesPriority = currentFilter === "all" || task.priority === currentFilter;
    const matchesOwner = currentOwnerFilter === "all" || task.owner === currentOwnerFilter;
    const matchesSubproject = currentSubprojectFilter === "all" || String(task.subprojectId) === String(currentSubprojectFilter);
    const matchesBlocked = !showBlockedOnly || task.blocked;
    const haystack = [
      task.name,
      task.owner,
      task.priority,
      task.status,
      subprojectName(task.subprojectId),
      dependencyName(task),
      ...(task.comments || []).map((comment) => comment.text)
    ].join(" ").toLowerCase();
    const matchesSearch = !searchQuery || haystack.includes(searchQuery.toLowerCase());
    return matchesPriority && matchesOwner && matchesSubproject && matchesBlocked && matchesSearch;
  });
}

function renderTeam() {
  $("#teamAvatars").innerHTML = team.map((person) => (
    `<span class="avatar" title="${person.name}" style="--avatar-color:${person.color}">${person.initials}</span>`
  )).join("");
  $("#taskOwner").innerHTML = team.map((person) => `<option>${person.name}</option>`).join("");
  $("#taskSubproject").innerHTML = subprojects.map((subproject) => `<option value="${subproject.id}">${escapeHtml(subproject.name)}</option>`).join("");
  $("#ownerFilter").innerHTML = `<option value="all">Todos</option>${team.map((person) => `<option>${person.name}</option>`).join("")}`;
  $("#ownerFilter").value = currentOwnerFilter;
  $("#subprojectFilter").innerHTML = `<option value="all">Todos</option>${subprojects.map((subproject) => `<option value="${subproject.id}">${escapeHtml(subproject.name)}</option>`).join("")}`;
  $("#subprojectFilter").value = currentSubprojectFilter;
  $("#dashboardSubprojectFilter").innerHTML = `<option value="all">Todos los subproyectos</option>${subprojects.map((subproject) => `<option value="${subproject.id}">${escapeHtml(subproject.name)}</option>`).join("")}`;
  $("#dashboardSubprojectFilter").value = dashboardSubprojectFilter;
  $("#taskDependency").innerHTML = `<option value="">Sin dependencia</option>${tasks.map((task) => `<option value="${task.id}">${escapeHtml(task.name)}</option>`).join("")}`;
  $("#whatsappObservationSender").innerHTML = team.map((person) => `<option>${person.name}</option>`).join("");
  $("#sprintSummary").textContent = `${team.length} responsables activos - ${tasks.length} tareas - ${pointsSummary().total} puntos`;
}

function renderSettings() {
  renderResponsibleList();
  renderSubprojectList();
  renderActivityRegistry();
  renderAutomaticAlerts();
  renderUpdateAlerts();
}

function renderResponsibleList() {
  $("#responsibleCount").textContent = `${team.length} configurado(s)`;
  $("#responsibleList").innerHTML = team.map((person) => (
    `<article class="responsible-card">
      <span class="avatar" style="--avatar-color:${person.color}">${person.initials}</span>
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <p>${escapeHtml(person.email)} - ${escapeHtml(person.phone)}</p>
      </div>
      <button class="ghost-button small" data-edit-person="${person.id}" type="button">Editar</button>
      <button class="ghost-button small" data-delete-person="${person.id}" type="button">Eliminar</button>
    </article>`
  )).join("");
}

function renderSubprojectList() {
  $("#subprojectCount").textContent = `${subprojects.length} configurado(s)`;
  $("#subprojectList").innerHTML = subprojects.map((subproject) => {
    const roi = roiSummary(subproject);
    return `<article class="subproject-card">
      <div>
        <strong>${escapeHtml(subproject.name)}</strong>
        <p>${escapeHtml(subproject.goal || "Sin objetivo registrado")}</p>
        <p>Inversion ${formatMoney(roi.investment)} - Retorno ${formatMoney(roi.expectedReturn)} - ROI ${roi.roi}%</p>
      </div>
      <button class="ghost-button small" data-edit-subproject="${subproject.id}" type="button">Editar</button>
      <button class="ghost-button small" data-delete-subproject="${subproject.id}" type="button">Eliminar</button>
    </article>`;
  }).join("");
}

function renderActivityRegistry() {
  $("#activityRegistry").innerHTML = [
    `<div class="activity-row activity-head"><strong>Actividad</strong><strong>Subproyecto</strong><strong>Responsable</strong><strong>Estado</strong><strong>Fin</strong><strong>Costos</strong><strong>Ejecucion</strong><strong>Alertas</strong><strong>Acciones</strong></div>`,
    ...tasks.map((task) => {
      const item = automaticAlertItems().find((alert) => alert.task.id === task.id);
      const person = team.find((member) => member.name === task.owner);
      const mailUrl = alertMailUrl(task, person);
      const whatsUrl = person ? alertWhatsappUrl(task, person) : "#";
      const cost = taskCostSummary(task);
      return `<div class="activity-row">
        <span>${escapeHtml(task.name)}</span>
        <span>${escapeHtml(subprojectName(task.subprojectId))}</span>
        <span>${escapeHtml(task.owner)}</span>
        <span>${escapeHtml(task.status)}</span>
        <span>${formatDate(task.end)}</span>
        <span>${formatMoney(cost.total)}</span>
        <span>${formatMoney(cost.executed)} (${cost.executionRate}%)</span>
        <span>${item ? escapeHtml(item.reasons.join(", ")) : "Sin alerta"}</span>
        <span class="row-actions">
          <button class="ghost-button small" data-edit-task="${task.id}" type="button">Editar</button>
          <a class="ghost-button small" href="${mailUrl}">Correo</a>
          <a class="ghost-button small whatsapp-action" href="${whatsUrl}" target="_blank" rel="noopener">WA</a>
        </span>
      </div>`;
    })
  ].join("");
}

function renderAutomaticAlerts() {
  const alerts = automaticAlertItems();
  $("#autoAlertCount").textContent = `${alerts.length} activa(s)`;
  $("#autoAlertList").innerHTML = alerts.length ? alerts.map(({ task, reasons }) => {
    const person = team.find((member) => member.name === task.owner);
    return `<article class="auto-alert-card">
      <div>
        <strong>${icon.rocket} ${escapeHtml(task.name)}</strong>
        <p>${escapeHtml(task.owner)} - ${escapeHtml(reasons.join(", "))} - impacto cliente: mantener confianza y tiempos de respuesta.</p>
      </div>
      <a class="ghost-button small" href="${alertMailUrl(task, person)}">Correo</a>
      <a class="ghost-button small whatsapp-action" href="${person ? alertWhatsappUrl(task, person) : "#"}" target="_blank" rel="noopener">WA</a>
    </article>`;
  }).join("") : "<p class='empty-state'>No hay alertas automaticas activas.</p>";
}

function subprojectResponsiblePeople(subprojectId) {
  const names = [...new Set(tasks
    .filter((task) => String(task.subprojectId) === String(subprojectId))
    .map((task) => task.owner))];
  return names.map((name) => team.find((person) => person.name === name)).filter(Boolean);
}

function updateAlertText(alert, person = null) {
  const greeting = person ? `${icon.wave} Hola ${person.name.split(" ")[0]},` : `${icon.rocket} Actualizacion de subproyecto`;
  return [
    greeting,
    `Se registro una actualizacion en Helix Zymo.`,
    "",
    `${icon.pin} Subproyecto: ${alert.subprojectName}`,
    `${icon.target} Cambio: ${alert.change}`,
    alert.taskName ? `${icon.tag} Actividad: ${alert.taskName}` : "",
    `${icon.calendar} Fecha: ${formatDate(alert.date)}`,
    "",
    `${icon.star} Por favor revisa impacto en alcance, fecha, costo, evidencia o experiencia del cliente.`,
    `${icon.muscle} Mantener la informacion actualizada protege el seguimiento gerencial.`
  ].filter(Boolean).join("\n");
}

function createUpdateAlert(subprojectId, change, task = null) {
  const recipients = subprojectResponsiblePeople(subprojectId);
  if (!recipients.length) return;
  updateAlerts.unshift({
    id: Date.now() + Math.random(),
    date: today.toISOString().slice(0, 10),
    subprojectId,
    subprojectName: subprojectName(subprojectId),
    taskId: task?.id || "",
    taskName: task?.name || "",
    change,
    recipients: recipients.map((person) => person.name)
  });
  updateAlerts = updateAlerts.slice(0, 30);
  saveUpdateAlerts();
}

function renderUpdateAlerts() {
  $("#updateAlertCount").textContent = `${updateAlerts.length} pendiente(s)`;
  $("#updateAlertList").innerHTML = updateAlerts.length ? updateAlerts.map((alert) => {
    const recipients = alert.recipients.map((name) => team.find((person) => person.name === name)).filter(Boolean);
    const emails = recipients.map((person) => person.email).filter(Boolean).join(",");
    const emailUrl = `mailto:${emails}?subject=${encodeURIComponent(`Actualizacion ${alert.subprojectName} - Helix Zymo`)}&body=${encodeURIComponent(updateAlertText(alert))}`;
    const whatsappLinks = recipients.map((person) => {
      const url = person.phone ? `https://wa.me/${person.phone}?text=${encodeURIComponent(updateAlertText(alert, person))}` : "#";
      return `<a class="ghost-button small whatsapp-action ${person.phone ? "" : "disabled-link"}" href="${url}" target="_blank" rel="noopener">WA ${escapeHtml(person.initials)}</a>`;
    }).join("");
    return `<article class="auto-alert-card update-alert-card">
      <div>
        <strong>${icon.rocket} ${escapeHtml(alert.subprojectName)}</strong>
        <p>${escapeHtml(alert.change)}${alert.taskName ? ` - ${escapeHtml(alert.taskName)}` : ""}</p>
        <p>Responsables: ${escapeHtml(alert.recipients.join(", "))}</p>
      </div>
      <a class="ghost-button small" href="${emailUrl}">Correo</a>
      ${whatsappLinks}
    </article>`;
  }).join("") : "<p class='empty-state'>No hay alertas de actualizacion pendientes.</p>";
}

function renderMetrics() {
  const sourceTasks = dashboardTasks();
  const finished = sourceTasks.filter((task) => task.status === "Terminado").length;
  const inProgress = sourceTasks.filter((task) => task.status === "En curso").length;
  const alerts = sourceTasks.filter((task) => overdueTasks().includes(task) || blockedTasks().includes(task) || riskTasks().includes(task)).length;
  const average = Math.round(sourceTasks.reduce((sum, task) => sum + Number(task.progress), 0) / (sourceTasks.length || 1));
  const points = pointsSummary(sourceTasks);
  const metrics = [
    ["Vista panel", dashboardSubprojectLabel()],
    ["Avance total", `${average}%`],
    ["Puntos cerrados", `${points.done}/${points.total}`],
    ["Tareas terminadas", `${finished}/${sourceTasks.length}`],
    ["En ejecucion", inProgress],
    ["Alertas activas", alerts]
  ];
  $("#metricsGrid").innerHTML = metrics.map(([label, value]) => (
    `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`
  )).join("");
}

function renderSprintInsights() {
  const sourceTasks = dashboardTasks();
  const points = pointsSummary(sourceTasks);
  const blocked = sourceTasks.filter((task) => blockedTasks().includes(task));
  const late = sourceTasks.filter((task) => overdueTasks().includes(task));
  const health = blocked.length || late.length ? "En riesgo" : points.rate >= 45 ? "Saludable" : "En observacion";
  $("#sprintHealthLabel").textContent = health;
  $("#statusDistribution").innerHTML = columns.map((column) => {
    const count = sourceTasks.filter((task) => task.status === column).length;
    const fill = Math.round((count / (sourceTasks.length || 1)) * 100);
    return `<div class="status-row">
      <span>${column}</span>
      <div class="bar-track"><div class="bar-fill" style="--fill:${fill}%"></div></div>
      <strong>${count}</strong>
    </div>`;
  }).join("");
  const next = dueSoonTasks().filter((task) => sourceTasks.includes(task)).slice(0, 4);
  $("#nextMilestones").innerHTML = `<h4>Proximos hitos</h4>${next.map((task) => (
    `<div class="timeline-item"><span>${formatDate(task.end)}</span><strong>${escapeHtml(task.name)}</strong></div>`
  )).join("") || "<p>No hay vencimientos en los proximos 7 dias.</p>"}`;
  $("#blockerCaption").textContent = `${blocked.length} bloqueo(s)`;
  $("#blockerList").innerHTML = blocked.length ? blocked.map((task) => (
    `<article class="blocker-card">
      <strong>${escapeHtml(task.name)}</strong>
      <p>${escapeHtml(task.owner)} debe resolver: ${escapeHtml(dependencyName(task))}.</p>
    </article>`
  )).join("") : "<p class='empty-state'>No hay bloqueos activos.</p>";
}

function renderStatisticsDashboard() {
  const sourceTasks = dashboardTasks();
  const total = sourceTasks.length || 1;
  const progressValues = sourceTasks.map((task) => Number(task.progress || 0));
  const pointValues = sourceTasks.map((task) => Number(task.points || 0));
  const costs = costSummary(sourceTasks);
  const done = sourceTasks.filter((task) => task.status === "Terminado");
  const onTime = done.filter(wasClosedOnTime);
  const riskCount = sourceTasks.filter((task) => riskTasks().includes(task)).length;
  const blockedCount = sourceTasks.filter((task) => blockedTasks().includes(task)).length;
  const compliance = done.length ? Math.round((onTime.length / done.length) * 100) : 0;
  const riskRate = Math.round((riskCount / total) * 100);
  const blockedRate = Math.round((blockedCount / total) * 100);
  const avgProgress = averageValue(progressValues);
  const medianProgress = medianValue(progressValues);
  const deviation = standardDeviation(progressValues);
  const avgPoints = averageValue(pointValues);
  const totalPoints = pointValues.reduce((sum, value) => sum + value, 0);
  const costPerPoint = totalPoints > 0 ? Math.round(costs.total / totalPoints) : 0;
  $("#statisticsCaption").textContent = dashboardSubprojectLabel();
  $("#statisticsGrid").innerHTML = [
    ["Promedio avance", `${avgProgress}%`, "Media de avance de las actividades visibles."],
    ["Mediana avance", `${medianProgress}%`, "Punto medio del avance; reduce sesgos por extremos."],
    ["Desviacion", `${deviation} pts`, "Dispersion del avance; alto valor indica ejecucion desigual."],
    ["Cumplimiento", `${compliance}%`, "Tareas terminadas dentro del tiempo definido."],
    ["Riesgo estadistico", `${riskRate}%`, "Actividades en riesgo sobre el total visible."],
    ["Bloqueo relativo", `${blockedRate}%`, "Actividades bloqueadas sobre el total visible."],
    ["Costo por punto", formatMoney(costPerPoint), "Costo promedio estimado por punto de trabajo."],
    ["Puntos promedio", `${avgPoints} pt`, "Tamano medio de las actividades visibles."]
  ].map(([label, value, detail]) => `
    <article class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${detail}</p>
    </article>`).join("");

  $("#ownerStats").innerHTML = getWorkload(sourceTasks).map((item) => {
    const ownerTasks = sourceTasks.filter((task) => task.owner === item.owner);
    const ownerCost = costSummary(ownerTasks);
    const ownerRisk = ownerTasks.filter((task) => riskTasks().includes(task)).length;
    return `<div class="stat-row">
      <div>
        <strong>${escapeHtml(item.owner)}</strong>
        <span>${ownerTasks.length} act. / ${item.points} pt / ${ownerRisk} riesgo(s)</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="--fill:${item.progress}%"></div></div>
      <small>${formatMoney(ownerCost.executed)} ejecutado</small>
    </div>`;
  }).join("") || "<p class='empty-state'>Sin responsables en esta vista.</p>";

  $("#subprojectStats").innerHTML = subprojects
    .map((subproject) => ({ subproject, tasks: sourceTasks.filter((task) => String(task.subprojectId) === String(subproject.id)) }))
    .filter((item) => item.tasks.length)
    .map(({ subproject, tasks: subTasks }) => {
      const progress = averageValue(subTasks.map((task) => task.progress));
      const cost = costSummary(subTasks);
      const roi = roiSummary(subproject);
      return `<div class="stat-row">
        <div>
          <strong>${escapeHtml(subproject.name)}</strong>
          <span>${subTasks.length} act. / ROI ${roi.roi}% / ${cost.executionRate}% costo ejecutado</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="--fill:${progress}%"></div></div>
        <small>${progress}% avance</small>
      </div>`;
    }).join("") || "<p class='empty-state'>Sin subproyectos en esta vista.</p>";
}

function renderSubprojectFlow() {
  const sourceTasks = dashboardTasks();
  $("#flowCaption").textContent = dashboardSubprojectLabel();
  $("#subprojectFlow").innerHTML = columns.map((column, index) => {
    const columnTasks = sourceTasks.filter((task) => task.status === column);
    const avg = Math.round(columnTasks.reduce((sum, task) => sum + task.progress, 0) / (columnTasks.length || 1));
    const names = columnTasks.slice(0, 3).map((task) => `<li>${escapeHtml(task.name)}</li>`).join("");
    return `<article class="flow-step">
      <div class="flow-index">${index + 1}</div>
      <h4>${column}</h4>
      <strong>${columnTasks.length} actividad(es)</strong>
      <span>${avg}% avance promedio</span>
      <ul>${names || "<li>Sin actividades</li>"}</ul>
    </article>`;
  }).join("");
}

function renderAnalysis() {
  const sourceTasks = dashboardTasks();
  const late = sourceTasks.filter((task) => overdueTasks().includes(task));
  const risks = sourceTasks.filter((task) => riskTasks().includes(task));
  const workload = getWorkload(sourceTasks);
  const overloaded = workload.filter((item) => item.count >= 2);
  const blockers = sourceTasks.filter((task) => blockedTasks().includes(task));
  const cards = [
    {
      title: late.length ? "Riesgo de fecha" : "Fechas bajo control",
      body: late.length
        ? `${late.length} tarea(s) vencidas requieren replanificacion o desbloqueo.`
        : "No hay tareas vencidas frente a la fecha de corte del sprint."
    },
    {
      title: blockers.length ? "Bloqueos activos" : "Flujo sin bloqueos",
      body: blockers.length
        ? `${blockers.map((task) => task.name).join(", ")} necesitan decision o dependencia externa.`
        : "Las tareas activas no tienen bloqueo marcado."
    },
    {
      title: risks.length ? "Prioridad critica" : "Prioridades sanas",
      body: risks.length
        ? `${risks.map((task) => task.name).join(", ")} requieren seguimiento en daily.`
        : "Las tareas de prioridad alta tienen avance suficiente o ya fueron cerradas."
    },
    {
      title: overloaded.length ? "Carga concentrada" : "Carga equilibrada",
      body: overloaded.length
        ? `${overloaded.map((item) => item.owner).join(", ")} concentran varias tareas activas.`
        : "La distribucion de trabajo no muestra concentracion relevante."
    }
  ];
  $("#aiAnalysis").innerHTML = cards.map((card) => (
    `<article class="ai-card"><strong>${card.title}</strong><p>${card.body}</p></article>`
  )).join("");
}

function getWorkload(sourceTasks = tasks) {
  return team.map((person) => {
    const active = sourceTasks.filter((task) => task.owner === person.name && task.status !== "Terminado");
    const points = active.reduce((sum, task) => sum + task.points, 0);
    return { owner: person.name, count: active.length, points, progress: Math.min(100, points * 8) };
  });
}

function renderWorkload() {
  const sourceTasks = dashboardTasks();
  const workload = getWorkload(sourceTasks);
  $("#workloadCaption").textContent = `${sourceTasks.filter((task) => task.status !== "Terminado").length} tareas abiertas`;
  $("#workloadList").innerHTML = workload.map((item) => (
    `<div class="workload-row">
      <strong>${item.owner.split(" ")[0]}</strong>
      <div class="bar-track"><div class="bar-fill" style="--fill:${item.progress}%"></div></div>
      <span>${item.points} pt</span>
    </div>`
  )).join("");
}

function renderBadges() {
  const summaries = team.map((person) => ({ person, ...getBadgesForPerson(person.name) }));
  const totalBadges = summaries.reduce((sum, item) => sum + item.badges.length, 0);
  $("#badgesCaption").textContent = `${totalBadges} insignia(s) asignada(s)`;
  $("#badgesGrid").innerHTML = summaries.map((item) => {
    const badgeList = item.badges.length
      ? item.badges.map((badge) => `<span class="badge-pill" title="${escapeHtml(badge.detail)}"><strong>${badge.icon}</strong>${escapeHtml(badge.label)}</span>`).join("")
      : "<span class='empty-badge'>Sin insignias aun</span>";
    return `<article class="person-badge-card">
      <div class="person-badge-head">
        <span class="avatar" style="--avatar-color:${item.person.color}">${item.person.initials}</span>
        <div>
          <strong>${escapeHtml(item.person.name)}</strong>
          <p>${item.onTime.length}/${item.done.length || 0} cierres a tiempo - ${item.totalPoints} pt</p>
        </div>
      </div>
      <div class="badge-list">${badgeList}</div>
    </article>`;
  }).join("");
}

function renderBoard() {
  const visibleTasks = filteredTasks();
  $("#kanbanBoard").innerHTML = columns.map((column) => {
    const columnTasks = visibleTasks.filter((task) => task.status === column);
    return `<section class="kanban-column">
      <div class="column-header">
        <h3>${column}</h3>
        <span class="count-pill">${columnTasks.length}</span>
      </div>
      ${columnTasks.map(taskCard).join("") || "<p class='task-meta'>Sin tareas en esta etapa.</p>"}
    </section>`;
  }).join("");
}

function taskCard(task) {
  const priorityClass = task.priority === "Alta" ? "high" : task.priority === "Media" ? "medium" : "low";
  const comments = task.comments || [];
  const evidence = task.evidence || [];
  const cost = taskCostSummary(task);
  const blockerBadge = task.blocked ? `<span class="blocked-badge">Bloqueada</span>` : "";
  return `<article class="task-card ${priorityClass} ${task.blocked ? "blocked" : ""}">
    <div class="task-card-head">
      <h4>${escapeHtml(task.name)}</h4>
      ${blockerBadge}
    </div>
    <div class="task-subproject">${escapeHtml(subprojectName(task.subprojectId))}</div>
    <div class="task-meta"><span>${escapeHtml(task.owner)}</span><span>${formatDate(task.end)}</span></div>
    <div class="task-progress">
      <div class="bar-track"><div class="bar-fill" style="--fill:${task.progress}%"></div></div>
    </div>
    <div class="task-meta"><span>${task.progress}% avance</span><span>${task.points} pt</span></div>
    <div class="cost-strip">
      <span>Total ${formatMoney(cost.total)}</span>
      <span>Ejecutado ${formatMoney(cost.executed)}</span>
      <span>Pendiente ${formatMoney(cost.pending)}</span>
    </div>
    <div class="task-tags">
      <span class="priority">${task.priority}</span>
      <span class="dependency-tag">${escapeHtml(dependencyName(task))}</span>
    </div>
    <div class="task-history">
      <button class="mini-button" data-toggle-task="${task.id}" type="button">Comentarios (${comments.length}) - Evidencias (${evidence.length})</button>
      <div class="task-detail" id="task-detail-${task.id}" hidden>
        <div class="quick-edit">
          <label>Estado
            <select data-status-select="${task.id}">
              ${columns.map((column) => `<option ${task.status === column ? "selected" : ""}>${column}</option>`).join("")}
            </select>
          </label>
          <label>Avance
            <input data-progress-input="${task.id}" type="range" min="0" max="100" step="5" value="${task.progress}">
          </label>
          <label class="toggle-filter">
            <input data-blocked-toggle="${task.id}" type="checkbox" ${task.blocked ? "checked" : ""}>
            Bloqueada
          </label>
        </div>
        <div class="comment-list">
          <p><strong>Costos</strong> Inversion ${formatMoney(cost.investment)} - Optimizacion ${formatMoney(cost.optimization)} - Ejecucion ${formatMoney(cost.execution)}.</p>
          ${comments.map((comment) => `<p class="${comment.channel === "whatsapp" ? "whatsapp-comment" : ""}"><strong>${formatDate(comment.date)}</strong> ${comment.channel === "whatsapp" ? "<span>WhatsApp</span>" : ""} ${escapeHtml(comment.text)}</p>`).join("") || "<p>Sin comentarios registrados.</p>"}
        </div>
        <div class="evidence-list">
          ${evidence.map(evidenceItem).join("") || "<p>Sin evidencias cargadas.</p>"}
        </div>
        <label class="quick-input">
          Nuevo comentario
          <textarea data-comment-input="${task.id}" rows="2" placeholder="Escribe un seguimiento"></textarea>
        </label>
        <div class="task-actions">
          <button class="ghost-button small" data-edit-task="${task.id}" type="button">Editar datos</button>
          <button class="ghost-button small" data-add-comment="${task.id}" type="button">Agregar comentario</button>
          <button class="ghost-button small whatsapp-action" data-whatsapp-observation="${task.id}" type="button">Obs. WhatsApp</button>
          <label class="file-action">
            Adjuntar evidencia
            <input data-evidence-input="${task.id}" type="file" multiple>
          </label>
        </div>
      </div>
    </div>
  </article>`;
}

function evidenceItem(item) {
  const isImage = item.type.startsWith("image/");
  const size = item.size ? `${Math.round(item.size / 1024)} KB` : "archivo";
  const preview = isImage ? `<img src="${item.dataUrl}" alt="${escapeHtml(item.name)}">` : "<span class='file-icon'>DOC</span>";
  return `<a class="evidence-item" href="${item.dataUrl}" download="${escapeHtml(item.name)}">
    ${preview}
    <span>${escapeHtml(item.name)}<small>${size}</small></span>
  </a>`;
}

function renderGantt() {
  const startDate = new Date("2026-05-01T12:00:00");
  const dates = Array.from({ length: 28 }, (_, index) => new Date(startDate.getTime() + index * dayMs));
  $("#ganttScale").innerHTML = `<div></div>${dates.map((date) => `<div>${date.getDate()}</div>`).join("")}`;
  $("#ganttChart").innerHTML = tasks.map((task) => {
    const startOffset = Math.max(0, Math.round((new Date(`${task.start}T12:00:00`) - startDate) / dayMs));
    const span = daysBetween(task.start, task.end);
    const cells = dates.map((date) => {
      const isToday = date.toDateString() === today.toDateString() ? "today" : "";
      return `<div class="gantt-cell ${isToday}"></div>`;
    }).join("");
    return `<div class="gantt-row">
      <div class="gantt-label">${escapeHtml(task.name)}${task.blocked ? " - Bloqueada" : ""}</div>
      ${cells}
      <div class="gantt-bar ${task.blocked ? "blocked-bar" : ""}" title="${escapeHtml(task.name)} - ${task.progress}%" style="--start:${startOffset}; --span:${span}; --progress:${task.progress}%"></div>
    </div>`;
  }).join("");
}

function projectFlowReportText() {
  const points = pointsSummary();
  const costs = costSummary();
  const selectedTasks = dashboardTasks();
  const selectedPoints = pointsSummary(selectedTasks);
  const selectedCosts = costSummary(selectedTasks);
  const health = executiveHealth();
  const activeTasks = tasks.filter((task) => task.status !== "Terminado").length;
  const doneTasks = tasks.filter((task) => task.status === "Terminado").length;
  const focusTasks = strategicFocusTasks();
  const topRoi = [...subprojects]
    .sort((a, b) => roiSummary(b).roi - roiSummary(a).roi)
    .slice(0, 2)
    .map((subproject) => `${subproject.name} (${roiSummary(subproject).roi}% ROI)`);
  const subprojectLines = subprojects.map((subproject) => {
    const roi = roiSummary(subproject);
    const costsBySubproject = costSummary(subprojectTasks(subproject.id));
    return `- ${subproject.name}: avance ${subprojectProgress(subproject.id)}%, ROI ${roi.roi}% (${roi.label}), costo ejecutado ${formatMoney(costsBySubproject.executed)} de ${formatMoney(costsBySubproject.total)}. Foco: ${subprojectHighlight(subproject)} Prediccion: ${subprojectPrediction(subproject)}`;
  });
  const taskCostLines = [...tasks]
    .sort((a, b) => taskCostSummary(b).total - taskCostSummary(a).total)
    .slice(0, 5)
    .map((task) => {
    const cost = taskCostSummary(task);
    return `- ${task.name}: total ${formatMoney(cost.total)}, ejecutado ${formatMoney(cost.executed)} (${cost.executionRate}%), responsable ${task.owner}.`;
  });
  return [
    "INFORME GERENCIAL DE ESTADO",
    "",
    "1. RESUMEN EJECUTIVO",
    `Estado general: ${health.label}. El proyecto ${health.message}`,
    `Avance objetivo: ${completionRate()}% de actividades cerradas y ${points.rate}% de puntos completados (${points.done}/${points.total}).`,
    `Carga activa: ${activeTasks} actividad(es) abiertas y ${doneTasks} cerrada(s).`,
    `Situacion critica: ${overdueTasks().length} vencida(s), ${blockedTasks().length} bloqueada(s), ${riskTasks().length} en riesgo.`,
    `Lectura financiera: ${formatMoney(costs.executed)} ejecutado de ${formatMoney(costs.total)} (${costs.executionRate}%). Pendiente estimado: ${formatMoney(costs.pending)}.`,
    "",
    "2. DECISION GERENCIAL REQUERIDA",
    executiveRecommendation(),
    "",
    "3. FLUJOGRAMA EJECUTIVO",
    `Vista: ${dashboardSubprojectLabel()}. Puntos cerrados en vista: ${selectedPoints.done}/${selectedPoints.total} (${selectedPoints.rate}%).`,
    `Costos en vista: ${formatMoney(selectedCosts.executed)} ejecutado de ${formatMoney(selectedCosts.total)} (${selectedCosts.executionRate}%).`,
    ...flowSummaryLines(selectedTasks),
    "",
    "4. ANALISIS ESTRATEGICO POR SUBPROYECTO",
    ...subprojectLines,
    "",
    "5. RIESGOS Y FOCO DIRECTIVO",
    ...(focusTasks.length ? focusTasks.map((task) => `- ${task.name}: ${alertReason(task) || "seguimiento requerido"}, responsable ${task.owner}, avance ${task.progress}%, vence ${formatDate(task.end)}.`) : ["- Sin riesgos criticos activos. Mantener seguimiento preventivo."]),
    "",
    "6. COSTOS Y EJECUCION RELEVANTE",
    `Distribucion de costos: inversion ${formatMoney(costs.investment)}, optimizacion ${formatMoney(costs.optimization)}, ejecucion ${formatMoney(costs.execution)}.`,
    ...taskCostLines,
    "",
    "7. ROI Y VALOR ESPERADO",
    `Subproyectos con mayor retorno: ${topRoi.join(", ") || "sin ROI configurado"}.`,
    "Prioridad estrategica: proteger los subproyectos con mayor ROI y resolver primero bloqueos que afecten experiencia del cliente o fecha de entrega.",
    "",
    "8. ACCIONES EJECUTIVAS",
    ...buildFollowups().map((item) => `- ${item.title}: ${item.body}`)
  ].join("\n");
}

function renderRoiGrid() {
  $("#roiCaption").textContent = `${subprojects.length} subproyecto(s) con analisis`;
  $("#roiGrid").innerHTML = subprojects.map((subproject) => {
    const roi = roiSummary(subproject);
    return `<article class="roi-card">
      <div>
        <span class="roi-label">${escapeHtml(roi.label)}</span>
        <h4>${escapeHtml(subproject.name)}</h4>
      </div>
      <strong>${roi.roi}% ROI</strong>
      <p>Inversion: ${formatMoney(roi.investment)}</p>
      <p>Retorno esperado: ${formatMoney(roi.expectedReturn)}</p>
      <p>Margen estimado: ${formatMoney(roi.margin)}</p>
      <p>${escapeHtml(subprojectHighlight(subproject))}</p>
      <small>${escapeHtml(subprojectPrediction(subproject))}</small>
    </article>`;
  }).join("");
}

function renderReport() {
  $("#statusReport").value = projectFlowReportText();
  renderRoiGrid();
  $("#followupList").innerHTML = buildFollowups().map((item) => (
    `<article class="followup-card"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.body)}</p></article>`
  )).join("");
}

function businessCaseText() {
  return [
    "POR QUE USAR HELIX ZYMO",
    "",
    "Helix Zymo debe utilizarse porque conecta la ejecucion diaria con la lectura gerencial del proyecto. No solo administra tareas: convierte actividades, responsables, evidencias, costos, ROI, alertas y experiencia del cliente en informacion accionable para varias areas.",
    "",
    "Su nombre esta inspirado en la estructura del ADN: una helice ordenada, conectada y evolutiva. Cada subproyecto funciona como una cadena conectada de actividades, responsables, costos, decisiones, evidencias y aprendizajes.",
    "",
    "A diferencia de herramientas genericas, esta solucion esta pensada para adopcion transversal: operaciones puede registrar avances, lideres pueden controlar bloqueos, gerencia puede evaluar ROI y costos, y areas de servicio pueden anticipar impacto al cliente. Todo desde computador o celular, usando canales cotidianos como correo y WhatsApp.",
    "",
    "Valor agregado principal:",
    "- Gobierno multi-area: una sola vista para responsables de operaciones, proyectos, gerencia, servicio y areas de apoyo.",
    "- Trazabilidad: cada actividad conserva responsable, fecha, estado, costo, evidencia, comentarios y actualizaciones.",
    "- Comunicacion accionable: alertas por correo y WhatsApp para vencimientos, bloqueos, cambios y actualizaciones por subproyecto.",
    "- Control financiero: costos de inversion, optimizacion y ejecucion por subactividad, mas ROI por subproyecto.",
    "- Analitica gerencial: dashboard estadistico, semaforo, prediccion, riesgos, cumplimiento y costo por punto.",
    "- Experiencia del cliente: anticipa retrasos, comunica novedades y reduce perdida de informacion entre areas.",
    "- Adopcion practica: instructivos, chat IA de soporte, encuesta de satisfaccion y uso desde computador o celular.",
    "",
    "Conclusion:",
    "Conviene usar Helix Zymo cuando se necesita una herramienta simple pero robusta para coordinar varias areas, reducir dispersion, elevar trazabilidad y convertir el seguimiento operativo en decisiones gerenciales."
  ].join("\n");
}

function renderBusinessCase() {
  const rows = [
    ["Criterio", "Helix Zymo", "Herramientas genericas"],
    ["Uso multi-area", "Operaciones, proyectos, gerencia, servicio y apoyo trabajan sobre la misma informacion.", "Suelen requerir permisos, tableros o configuraciones separadas."],
    ["Seguimiento operativo", "Scrum, Gantt, registros, evidencias, responsables y subproyectos integrados.", "Puede dispersarse entre modulos o vistas aisladas."],
    ["Decision gerencial", "Informe ejecutivo con riesgos, costos, ROI, prediccion y foco directivo.", "Normalmente exige tableros personalizados o exportaciones."],
    ["Comunicacion", "Alertas por correo y WhatsApp para responsables de subproyecto.", "Requiere integraciones externas o automatizaciones pagas."],
    ["Control financiero", "Costos por subactividad y ROI por subproyecto en el flujo diario.", "No siempre conecta costo, avance y responsable en una sola lectura."],
    ["Adopcion", "Chat IA, instructivos, encuesta y experiencia responsive.", "Mayor curva de aprendizaje y dependencia de configuracion."]
  ];
  $("#comparisonTable").innerHTML = rows.map((row, index) => (
    `<div class="comparison-row ${index === 0 ? "comparison-head" : ""}">
      <strong>${escapeHtml(row[0])}</strong>
      <span>${escapeHtml(row[1])}</span>
      <span>${escapeHtml(row[2])}</span>
    </div>`
  )).join("");
  const benefits = [
    ["Alineacion", "Todas las areas consultan el mismo estado, evitando versiones distintas del proyecto."],
    ["Decision", "Gerencia ve riesgos, costos, ROI y acciones sin reconstruir informacion manualmente."],
    ["Responsabilidad", "Cada responsable queda vinculado a actividad, subproyecto, alerta y evidencia."],
    ["Experiencia del cliente", "La herramienta anticipa vencimientos y facilita comunicar cambios con oportunidad."],
    ["Control", "El avance se mide con puntos, fechas, costos, alertas, evidencias y satisfaccion de uso."],
    ["Adopcion", "Chat IA, instructivos y encuesta reducen friccion para usuarios de diferentes areas."]
  ];
  $("#benefitList").innerHTML = benefits.map(([title, body]) => (
    `<article class="benefit-card"><strong>${title}</strong><p>${body}</p></article>`
  )).join("");
  const areaValues = [
    ["Operaciones", "Registro practico de actividades, evidencias, costos y bloqueos."],
    ["Lideres de proyecto", "Control Scrum/Gantt, responsables, subproyectos, alertas y prediccion."],
    ["Gerencia", "Dashboard estadistico, ROI, informe ejecutivo y decisiones requeridas."],
    ["Servicio/cliente interno", "Alertas oportunas, trazabilidad de compromisos y encuesta de satisfaccion."],
    ["Finanzas/administracion", "Lectura de inversion, optimizacion, ejecucion y costo por punto."],
    ["Calidad/PMO", "Estandarizacion de seguimiento, instructivos, evidencias y gobierno del dato."]
  ];
  $("#areaValueList").innerHTML = areaValues.map(([title, body]) => (
    `<article class="benefit-card"><strong>${title}</strong><p>${body}</p></article>`
  )).join("");
  const validationItems = [
    ["Panel", "Mide avance, salud, estadistica, carga, flujo y badges."],
    ["Scrum/Gantt", "Permite gestionar actividades, fechas, estados, evidencias y comentarios."],
    ["Estados", "Genera informe gerencial con costos, riesgos, ROI y decisiones."],
    ["Alertas", "Prepara mensajes por correo y WhatsApp para responsables y actualizaciones."],
    ["Soporte", "Incluye chat IA, instructivos descargables/cargables y encuesta de satisfaccion."],
    ["Configuracion", "Administra responsables, subproyectos, actividades y alertas automaticas."]
  ];
  $("#functionalValidation").innerHTML = validationItems.map(([title, body]) => (
    `<article class="benefit-card"><strong>${title}</strong><p>${body}</p></article>`
  )).join("");
  $("#businessCaseText").value = businessCaseText();
}

function renderInstructions() {
  const baseInstructions = [
    { name: "Instructivo de usuario Helix Zymo", href: "instructivo_usuario_helix_zymo.md", detail: "Guia practica para registrar tareas, evidencias, costos y alertas." },
    { name: "Instructivo gerencial Helix Zymo", href: "instructivo_gerencial_helix_zymo.md", detail: "Guia ejecutiva para interpretar estado, ROI, riesgos y decisiones." }
  ];
  const uploadedCards = uploadedInstructions.map((item) => `
    <article class="instruction-card">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <p>Cargado el ${formatDate(item.date)} - ${Math.round((item.size || 0) / 1024)} KB</p>
      </div>
      <a class="ghost-button small" href="${item.dataUrl}" download="${escapeHtml(item.name)}">Descargar</a>
    </article>`);
  $("#instructionCount").textContent = `${baseInstructions.length + uploadedInstructions.length} disponible(s)`;
  $("#instructionList").innerHTML = [
    ...baseInstructions.map((item) => `
      <article class="instruction-card">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
        <a class="ghost-button small" href="${item.href}" download>Descargar</a>
      </article>`),
    ...uploadedCards
  ].join("");
}

function renderSatisfactionSurvey() {
  const count = satisfactionResponses.length;
  $("#surveyCount").textContent = `${count} respuesta(s)`;
  if (!count) {
    $("#surveyResults").innerHTML = "<p class='empty-state'>Aun no hay respuestas registradas.</p>";
    return;
  }
  const average = (field) => {
    const value = satisfactionResponses.reduce((sum, item) => sum + Number(item[field] || 0), 0) / count;
    return Math.round(value * 10) / 10;
  };
  const npsAverage = average("nps");
  const promoters = satisfactionResponses.filter((item) => item.nps >= 9).length;
  const detractors = satisfactionResponses.filter((item) => item.nps <= 6).length;
  const npsScore = Math.round(((promoters - detractors) / count) * 100);
  const recentComments = satisfactionResponses
    .filter((item) => item.comment)
    .slice(-3)
    .reverse();
  $("#surveyResults").innerHTML = `
    <div class="survey-summary">
      <article><span>Satisfaccion</span><strong>${average("satisfaction")}/5</strong></article>
      <article><span>Facilidad</span><strong>${average("ease")}/5</strong></article>
      <article><span>Utilidad</span><strong>${average("utility")}/5</strong></article>
      <article><span>NPS</span><strong>${npsScore}</strong><small>Promedio ${npsAverage}/10</small></article>
    </div>
    <div class="survey-comments">
      <h4>Comentarios recientes</h4>
      ${recentComments.map((item) => `<p><strong>${escapeHtml(item.name || item.role)}</strong> ${escapeHtml(item.comment)}</p>`).join("") || "<p>Sin comentarios registrados.</p>"}
    </div>`;
}

function addAiMessage(role, text) {
  const messages = $("#aiChatMessages");
  const className = role === "user" ? "user-message" : "assistant-message";
  messages.insertAdjacentHTML("beforeend", `<article class="ai-message ${className}">${escapeHtml(text)}</article>`);
  messages.scrollTop = messages.scrollHeight;
}

function aiSupportAnswer(question) {
  const query = question.toLowerCase();
  const costs = costSummary();
  const health = executiveHealth();
  const focusTasks = strategicFocusTasks();
  const topFocus = focusTasks[0];
  if (query.includes("estado") || query.includes("gerencial") || query.includes("comite")) {
    return `Estado ${health.label}: ${health.message} Avance ${completionRate()}%, puntos ${pointsSummary().rate}% y costos ejecutados ${formatMoney(costs.executed)} de ${formatMoney(costs.total)}. Decision sugerida: ${executiveRecommendation()}`;
  }
  if (query.includes("prior") || query.includes("hoy") || query.includes("riesgo")) {
    if (!topFocus) return "Prioridad de hoy: mantener cierres en revision, actualizar evidencias y conservar la cadencia. No hay riesgos criticos activos.";
    return `Prioridad de hoy: ${topFocus.name}. Motivo: ${alertReason(topFocus) || "seguimiento requerido"}. Responsable: ${topFocus.owner}. Accion: resolver dependencia, actualizar avance y dejar evidencia.`;
  }
  if (query.includes("roi") || query.includes("retorno")) {
    const best = [...subprojects].sort((a, b) => roiSummary(b).roi - roiSummary(a).roi)[0];
    const roi = best ? roiSummary(best) : null;
    return best ? `Mayor ROI: ${best.name} con ${roi.roi}%. Margen estimado ${formatMoney(roi.margin)}. Recomendacion: proteger alcance, costos y bloqueos de este subproyecto antes de asumir nuevas actividades.` : "Aun no hay subproyectos configurados para calcular ROI.";
  }
  if (query.includes("costo") || query.includes("inversion") || query.includes("ejecucion")) {
    return `Costos actuales: inversion ${formatMoney(costs.investment)}, optimizacion ${formatMoney(costs.optimization)}, ejecucion ${formatMoney(costs.execution)}. Ejecutado ${formatMoney(costs.executed)} (${costs.executionRate}%) y pendiente ${formatMoney(costs.pending)}.`;
  }
  if (query.includes("evidencia") || query.includes("archivo")) {
    return "Para cargar evidencias: entra al tablero Scrum, abre Comentarios/Evidencias en la tarea, usa Adjuntar evidencia y selecciona archivos. Tambien puedes editar la actividad y cargar evidencias desde el formulario.";
  }
  if (query.includes("whatsapp") || query.includes("correo") || query.includes("alerta")) {
    return "Para alertas: usa los botones de correo o WA en registros y alertas automaticas. El sistema prepara mensajes con responsable, motivo, avance, fecha, impacto cliente y enlace de envio.";
  }
  if (query.includes("instructivo") || query.includes("guia") || query.includes("manual")) {
    return "En esta vista puedes descargar los instructivos de usuario y gerencial, o cargar instructivos propios en PDF, Word, TXT o Markdown para tenerlos centralizados.";
  }
  return `Respuesta practica: revisa primero el estado ${health.label}, luego valida riesgos, costos y ROI. Para esta pregunta recomiendo consultar el informe gerencial y actualizar tareas con responsable, avance, evidencia y costo real.`;
}

function renderSupport() {
  renderInstructions();
  renderSatisfactionSurvey();
  const messages = $("#aiChatMessages");
  if (!messages.dataset.ready) {
    addAiMessage("assistant", "Hola, soy el asistente IA de Helix Zymo. Puedo ayudarte con estado gerencial, prioridades, ROI, costos, alertas, evidencias e instructivos.");
    messages.dataset.ready = "true";
  }
}

function buildFollowups() {
  const followups = [];
  blockedTasks().forEach((task) => followups.push({
    title: `Desbloquear: ${task.name}`,
    body: `${task.owner} debe resolver dependencia: ${dependencyName(task)}.`
  }));
  overdueTasks().forEach((task) => followups.push({
    title: `Revisar vencimiento: ${task.name}`,
    body: `${task.owner} debe actualizar fecha, bloqueo o plan de cierre.`
  }));
  riskTasks().filter((task) => !task.blocked).forEach((task) => followups.push({
    title: "Acelerar prioridad alta",
    body: `${task.name} esta por debajo del avance esperado para el sprint.`
  }));
  if (!followups.length) {
    followups.push({ title: "Mantener cadencia", body: "Continuar daily scrum y cierre de tareas en revision." });
  }
  return followups;
}

function renderAll() {
  renderTeam();
  renderMetrics();
  renderSprintInsights();
  renderStatisticsDashboard();
  renderSubprojectFlow();
  renderAnalysis();
  renderWorkload();
  renderBadges();
  renderBoard();
  renderGantt();
  renderReport();
  renderBusinessCase();
  renderSupport();
  renderSettings();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function switchView(viewName) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewName}View`).classList.add("active");
}

function createEmailAlert() {
  const alerts = alertTasks();
  const subject = encodeURIComponent(`${icon.rocket} Alertas positivas del proyecto - Helix Zymo`);
  const body = encodeURIComponent(alerts.length
    ? [
      `Hola equipo ${icon.wave}`,
      "",
      "Tenemos oportunidades de accion para cuidar los compromisos del proyecto y fortalecer la experiencia del cliente:",
      "",
      ...alerts.map((task) => enthusiasticAlertLine(task)),
      "",
      `Gracias por actualizar avances, evidencias o bloqueos. Cada cierre a tiempo suma confianza para el cliente. ${icon.muscle}`
    ].join("\n")
    : `${icon.party} Excelente trabajo: no hay alertas criticas activas en el sprint. Sigamos cuidando la experiencia del cliente.`);
  const recipients = team.map((person) => person.email).join(",");
  window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
  showToast("Se preparo el correo con las alertas del sprint.");
}

function enthusiasticAlertLine(task) {
  const reason = alertReason(task) || "seguimiento requerido";
  return `${icon.rocket} ${task.name} - Subproyecto: ${subprojectName(task.subprojectId)}. Responsable: ${task.owner}. Motivo: ${reason}. Avance: ${task.progress}%. Fecha fin: ${formatDate(task.end)}. Impacto cliente: mantener visibilidad, confianza y cumplimiento.`;
}

function alertMessage(task) {
  const item = automaticAlertItems().find((alert) => alert.task.id === task.id);
  const reason = item ? item.reasons.join(", ") : alertReason(task);
  return [
    `${icon.rocket} Hola ${task.owner.split(" ")[0]}, tenemos una oportunidad de accion en Helix Zymo.`,
    "",
    `${icon.pin} Actividad: ${task.name}`,
    `${icon.tag} Subproyecto: ${subprojectName(task.subprojectId)}`,
    `${icon.target} Motivo: ${reason || "seguimiento requerido"}`,
    `${icon.calendar} Fecha fin: ${formatDate(task.end)}`,
    `${icon.chart} Avance: ${task.progress}%`,
    `${icon.link} Dependencia: ${dependencyName(task)}`,
    "",
    `${icon.star} Experiencia del cliente: actualizar esta actividad ayuda a mantener confianza, visibilidad y cumplimiento.`,
    `${icon.muscle} Gracias por avanzar y registrar estado, evidencia o bloqueo en la herramienta.`
  ].join("\n");
}

function alertMailUrl(task, person) {
  const email = person?.email || "";
  return `mailto:${email}?subject=${encodeURIComponent(`Alerta proyecto - ${task.name}`)}&body=${encodeURIComponent(alertMessage(task))}`;
}

function alertWhatsappUrl(task, person) {
  return `https://wa.me/${person.phone}?text=${encodeURIComponent(alertMessage(task))}`;
}

function alertReason(task) {
  const reasons = [];
  if (new Date(`${task.end}T12:00:00`) < today && task.progress < 100) reasons.push("vencida");
  if (task.blocked) reasons.push("bloqueada");
  if (task.priority === "Alta" && task.progress < 60 && task.status !== "Terminado") reasons.push("prioridad alta con avance bajo");
  return reasons.join(", ");
}

function whatsappMessage(person, ownerTasks) {
  const lines = [
    `${icon.rocket} Hola ${person.name.split(" ")[0]}, tienes oportunidades de accion en Helix Zymo:`,
    "",
    ...ownerTasks.map((task) => `${icon.sparkle} ${task.name}: ${alertReason(task) || "seguimiento requerido"}. Avance ${task.progress}%, vence ${formatDate(task.end)}, dependencia: ${dependencyName(task)}.`),
    "",
    `${icon.star} Impacto cliente: mantener esta informacion actualizada mejora la confianza, la comunicacion y el cumplimiento.`,
    `${icon.muscle} Gracias por avanzar y registrar estado, bloqueo o evidencia en la herramienta.`
  ];
  return lines.join("\n");
}

function projectFlowShareText(person = null) {
  const greeting = person ? `${icon.wave} Hola ${person.name.split(" ")[0]}, comparto el flujograma ejecutivo de Helix Zymo:` : `${icon.rocket} Flujograma ejecutivo Helix Zymo`;
  return [
    greeting,
    "",
    projectFlowReportText(),
    "",
    `${icon.chart} Lectura ejecutiva: el foco esta en desbloquear riesgos, proteger fechas y cuidar el ROI por subproyecto.`,
    `${icon.muscle} Gracias por mantener comentarios, evidencias y avances actualizados.`
  ].join("\n");
}

function sendProjectFlowEmail() {
  const recipients = team.map((person) => person.email).filter(Boolean).join(",");
  const subject = "Flujograma ejecutivo Helix Zymo - prediccion y ROI";
  const body = projectFlowShareText();
  window.location.href = `mailto:${recipients}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function renderFlowWhatsappShare() {
  const title = $("#whatsappDialog h2");
  const description = $("#whatsappDialog .dialog-header p");
  title.textContent = "Flujograma por WhatsApp";
  description.textContent = "Informe con prediccion, puntos relevantes y ROI listo para cada responsable.";
  $("#whatsappList").innerHTML = team.map((person) => {
    const message = projectFlowShareText(person);
    const url = person.phone ? `https://wa.me/${person.phone}?text=${encodeURIComponent(message)}` : "#";
    return `<article class="whatsapp-card">
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <p>${person.phone ? `Informe listo para enviar al ${escapeHtml(person.phone)}.` : "Registra telefono para enviar por WhatsApp."}</p>
      </div>
      <a class="primary-button whatsapp-link ${person.phone ? "" : "disabled-link"}" href="${url}" target="_blank" rel="noopener">Enviar WA</a>
      <textarea readonly>${escapeHtml(message)}</textarea>
    </article>`;
  }).join("");
  $("#whatsappDialog").showModal();
}

function renderWhatsappAlerts() {
  const alerts = alertTasks();
  $("#whatsappDialog h2").textContent = "Alertas por WhatsApp";
  $("#whatsappDialog .dialog-header p").textContent = "Mensajes listos para enviar a cada responsable.";
  const cards = team.map((person) => {
    const ownerTasks = alerts.filter((task) => task.owner === person.name);
    if (!ownerTasks.length) {
      return `<article class="whatsapp-card muted-card">
        <div>
          <strong>${escapeHtml(person.name)}</strong>
          <p>Sin alertas activas.</p>
        </div>
      </article>`;
    }
    const message = whatsappMessage(person, ownerTasks);
    const url = `https://wa.me/${person.phone}?text=${encodeURIComponent(message)}`;
    return `<article class="whatsapp-card">
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <p>${ownerTasks.length} alerta(s) listas para enviar al ${person.phone}.</p>
      </div>
      <a class="primary-button whatsapp-link" href="${url}" target="_blank" rel="noopener">Enviar WA</a>
      <textarea readonly>${message}</textarea>
    </article>`;
  }).join("");
  $("#whatsappList").innerHTML = cards;
  $("#whatsappDialog").showModal();
}

function openWhatsappObservation(taskId) {
  const task = taskById(taskId);
  whatsappObservationTaskId = taskId;
  $("#whatsappObservationTask").textContent = task ? task.name : "";
  $("#whatsappObservationSender").value = task?.owner || team[0].name;
  $("#whatsappObservationText").value = "";
  $("#whatsappObservationDialog").showModal();
}

function openTaskForm(task = null) {
  $("#taskForm").reset();
  $("#taskId").value = task?.id || "";
  $("#taskDialogTitle").textContent = task ? "Editar actividad" : "Nueva tarea";
  $("#taskName").value = task?.name || "";
  $("#taskOwner").value = task?.owner || team[0]?.name || "";
  $("#taskSubproject").value = task?.subprojectId || subprojects[0]?.id || "";
  $("#taskStart").value = task?.start || today.toISOString().slice(0, 10);
  $("#taskEnd").value = task?.end || "2026-05-15";
  $("#taskPoints").value = task?.points || 3;
  $("#taskInvestmentCost").value = task?.investmentCost || "";
  $("#taskOptimizationCost").value = task?.optimizationCost || "";
  $("#taskExecutionCost").value = task?.executionCost || "";
  $("#taskDependency").value = task?.dependencyId || "";
  $("#taskBlocked").checked = Boolean(task?.blocked);
  $("#taskPriority").value = task?.priority || "Media";
  $("#taskStatus").value = task?.status || "Backlog";
  $("#taskProgress").value = task?.progress ?? 20;
  $("#taskComment").value = "";
  $("#taskDialog").showModal();
}

function updateTask(task, patch) {
  const snapshot = { ...task };
  if (patch.status === "Terminado" && task.status !== "Terminado" && !patch.completedAt) {
    patch.completedAt = today.toISOString().slice(0, 10);
  }
  if (patch.status && patch.status !== "Terminado") {
    patch.completedAt = "";
  }
  Object.assign(task, patch);
  if (!saveTasks()) {
    Object.assign(task, snapshot);
    return false;
  }
  createUpdateAlert(task.subprojectId, "Actividad actualizada", task);
  renderAll();
  return true;
}

function bindEvents() {
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $$(".chip").forEach((chip) => chip.addEventListener("click", () => {
    currentFilter = chip.dataset.filter;
    $$(".chip").forEach((item) => item.classList.toggle("active", item === chip));
    renderBoard();
  }));
  $("#taskSearch").addEventListener("input", (event) => {
    searchQuery = event.target.value.trim();
    renderBoard();
  });
  $("#ownerFilter").addEventListener("change", (event) => {
    currentOwnerFilter = event.target.value;
    renderBoard();
  });
  $("#subprojectFilter").addEventListener("change", (event) => {
    currentSubprojectFilter = event.target.value;
    renderBoard();
  });
  $("#dashboardSubprojectFilter").addEventListener("change", (event) => {
    dashboardSubprojectFilter = event.target.value;
    renderMetrics();
    renderSprintInsights();
    renderStatisticsDashboard();
    renderSubprojectFlow();
    renderAnalysis();
    renderWorkload();
    showToast(`Panel actualizado: ${dashboardSubprojectLabel()}.`);
  });
  $("#blockedFilter").addEventListener("change", (event) => {
    showBlockedOnly = event.target.checked;
    renderBoard();
  });
  $("#refreshAnalysisBtn").addEventListener("click", () => {
    renderAnalysis();
    renderSprintInsights();
    renderStatisticsDashboard();
    showToast("Analisis IA actualizado con los datos actuales.");
  });
  $("#emailAlertsBtn").addEventListener("click", createEmailAlert);
  $("#whatsappAlertsBtn").addEventListener("click", renderWhatsappAlerts);
  $("#autoAlertsBtn").addEventListener("click", () => {
    switchView("settings");
    showToast(`${automaticAlertItems().length} alerta(s) automatica(s) activa(s).`);
  });
  $("#closeWhatsappBtn").addEventListener("click", () => $("#whatsappDialog").close());
  $("#todayBtn").addEventListener("click", () => showToast("La columna resaltada corresponde a hoy."));
  $("#flowEmailBtn").addEventListener("click", sendProjectFlowEmail);
  $("#flowWhatsappBtn").addEventListener("click", renderFlowWhatsappShare);
  $("#copyReportBtn").addEventListener("click", async () => {
    const report = $("#statusReport");
    try {
      await navigator.clipboard.writeText(report.value);
    } catch {
      report.focus();
      report.select();
      document.execCommand("copy");
    }
    showToast("Estado copiado al portapapeles.");
  });
  $("#copyBusinessCaseBtn").addEventListener("click", async () => {
    const text = $("#businessCaseText").value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      $("#businessCaseText").focus();
      $("#businessCaseText").select();
      document.execCommand("copy");
    }
    showToast("Argumento copiado al portapapeles.");
  });
  $("#aiChatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#aiQuestion");
    const question = input.value.trim();
    if (!question) {
      showToast("Escribe una pregunta para el asistente IA.");
      return;
    }
    addAiMessage("user", question);
    addAiMessage("assistant", aiSupportAnswer(question));
    input.value = "";
  });
  $("[data-ai-question]").closest(".quick-prompts").addEventListener("click", (event) => {
    const button = event.target.closest("[data-ai-question]");
    if (!button) return;
    const question = button.dataset.aiQuestion;
    addAiMessage("user", question);
    addAiMessage("assistant", aiSupportAnswer(question));
  });
  $("#instructionUpload").addEventListener("change", async (event) => {
    const docs = await readInstructionFiles(event.target.files);
    uploadedInstructions = [...uploadedInstructions, ...docs];
    saveInstructions();
    renderInstructions();
    event.target.value = "";
    showToast(`${docs.length} instructivo(s) cargado(s).`);
  });
  $("#clearInstructionsBtn").addEventListener("click", () => {
    uploadedInstructions = [];
    saveInstructions();
    renderInstructions();
    showToast("Instructivos cargados eliminados.");
  });
  $("#satisfactionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    satisfactionResponses.push({
      id: Date.now(),
      date: today.toISOString().slice(0, 10),
      name: $("#surveyName").value.trim(),
      role: $("#surveyRole").value,
      satisfaction: Number($("#surveySatisfaction").value),
      ease: Number($("#surveyEase").value),
      utility: Number($("#surveyUtility").value),
      nps: Number($("#surveyNps").value),
      comment: $("#surveyComment").value.trim()
    });
    saveSurveyResponses();
    $("#satisfactionForm").reset();
    $("#surveySatisfaction").value = 4;
    $("#surveyEase").value = 4;
    $("#surveyUtility").value = 4;
    $("#surveyNps").value = 8;
    renderSatisfactionSurvey();
    showToast("Encuesta de satisfaccion guardada.");
  });
  $("#clearSurveyBtn").addEventListener("click", () => {
    satisfactionResponses = [];
    saveSurveyResponses();
    renderSatisfactionSurvey();
    showToast("Respuestas de encuesta eliminadas.");
  });
  $("#clearUpdateAlertsBtn").addEventListener("click", () => {
    updateAlerts = [];
    saveUpdateAlerts();
    renderUpdateAlerts();
    showToast("Alertas de actualizacion limpiadas.");
  });
  $("#newTaskBtn").addEventListener("click", () => {
    openTaskForm();
  });
  $("#newActivityRecordBtn").addEventListener("click", () => openTaskForm());
  $("#responsibleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#responsibleId").value;
    const personData = normalizePerson({
      id: id || Date.now(),
      name: $("#responsibleName").value.trim(),
      email: $("#responsibleEmail").value.trim(),
      phone: $("#responsiblePhone").value.trim(),
      color: $("#responsibleColor").value
    });
    if (id) {
      const index = team.findIndex((person) => String(person.id) === String(id));
      const oldName = team[index]?.name;
      team[index] = personData;
      tasks = tasks.map((task) => task.owner === oldName ? { ...task, owner: personData.name } : task);
      saveTasks();
    } else {
      team.push(personData);
    }
    saveTeam();
    $("#responsibleForm").reset();
    $("#responsibleId").value = "";
    $("#responsibleColor").value = "#5461c8";
    renderAll();
    showToast("Responsable guardado.");
  });
  $("#responsibleList").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-person]");
    const deleteButton = event.target.closest("[data-delete-person]");
    if (editButton) {
      const person = team.find((item) => String(item.id) === editButton.dataset.editPerson);
      $("#responsibleId").value = person.id;
      $("#responsibleName").value = person.name;
      $("#responsibleEmail").value = person.email;
      $("#responsiblePhone").value = person.phone;
      $("#responsibleColor").value = person.color;
    }
    if (deleteButton) {
      const person = team.find((item) => String(item.id) === deleteButton.dataset.deletePerson);
      if (tasks.some((task) => task.owner === person.name)) {
        showToast("No se puede eliminar: tiene actividades asignadas.");
        return;
      }
      team = team.filter((item) => String(item.id) !== deleteButton.dataset.deletePerson);
      saveTeam();
      renderAll();
      showToast("Responsable eliminado.");
    }
  });
  $("#subprojectForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const id = $("#subprojectId").value;
    const data = normalizeSubproject({
      id: id || Date.now(),
      name: $("#subprojectName").value.trim(),
      goal: $("#subprojectGoal").value.trim(),
      investment: $("#subprojectInvestment").value,
      expectedReturn: $("#subprojectReturn").value
    });
    if (id) {
      const index = subprojects.findIndex((item) => String(item.id) === String(id));
      subprojects[index] = data;
    } else {
      subprojects.push(data);
    }
    saveSubprojects();
    createUpdateAlert(data.id, id ? "Subproyecto actualizado" : "Subproyecto creado");
    $("#subprojectForm").reset();
    $("#subprojectId").value = "";
    renderAll();
    showToast("Subproyecto guardado.");
  });
  $("#subprojectList").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-subproject]");
    const deleteButton = event.target.closest("[data-delete-subproject]");
    if (editButton) {
      const item = subprojects.find((subproject) => String(subproject.id) === editButton.dataset.editSubproject);
      $("#subprojectId").value = item.id;
      $("#subprojectName").value = item.name;
      $("#subprojectGoal").value = item.goal;
      $("#subprojectInvestment").value = item.investment;
      $("#subprojectReturn").value = item.expectedReturn;
    }
    if (deleteButton) {
      const item = subprojects.find((subproject) => String(subproject.id) === deleteButton.dataset.deleteSubproject);
      if (tasks.some((task) => String(task.subprojectId) === String(item.id))) {
        showToast("No se puede eliminar: tiene actividades asignadas.");
        return;
      }
      subprojects = subprojects.filter((subproject) => String(subproject.id) !== deleteButton.dataset.deleteSubproject);
      saveSubprojects();
      renderAll();
      showToast("Subproyecto eliminado.");
    }
  });
  $("#activityRegistry").addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-task]");
    if (editButton) openTaskForm(taskById(editButton.dataset.editTask));
  });
  $("#kanbanBoard").addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-toggle-task]");
    const commentButton = event.target.closest("[data-add-comment]");
    const whatsappObservationButton = event.target.closest("[data-whatsapp-observation]");
    const editTaskButton = event.target.closest("[data-edit-task]");
    if (toggleButton) {
      const detail = $(`#task-detail-${toggleButton.dataset.toggleTask}`);
      detail.hidden = !detail.hidden;
    }
    if (editTaskButton) {
      openTaskForm(taskById(editTaskButton.dataset.editTask));
    }
    if (whatsappObservationButton) {
      openWhatsappObservation(whatsappObservationButton.dataset.whatsappObservation);
    }
    if (commentButton) {
      const task = taskById(commentButton.dataset.addComment);
      const input = $(`[data-comment-input="${commentButton.dataset.addComment}"]`);
      const text = input.value.trim();
      if (!text) {
        showToast("Escribe un comentario antes de guardarlo.");
        return;
      }
      task.comments.push({ text, date: today.toISOString().slice(0, 10) });
      if (!saveTasks()) {
        task.comments.pop();
        return;
      }
      createUpdateAlert(task.subprojectId, "Comentario agregado a la actividad", task);
      renderAll();
      showToast("Comentario agregado al seguimiento.");
    }
  });
  $("#whatsappObservationForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const task = taskById(whatsappObservationTaskId);
    const sender = $("#whatsappObservationSender").value;
    const text = $("#whatsappObservationText").value.trim();
    if (!task || !text) {
      showToast("Selecciona una tarea y registra la observacion.");
      return;
    }
    task.comments.push({
      text: `${sender}: ${text}`,
      date: today.toISOString().slice(0, 10),
      channel: "whatsapp"
    });
    if (!saveTasks()) {
      task.comments.pop();
      return;
    }
    createUpdateAlert(task.subprojectId, "Observacion registrada via WhatsApp", task);
    $("#whatsappObservationDialog").close();
    renderAll();
    showToast("Observacion de WhatsApp registrada.");
  });
  $("#kanbanBoard").addEventListener("change", async (event) => {
    const evidenceInput = event.target.closest("[data-evidence-input]");
    const statusSelect = event.target.closest("[data-status-select]");
    const progressInput = event.target.closest("[data-progress-input]");
    const blockedToggle = event.target.closest("[data-blocked-toggle]");
    if (evidenceInput) {
      const task = taskById(evidenceInput.dataset.evidenceInput);
      const evidence = await readEvidenceFiles(evidenceInput.files);
      const previousLength = task.evidence.length;
      task.evidence.push(...evidence);
      if (!saveTasks()) {
        task.evidence.splice(previousLength);
        return;
      }
      createUpdateAlert(task.subprojectId, `${evidence.length} evidencia(s) cargada(s)`, task);
      renderAll();
      showToast(`${evidence.length} evidencia(s) cargada(s).`);
    }
    if (statusSelect) {
      const task = taskById(statusSelect.dataset.statusSelect);
      updateTask(task, { status: statusSelect.value, progress: statusSelect.value === "Terminado" ? 100 : task.progress });
      showToast(statusSelect.value === "Terminado" && wasClosedOnTime(task) ? "Estado actualizado. Insignia por cierre a tiempo." : "Estado actualizado.");
    }
    if (progressInput) {
      const task = taskById(progressInput.dataset.progressInput);
      const progress = Number(progressInput.value);
      updateTask(task, { progress, status: progress === 100 ? "Terminado" : task.status });
      showToast(progress === 100 && wasClosedOnTime(task) ? "Avance actualizado. Insignia por cierre a tiempo." : "Avance actualizado.");
    }
    if (blockedToggle) {
      const task = taskById(blockedToggle.dataset.blockedToggle);
      updateTask(task, { blocked: blockedToggle.checked });
      showToast(blockedToggle.checked ? "Tarea marcada como bloqueada." : "Bloqueo retirado.");
    }
  });
  $("#taskForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    if ($("#taskEnd").value < $("#taskStart").value) {
      showToast("La fecha final debe ser igual o posterior al inicio.");
      return;
    }
    const initialComment = $("#taskComment").value.trim();
    const evidence = await readEvidenceFiles($("#taskEvidence").files);
    const existingId = $("#taskId").value;
    if (existingId) {
      const task = taskById(existingId);
      const previousEvidenceLength = task.evidence.length;
      const previousCommentLength = task.comments.length;
      const patch = normalizeTask({
        ...task,
        name: $("#taskName").value.trim(),
        owner: $("#taskOwner").value,
        subprojectId: $("#taskSubproject").value,
        status: $("#taskStatus").value,
        priority: $("#taskPriority").value,
        start: $("#taskStart").value,
        end: $("#taskEnd").value,
        progress: Number($("#taskProgress").value),
        points: Number($("#taskPoints").value || 3),
        investmentCost: Number($("#taskInvestmentCost").value || 0),
        optimizationCost: Number($("#taskOptimizationCost").value || 0),
        executionCost: Number($("#taskExecutionCost").value || 0),
        dependencyId: $("#taskDependency").value,
        blocked: $("#taskBlocked").checked,
        comments: [
          ...task.comments,
          ...(initialComment ? [{ text: initialComment, date: today.toISOString().slice(0, 10) }] : [])
        ],
        evidence: [...task.evidence, ...evidence]
      });
      if (patch.status === "Terminado" && task.status !== "Terminado") {
        patch.completedAt = today.toISOString().slice(0, 10);
      }
      if (patch.status !== "Terminado") {
        patch.completedAt = "";
      }
      Object.assign(task, patch);
      if (!saveTasks()) {
        task.evidence.splice(previousEvidenceLength);
        task.comments.splice(previousCommentLength);
        return;
      }
      createUpdateAlert(task.subprojectId, "Datos de actividad actualizados desde formulario", task);
      $("#taskForm").reset();
      $("#taskDialog").close();
      renderAll();
      showToast("Actividad actualizada.");
      return;
    }
    const newTask = normalizeTask({
      id: Date.now(),
      name: $("#taskName").value.trim(),
      owner: $("#taskOwner").value,
      subprojectId: $("#taskSubproject").value,
      status: $("#taskStatus").value,
      priority: $("#taskPriority").value,
      start: $("#taskStart").value,
      end: $("#taskEnd").value,
      progress: Number($("#taskProgress").value),
      points: Number($("#taskPoints").value || 3),
      investmentCost: Number($("#taskInvestmentCost").value || 0),
      optimizationCost: Number($("#taskOptimizationCost").value || 0),
      executionCost: Number($("#taskExecutionCost").value || 0),
      dependencyId: $("#taskDependency").value,
      blocked: $("#taskBlocked").checked,
      comments: initialComment ? [{ text: initialComment, date: today.toISOString().slice(0, 10) }] : [],
      evidence
    });
    tasks.push(newTask);
    if (!saveTasks()) {
      tasks = tasks.filter((task) => task.id !== newTask.id);
      return;
    }
    createUpdateAlert(newTask.subprojectId, "Nueva actividad creada en el subproyecto", newTask);
    $("#taskForm").reset();
    $("#taskDialog").close();
    renderAll();
    showToast("Tarea creada y agregada al seguimiento.");
  });
}

bindEvents();
renderAll();
