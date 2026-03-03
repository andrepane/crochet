(() => {
  const STORAGE_KEY = "crochet_counter_v03";

  const $ = (sel) => document.querySelector(sel);
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));
  const vibrate = () => { if (navigator.vibrate) navigator.vibrate(12); };

  const nowTime = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const defaultState = { projects: [], activeProjectId: null };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return structuredClone(defaultState);
      parsed.projects ||= [];
      if (!Array.isArray(parsed.projects)) parsed.projects = [];
      for (const project of parsed.projects) ensureProjectShape(project);
      return parsed;
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function getActiveProject() {
    return state.projects.find((p) => p.id === state.activeProjectId) || null;
  }

  function pushUndo(project, patch) {
    project.undoStack ||= [];
    project.undoStack.push(patch);
    if (project.undoStack.length > 50) project.undoStack.shift();
  }

  function addHistory(project, text) {
    project.history ||= [];
    project.history.unshift(`${nowTime()} · ${text}`);
    if (project.history.length > 30) project.history.pop();
  }

  function applyProjectUpdate(fn, historyText) {
    const project = getActiveProject();
    if (!project) return;

    fn(project);
    if (historyText) addHistory(project, historyText);
    project.updatedAt = Date.now();

    saveState();
    renderProject();
  }

  const viewHome = $("#viewHome");
  const viewProject = $("#viewProject");

  const subtitle = $("#subtitle");
  const btnBack = $("#btnBack");
  const btnResetProject = $("#btnResetProject");

  const formNewProject = $("#formNewProject");
  const projectName = $("#projectName");
  const projectList = $("#projectList");
  const emptyProjects = $("#emptyProjects");
  const btnClearAll = $("#btnClearAll");

  const projectTitle = $("#projectTitle");
  const projectMeta = $("#projectMeta");
  const btnDeleteProject = $("#btnDeleteProject");
  const btnToggleFinished = $("#btnToggleFinished");

  const roundSummaryMeta = $("#roundSummaryMeta");
  const roundSummaryList = $("#roundSummaryList");

  const inputTotalStitches = $("#inputTotalStitches");
  const inputNotes = $("#inputNotes");
  const inputAutoRound = $("#inputAutoRound");
  const inputHookSize = $("#inputHookSize");
  const inputYarn = $("#inputYarn");
  const inputGauge = $("#inputGauge");
  const inputMeasurements = $("#inputMeasurements");
  const inputTechniques = $("#inputTechniques");

  const roundPlanSummary = $("#roundPlanSummary");
  const inputRoundPlanRound = $("#inputRoundPlanRound");
  const inputRoundTarget = $("#inputRoundTarget");
  const inputRoundMode = $("#inputRoundMode");
  const inputRoundIncrease = $("#inputRoundIncrease");
  const inputRoundDecrease = $("#inputRoundDecrease");
  const inputRoundPattern = $("#inputRoundPattern");

  const btnUndo = $("#btnUndo");
  const btnAddMarker = $("#btnAddMarker");
  const btnClearMarkers = $("#btnClearMarkers");

  const roundValue = $("#roundValue");
  const stitchValue = $("#stitchValue");
  const stitchSub = $("#stitchSub");
  const progressFill = $("#progressFill");
  const progressText = $("#progressText");

  const btnRoundMinus = $("#btnRoundMinus");
  const btnRoundPlus = $("#btnRoundPlus");
  const btnStitchMinus = $("#btnStitchMinus");
  const btnStitchPlus = $("#btnStitchPlus");

  const markers = $("#markers");
  const markersEmpty = $("#markersEmpty");

  const history = $("#history");
  const historyEmpty = $("#historyEmpty");

  function ensureProjectShape(project) {
    project.projectSpecs ||= { hookSize: "", yarn: "", gauge: "", measurements: "", techniques: "" };
    project.roundPlan ||= [];
    if (!Array.isArray(project.roundPlan)) project.roundPlan = [];
    project.roundSummaries ||= [];
    if (!Array.isArray(project.roundSummaries)) project.roundSummaries = [];
    project.status ||= "pending";
    if (!Number.isInteger(project.planEditorRound) || project.planEditorRound < 1) {
      project.planEditorRound = typeof project.round === "number" && project.round > 0 ? project.round : 1;
    }
  }

  function getPlanEditorRound(project) {
    ensureProjectShape(project);
    return clampInt(project.planEditorRound || 1, 1, 999999);
  }

  function getRoundPlanEntry(project, round) {
    ensureProjectShape(project);
    return project.roundPlan.find((entry) => entry.round === round) || null;
  }

  function getRoundSummaryEntry(project, round) {
    ensureProjectShape(project);
    return project.roundSummaries.find((entry) => entry.round === round) || null;
  }

  function upsertRoundSummary(project, round, patch = {}) {
    ensureProjectShape(project);
    const idx = project.roundSummaries.findIndex((entry) => entry.round === round);
    const current = idx >= 0
      ? { ...project.roundSummaries[idx] }
      : { round, finalStitches: 0, pattern: "", updatedAt: Date.now() };

    if (Object.hasOwn(patch, "finalStitches")) current.finalStitches = patch.finalStitches;
    if (Object.hasOwn(patch, "pattern")) current.pattern = patch.pattern;
    current.updatedAt = Date.now();

    if (idx >= 0) project.roundSummaries[idx] = current;
    else project.roundSummaries.push(current);

    project.roundSummaries.sort((a, b) => a.round - b.round);
  }

  function getEffectiveTotal(project) {
    const entry = getRoundPlanEntry(project, project.round || 1);
    if (entry && typeof entry.targetStitches === "number" && entry.targetStitches > 0) return entry.targetStitches;
    return typeof project.totalStitches === "number" ? project.totalStitches : 0;
  }

  function getProjectProgressState(project) {
    if (project.status === "done") return "terminado";
    const started = (project.round || 1) > 1 || (project.stitch || 0) > 0 || (project.history?.length || 0) > 0;
    return started ? "empezado" : "por empezar";
  }

  function showHome() {
    state.activeProjectId = null;
    saveState();
    viewProject.hidden = true;
    viewHome.hidden = false;
    btnBack.hidden = true;
    btnResetProject.hidden = true;
    subtitle.textContent = "Proyectos";
    renderHome();
  }

  function showProject(id) {
    state.activeProjectId = id;
    saveState();
    viewHome.hidden = true;
    viewProject.hidden = false;
    btnBack.hidden = false;
    btnResetProject.hidden = false;
    renderProject();
  }

  function renderHome() {
    const list = state.projects.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    projectList.innerHTML = "";
    emptyProjects.hidden = list.length !== 0;

    for (const p of list) {
      ensureProjectShape(p);
      const el = document.createElement("div");
      el.className = "project-item";

      const left = document.createElement("div");
      left.className = "left";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = p.name || "Sin nombre";

      const meta = document.createElement("div");
      meta.className = "meta";
      const stateText = getProjectProgressState(p);
      const r = typeof p.round === "number" ? p.round : 1;
      const s = typeof p.stitch === "number" ? p.stitch : 0;
      meta.textContent = `${stateText.toUpperCase()} · Vuelta ${r} · Punto ${s}`;

      left.appendChild(name);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.className = "right";

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn primary";
      btnOpen.type = "button";
      btnOpen.textContent = stateText === "por empezar" ? "Empezar" : "Reanudar";
      btnOpen.addEventListener("click", () => showProject(p.id));

      const btnDel = document.createElement("button");
      btnDel.className = "btn danger";
      btnDel.type = "button";
      btnDel.textContent = "Eliminar";
      btnDel.addEventListener("click", () => {
        if (!confirm(`¿Eliminar "${p.name}"?`)) return;
        state.projects = state.projects.filter((x) => x.id !== p.id);
        if (state.activeProjectId === p.id) state.activeProjectId = null;
        saveState();
        renderHome();
      });

      right.appendChild(btnOpen);
      right.appendChild(btnDel);
      el.appendChild(left);
      el.appendChild(right);
      projectList.appendChild(el);
    }
  }

  function renderProject() {
    const p = getActiveProject();
    if (!p) return showHome();
    ensureProjectShape(p);

    subtitle.textContent = "Proyecto";
    projectTitle.textContent = p.name || "Proyecto";
    const stateText = getProjectProgressState(p);
    projectMeta.textContent = `Estado: ${stateText}${p.notes ? ` · ${p.notes}` : ""}`;
    btnToggleFinished.textContent = p.status === "done" ? "Marcar activo" : "Marcar terminado";

    const round = typeof p.round === "number" ? p.round : 1;
    const total = getEffectiveTotal(p);
    const stitch = typeof p.stitch === "number" ? p.stitch : 0;
    const roundEntry = getRoundPlanEntry(p, round);
    const planRound = getPlanEditorRound(p);
    const planEntry = getRoundPlanEntry(p, planRound);

    inputTotalStitches.value = String(typeof p.totalStitches === "number" ? p.totalStitches : 0);
    inputNotes.value = p.notes || "";
    inputAutoRound.checked = Boolean(p.autoRound);

    inputHookSize.value = p.projectSpecs.hookSize || "";
    inputYarn.value = p.projectSpecs.yarn || "";
    inputGauge.value = p.projectSpecs.gauge || "";
    inputMeasurements.value = p.projectSpecs.measurements || "";
    inputTechniques.value = p.projectSpecs.techniques || "";

    inputRoundPlanRound.value = String(planRound);
    inputRoundTarget.value = String(planEntry?.targetStitches || "");
    inputRoundMode.value = planEntry?.mode || "";
    inputRoundIncrease.value = planEntry?.increase || "";
    inputRoundDecrease.value = planEntry?.decrease || "";
    inputRoundPattern.value = planEntry?.pattern || "";

    const summaryParts = [];
    if (planEntry?.targetStitches) summaryParts.push(`${planEntry.targetStitches} puntos`);
    if (planEntry?.increase) summaryParts.push(`Aum: ${planEntry.increase}`);
    if (planEntry?.decrease) summaryParts.push(`Dism: ${planEntry.decrease}`);
    if (planEntry?.mode) summaryParts.push(`Modo: ${planEntry.mode}`);
    roundPlanSummary.textContent = summaryParts.length
      ? `Vuelta ${planRound}: ${summaryParts.join(" · ")}`
      : `Vuelta ${planRound}: sin plan guardado. Define puntos y patrón para avanzar con seguridad.`;

    roundValue.textContent = String(round);
    stitchValue.textContent = String(stitch);
    stitchSub.textContent = `${stitch} / ${total}`;

    const percent = total > 0 ? Math.round((stitch / total) * 100) : 0;
    progressFill.style.width = `${percent}%`;
    progressText.textContent = total > 0
      ? `${percent}% completado${roundEntry?.pattern ? ` · ${roundEntry.pattern}` : ""}`
      : "Define puntos por vuelta o un plan por vuelta para ver progreso";

    const summaryList = (p.roundSummaries || []).slice().sort((a, b) => a.round - b.round);
    roundSummaryList.innerHTML = "";
    roundSummaryMeta.textContent = summaryList.length
      ? `Resumen de ${summaryList.length} vuelta(s) registrada(s).`
      : "Todavía no hay vueltas guardadas. Se irán registrando automáticamente.";
    for (const row of summaryList) {
      const div = document.createElement("div");
      div.className = "history-item";
      const pattern = row.pattern ? row.pattern : "Sin patrón guardado";
      div.textContent = `Vuelta ${row.round}: ${row.finalStitches || 0} puntos finales · Patrón: ${pattern}`;
      roundSummaryList.appendChild(div);
    }

    const list = Array.isArray(p.markers) ? p.markers : [];
    markers.innerHTML = "";
    markersEmpty.hidden = list.length !== 0;

    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const row = document.createElement("div");
      row.className = "marker";

      const left = document.createElement("div");
      left.innerHTML = `<strong>V${m.round}</strong> · punto ${m.stitch}${m.note ? ` · <span class="muted">${escapeHtml(m.note)}</span>` : ""}`;

      const right = document.createElement("div");
      right.className = "row";

      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = "marcador";

      const btnX = document.createElement("button");
      btnX.className = "btn ghost";
      btnX.type = "button";
      btnX.textContent = "Quitar";
      btnX.addEventListener("click", () => {
        applyProjectUpdate((proj) => {
          const prev = structuredClone(proj.markers);
          proj.markers.splice(i, 1);
          pushUndo(proj, { type: "markers_restore", value: prev });
        }, "Marcador eliminado");
      });

      right.appendChild(pill);
      right.appendChild(btnX);
      row.appendChild(left);
      row.appendChild(right);
      markers.appendChild(row);
    }

    const h = Array.isArray(p.history) ? p.history : [];
    history.innerHTML = "";
    historyEmpty.hidden = h.length !== 0;
    for (const item of h) {
      const div = document.createElement("div");
      div.className = "history-item";
      div.textContent = item;
      history.appendChild(div);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function createProject(name) {
    const p = {
      id: uid(),
      name: name?.trim() || "Nuevo proyecto",
      round: 1,
      stitch: 0,
      totalStitches: 0,
      autoRound: true,
      markers: [],
      notes: "",
      status: "pending",
      projectSpecs: {
        hookSize: "",
        yarn: "",
        gauge: "",
        measurements: "",
        techniques: "",
      },
      roundPlan: [],
      roundSummaries: [],
      planEditorRound: 1,
      undoStack: [],
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.projects.push(p);
    saveState();
    renderHome();
  }

  function deleteActiveProject() {
    const p = getActiveProject();
    if (!p || !confirm(`¿Eliminar "${p.name}"?`)) return;
    state.projects = state.projects.filter((x) => x.id !== p.id);
    state.activeProjectId = null;
    saveState();
    showHome();
  }

  function resetActiveProject() {
    const p = getActiveProject();
    if (!p || !confirm("¿Reiniciar contadores, marcadores, historial y resumen de vueltas de este proyecto?")) return;

    applyProjectUpdate((proj) => {
      proj.round = 1;
      proj.stitch = 0;
      proj.markers = [];
      proj.history = [];
      proj.roundSummaries = [];
      proj.undoStack = [];
      proj.status = "pending";
    }, null);
  }

  function toggleFinished() {
    applyProjectUpdate((proj) => {
      pushUndo(proj, { type: "set", prev: { status: proj.status } });
      proj.status = proj.status === "done" ? "in_progress" : "done";
    }, "Estado del proyecto actualizado");
  }

  function undo() {
    const p = getActiveProject();
    if (!p || !Array.isArray(p.undoStack) || p.undoStack.length === 0) return;

    const patch = p.undoStack.pop();
    applyProjectUpdate((proj) => {
      if (patch.type === "set") {
        for (const [k, v] of Object.entries(patch.prev)) proj[k] = v;
      } else if (patch.type === "markers_restore") {
        proj.markers = patch.value || [];
      }
    }, "Deshacer");
    vibrate();
  }

  function saveCurrentRoundSnapshot(project) {
    const round = project.round || 1;
    const plan = getRoundPlanEntry(project, round);
    upsertRoundSummary(project, round, {
      finalStitches: project.stitch || 0,
      pattern: plan?.pattern || getRoundSummaryEntry(project, round)?.pattern || "",
    });
  }

  function bumpRound(delta) {
    applyProjectUpdate((proj) => {
      saveCurrentRoundSnapshot(proj);
      pushUndo(proj, { type: "set", prev: { round: proj.round, stitch: proj.stitch, roundSummaries: structuredClone(proj.roundSummaries) } });
      proj.round = clampInt((proj.round || 1) + delta, 1, 999999);
      proj.stitch = 0;
      proj.status = "in_progress";
      saveCurrentRoundSnapshot(proj);
    }, delta > 0 ? "Vuelta +1 (puntos a 0)" : "Vuelta -1 (puntos a 0)");
    vibrate();
  }

  function bumpStitch(delta) {
    const p = getActiveProject();
    if (!p) return;

    applyProjectUpdate((proj) => {
      const total = getEffectiveTotal(proj);
      pushUndo(proj, { type: "set", prev: { stitch: proj.stitch, round: proj.round, roundSummaries: structuredClone(proj.roundSummaries) } });

      if (delta > 0 && total > 0 && proj.autoRound) {
        const sum = (proj.stitch || 0) + delta;
        const addRounds = Math.floor((sum - 1) / total);
        const newStitch = ((sum - 1) % total) + 1;
        if (addRounds > 0) {
          saveCurrentRoundSnapshot(proj);
          proj.round = clampInt((proj.round || 1) + addRounds, 1, 999999);
        }
        proj.stitch = newStitch;
      } else {
        const max = total > 0 ? total : 999999;
        proj.stitch = clampInt((proj.stitch || 0) + delta, 0, max);
      }

      proj.status = "in_progress";
      saveCurrentRoundSnapshot(proj);
    }, delta > 0 ? "Punto +1" : "Punto -1");
    vibrate();
  }

  function setProjectSpec(field, value) {
    const next = String(value ?? "").trim();
    applyProjectUpdate((proj) => {
      ensureProjectShape(proj);
      pushUndo(proj, { type: "set", prev: { projectSpecs: structuredClone(proj.projectSpecs) } });
      proj.projectSpecs[field] = next;
    }, `Ficha actualizada: ${field}`);
  }

  function setPlanEditorRound(value) {
    const n = Number(value);
    const clean = Number.isFinite(n) ? clampInt(Math.floor(n), 1, 999999) : 1;

    applyProjectUpdate((proj) => {
      ensureProjectShape(proj);
      pushUndo(proj, { type: "set", prev: { planEditorRound: proj.planEditorRound } });
      proj.planEditorRound = clean;
    }, `Editor de plan: vuelta ${clean}`);
  }

  function setRoundPlanForEditorRound(patch) {
    const p = getActiveProject();
    if (!p) return;

    applyProjectUpdate((proj) => {
      ensureProjectShape(proj);
      const round = getPlanEditorRound(proj);
      const idx = proj.roundPlan.findIndex((entry) => entry.round === round);
      const prev = structuredClone(proj.roundPlan);
      const current = idx >= 0
        ? { ...proj.roundPlan[idx] }
        : { round, targetStitches: 0, mode: "", increase: "", decrease: "", pattern: "" };

      if (Object.hasOwn(patch, "targetStitches")) current.targetStitches = patch.targetStitches;
      if (Object.hasOwn(patch, "mode")) current.mode = patch.mode;
      if (Object.hasOwn(patch, "increase")) current.increase = patch.increase;
      if (Object.hasOwn(patch, "decrease")) current.decrease = patch.decrease;
      if (Object.hasOwn(patch, "pattern")) current.pattern = patch.pattern;

      const isEmpty = !current.targetStitches && !current.mode && !current.increase && !current.decrease && !current.pattern;
      if (isEmpty) {
        proj.roundPlan = proj.roundPlan.filter((entry) => entry.round !== round);
      } else if (idx >= 0) {
        proj.roundPlan[idx] = current;
      } else {
        proj.roundPlan.push(current);
        proj.roundPlan.sort((a, b) => a.round - b.round);
      }

      pushUndo(proj, { type: "set", prev: { roundPlan: prev } });
      const max = getEffectiveTotal(proj);
      if (max > 0) proj.stitch = clampInt(proj.stitch || 0, 0, max);
      if (Object.hasOwn(patch, "pattern")) upsertRoundSummary(proj, round, { pattern: current.pattern });
    }, "Plan de vuelta actualizado");
  }

  function setTotalStitches(value) {
    const n = Number(value);
    const clean = Number.isFinite(n) ? clampInt(Math.floor(n), 0, 999999) : 0;

    applyProjectUpdate((proj) => {
      pushUndo(proj, { type: "set", prev: { totalStitches: proj.totalStitches, stitch: proj.stitch } });
      proj.totalStitches = clean;
      if (clean > 0) proj.stitch = clampInt(proj.stitch || 0, 0, clean);
      saveCurrentRoundSnapshot(proj);
    }, `Total puntos por vuelta: ${clean}`);
  }

  function setNotes(value) {
    const next = String(value ?? "");
    applyProjectUpdate((proj) => {
      pushUndo(proj, { type: "set", prev: { notes: proj.notes } });
      proj.notes = next;
    }, "Notas actualizadas");
  }

  function setAutoRound(value) {
    applyProjectUpdate((proj) => {
      pushUndo(proj, { type: "set", prev: { autoRound: proj.autoRound } });
      proj.autoRound = Boolean(value);
    }, value ? "Auto-vuelta activada" : "Auto-vuelta desactivada");
  }

  function addMarker() {
    const p = getActiveProject();
    if (!p) return;
    const note = prompt("Nota del marcador (opcional):", "") ?? "";

    applyProjectUpdate((proj) => {
      const prev = structuredClone(proj.markers);
      proj.markers.unshift({
        round: proj.round || 1,
        stitch: proj.stitch || 0,
        note: note.trim(),
        at: Date.now(),
      });
      pushUndo(proj, { type: "markers_restore", value: prev });
    }, `Marcador añadido (V${p.round} · ${p.stitch})`);
  }

  function clearMarkers() {
    const p = getActiveProject();
    if (!p || !confirm("¿Borrar todos los marcadores?")) return;
    const prev = structuredClone(p.markers || []);
    applyProjectUpdate((proj) => {
      proj.markers = [];
      pushUndo(proj, { type: "markers_restore", value: prev });
    }, "Marcadores borrados");
  }

  formNewProject.addEventListener("submit", (e) => {
    e.preventDefault();
    createProject(projectName.value);
    projectName.value = "";
  });

  btnClearAll.addEventListener("click", () => {
    if (!confirm("¿Borrar TODOS los proyectos?")) return;
    state = structuredClone(defaultState);
    saveState();
    renderHome();
  });

  btnBack.addEventListener("click", showHome);
  btnDeleteProject.addEventListener("click", deleteActiveProject);
  btnResetProject.addEventListener("click", resetActiveProject);
  btnToggleFinished.addEventListener("click", toggleFinished);

  btnUndo.addEventListener("click", undo);
  btnAddMarker.addEventListener("click", addMarker);
  btnClearMarkers.addEventListener("click", clearMarkers);

  btnRoundMinus.addEventListener("click", () => bumpRound(-1));
  btnRoundPlus.addEventListener("click", () => bumpRound(+1));
  btnStitchMinus.addEventListener("click", () => bumpStitch(-1));
  btnStitchPlus.addEventListener("click", () => bumpStitch(+1));

  inputTotalStitches.addEventListener("change", (e) => setTotalStitches(e.target.value));
  inputNotes.addEventListener("change", (e) => setNotes(e.target.value));
  inputAutoRound.addEventListener("change", (e) => setAutoRound(e.target.checked));
  inputHookSize.addEventListener("change", (e) => setProjectSpec("hookSize", e.target.value));
  inputYarn.addEventListener("change", (e) => setProjectSpec("yarn", e.target.value));
  inputGauge.addEventListener("change", (e) => setProjectSpec("gauge", e.target.value));
  inputMeasurements.addEventListener("change", (e) => setProjectSpec("measurements", e.target.value));
  inputTechniques.addEventListener("change", (e) => setProjectSpec("techniques", e.target.value));

  inputRoundPlanRound.addEventListener("change", (e) => setPlanEditorRound(e.target.value));
  inputRoundTarget.addEventListener("change", (e) => {
    const n = Number(e.target.value);
    const target = Number.isFinite(n) ? clampInt(Math.floor(n), 0, 999999) : 0;
    setRoundPlanForEditorRound({ targetStitches: target });
  });
  inputRoundMode.addEventListener("change", (e) => setRoundPlanForEditorRound({ mode: String(e.target.value || "") }));
  inputRoundIncrease.addEventListener("change", (e) => setRoundPlanForEditorRound({ increase: String(e.target.value || "").trim() }));
  inputRoundDecrease.addEventListener("change", (e) => setRoundPlanForEditorRound({ decrease: String(e.target.value || "").trim() }));
  inputRoundPattern.addEventListener("change", (e) => setRoundPlanForEditorRound({ pattern: String(e.target.value || "").trim() }));

  window.addEventListener("keydown", (e) => {
    if (viewProject.hidden) return;
    if (e.key === "ArrowUp") { e.preventDefault(); bumpStitch(+1); }
    if (e.key === "ArrowDown") { e.preventDefault(); bumpStitch(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); bumpRound(+1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); bumpRound(-1); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  });

  let state = loadState();
  showHome();
})();
