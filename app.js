// app.js
(() => {
  const STORAGE_KEY = "crochet_counter_v01";

  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));

  const nowTime = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // ---------- State ----------
  const defaultState = {
    projects: [],
    activeProjectId: null,
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return structuredClone(defaultState);
      parsed.projects ||= [];
      if (!Array.isArray(parsed.projects)) parsed.projects = [];
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
    return state.projects.find(p => p.id === state.activeProjectId) || null;
  }

  // ---------- Undo system (per project) ----------
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

  function applyProjectUpdate(fn, undoPatch, historyText) {
    const project = getActiveProject();
    if (!project) return;

    if (undoPatch) pushUndo(project, undoPatch);
    fn(project);
    if (historyText) addHistory(project, historyText);

    saveState();
    renderProject();
  }

  // ---------- UI refs ----------
  const viewHome = $("#viewHome");
  const viewProject = $("#viewProject");

  const subtitle = $("#subtitle");
  const btnBack = $("#btnBack");
  const btnResetProject = $("#btnResetProject");

  // Home
  const formNewProject = $("#formNewProject");
  const projectName = $("#projectName");
  const projectList = $("#projectList");
  const emptyProjects = $("#emptyProjects");
  const btnClearAll = $("#btnClearAll");

  // Project
  const projectTitle = $("#projectTitle");
  const projectMeta = $("#projectMeta");
  const btnDeleteProject = $("#btnDeleteProject");

  const inputTotalStitches = $("#inputTotalStitches");
  const inputNotes = $("#inputNotes");

  const btnUndo = $("#btnUndo");
  const btnAddMarker = $("#btnAddMarker");
  const btnClearMarkers = $("#btnClearMarkers");

  const roundValue = $("#roundValue");
  const stitchValue = $("#stitchValue");
  const stitchSub = $("#stitchSub");

  const btnRoundMinus = $("#btnRoundMinus");
  const btnRoundPlus = $("#btnRoundPlus");
  const btnStitchMinus = $("#btnStitchMinus");
  const btnStitchPlus = $("#btnStitchPlus");

  const markers = $("#markers");
  const markersEmpty = $("#markersEmpty");

  const history = $("#history");
  const historyEmpty = $("#historyEmpty");

  // ---------- Navigation ----------
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

  // ---------- Render ----------
  function renderHome() {
    const list = state.projects.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    projectList.innerHTML = "";

    emptyProjects.hidden = list.length !== 0;

    for (const p of list) {
      const el = document.createElement("div");
      el.className = "project-item";

      const left = document.createElement("div");
      left.className = "left";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = p.name || "Sin nombre";

      const meta = document.createElement("div");
      meta.className = "meta";
      const total = (typeof p.totalStitches === "number") ? p.totalStitches : 0;
      const r = (typeof p.round === "number") ? p.round : 1;
      const s = (typeof p.stitch === "number") ? p.stitch : 0;
      meta.textContent = `Vuelta ${r} · Punto ${s}/${total}`;

      left.appendChild(name);
      left.appendChild(meta);

      const right = document.createElement("div");
      right.className = "right";

      const btnOpen = document.createElement("button");
      btnOpen.className = "btn primary";
      btnOpen.type = "button";
      btnOpen.textContent = "Abrir";
      btnOpen.addEventListener("click", () => showProject(p.id));

      const btnDel = document.createElement("button");
      btnDel.className = "btn danger";
      btnDel.type = "button";
      btnDel.textContent = "Eliminar";
      btnDel.addEventListener("click", () => {
        const ok = confirm(`¿Eliminar "${p.name}"?`);
        if (!ok) return;
        state.projects = state.projects.filter(x => x.id !== p.id);
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

    subtitle.textContent = "Proyecto";
    projectTitle.textContent = p.name || "Proyecto";
    projectMeta.textContent = p.notes ? `Notas: ${p.notes}` : "Sin notas (aquí puedes poner aguja, hilo, etc.)";

    const total = (typeof p.totalStitches === "number") ? p.totalStitches : 0;
    const round = (typeof p.round === "number") ? p.round : 1;
    const stitch = (typeof p.stitch === "number") ? p.stitch : 0;

    inputTotalStitches.value = String(total);
    inputNotes.value = p.notes || "";

    roundValue.textContent = String(round);
    stitchValue.textContent = String(stitch);
    stitchSub.textContent = `${stitch} / ${total}`;

    // markers
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
      right.style.display = "flex";
      right.style.gap = "10px";
      right.style.alignItems = "center";

      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = "marcador";

      const btnX = document.createElement("button");
      btnX.className = "btn ghost";
      btnX.type = "button";
      btnX.textContent = "Quitar";
      btnX.addEventListener("click", () => {
        applyProjectUpdate(
          (proj) => { proj.markers.splice(i, 1); proj.updatedAt = Date.now(); },
          { type: "markers_restore", value: structuredClone(list) },
          "Marcador eliminado"
        );
      });

      right.appendChild(pill);
      right.appendChild(btnX);

      row.appendChild(left);
      row.appendChild(right);
      markers.appendChild(row);
    }

    // history
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

  // ---------- Actions ----------
  function createProject(name) {
    const p = {
      id: uid(),
      name: name?.trim() || "Nuevo proyecto",
      round: 1,
      stitch: 0,
      totalStitches: 0,
      markers: [],
      notes: "",
      undoStack: [],
      history: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.projects.push(p);
    saveState();
    showProject(p.id);
  }

  function deleteActiveProject() {
    const p = getActiveProject();
    if (!p) return;
    const ok = confirm(`¿Eliminar "${p.name}"?`);
    if (!ok) return;
    state.projects = state.projects.filter(x => x.id !== p.id);
    state.activeProjectId = null;
    saveState();
    showHome();
  }

  function resetActiveProject() {
    const p = getActiveProject();
    if (!p) return;
    const ok = confirm("¿Reiniciar contadores, marcadores e historial de este proyecto?");
    if (!ok) return;

    applyProjectUpdate(
      (proj) => {
        proj.round = 1;
        proj.stitch = 0;
        proj.markers = [];
        proj.history = [];
        proj.undoStack = [];
        proj.updatedAt = Date.now();
      },
      null,
      null
    );
  }

  function undo() {
    const p = getActiveProject();
    if (!p || !Array.isArray(p.undoStack) || p.undoStack.length === 0) return;

    const patch = p.undoStack.pop();
    applyProjectUpdate(
      (proj) => {
        if (patch.type === "set") {
          for (const [k, v] of Object.entries(patch.prev)) proj[k] = v;
        } else if (patch.type === "markers_restore") {
          proj.markers = patch.value || [];
        }
        proj.updatedAt = Date.now();
      },
      null,
      "Deshacer"
    );
  }

  function bumpRound(delta) {
    const p = getActiveProject();
    if (!p) return;

    applyProjectUpdate(
      (proj) => {
        const prev = { round: proj.round, stitch: proj.stitch };
        const nextRound = clampInt((proj.round || 1) + delta, 1, 999999);
        proj.round = nextRound;

        // Si cambias de vuelta, lo normal es volver a 0 puntos (lo hago automático).
        proj.stitch = 0;

        proj.updatedAt = Date.now();
        pushUndo(proj, { type: "set", prev });
      },
      null,
      delta > 0 ? "Vuelta +1 (puntos a 0)" : "Vuelta -1 (puntos a 0)"
    );
  }

  function bumpStitch(delta) {
    const p = getActiveProject();
    if (!p) return;

    const total = typeof p.totalStitches === "number" ? p.totalStitches : 0;
    const max = total > 0 ? total : 999999;

    applyProjectUpdate(
      (proj) => {
        const prev = { stitch: proj.stitch };
        const next = clampInt((proj.stitch || 0) + delta, 0, max);
        proj.stitch = next;
        proj.updatedAt = Date.now();
        pushUndo(proj, { type: "set", prev });
      },
      null,
      delta > 0 ? "Punto +1" : "Punto -1"
    );
  }

  function setTotalStitches(value) {
    const p = getActiveProject();
    if (!p) return;
    const n = Number(value);
    const clean = Number.isFinite(n) ? clampInt(Math.floor(n), 0, 999999) : 0;

    applyProjectUpdate(
      (proj) => {
        const prev = { totalStitches: proj.totalStitches, stitch: proj.stitch };
        proj.totalStitches = clean;

        // Ajusta stitch si se sale
        if (clean > 0) proj.stitch = clampInt(proj.stitch || 0, 0, clean);
        proj.updatedAt = Date.now();
        pushUndo(proj, { type: "set", prev });
      },
      null,
      `Total puntos por vuelta: ${clean}`
    );
  }

  function setNotes(value) {
    const p = getActiveProject();
    if (!p) return;

    const next = String(value ?? "");

    applyProjectUpdate(
      (proj) => {
        const prev = { notes: proj.notes };
        proj.notes = next;
        proj.updatedAt = Date.now();
        pushUndo(proj, { type: "set", prev });
      },
      null,
      "Notas actualizadas"
    );
  }

  function addMarker() {
    const p = getActiveProject();
    if (!p) return;

    const note = prompt("Nota del marcador (opcional):", "") ?? "";
    applyProjectUpdate(
      (proj) => {
        const m = {
          round: proj.round || 1,
          stitch: proj.stitch || 0,
          note: note.trim(),
          at: Date.now(),
        };
        proj.markers ||= [];
        proj.markers.unshift(m);
        proj.updatedAt = Date.now();
        pushUndo(proj, { type: "markers_restore", value: structuredClone(proj.markers.slice(1)) }); // restore without new
      },
      null,
      `Marcador añadido (V${p.round} · ${p.stitch})`
    );
  }

  function clearMarkers() {
    const p = getActiveProject();
    if (!p) return;
    const ok = confirm("¿Borrar todos los marcadores?");
    if (!ok) return;

    const prev = structuredClone(p.markers || []);
    applyProjectUpdate(
      (proj) => { proj.markers = []; proj.updatedAt = Date.now(); },
      { type: "markers_restore", value: prev },
      "Marcadores borrados"
    );
  }

  // ---------- Events ----------
  formNewProject.addEventListener("submit", (e) => {
    e.preventDefault();
    createProject(projectName.value);
    projectName.value = "";
  });

  btnClearAll.addEventListener("click", () => {
    const ok = confirm("¿Borrar TODOS los proyectos?");
    if (!ok) return;
    state = structuredClone(defaultState);
    saveState();
    renderHome();
  });

  btnBack.addEventListener("click", showHome);
  btnDeleteProject.addEventListener("click", deleteActiveProject);
  btnResetProject.addEventListener("click", resetActiveProject);

  btnUndo.addEventListener("click", undo);
  btnAddMarker.addEventListener("click", addMarker);
  btnClearMarkers.addEventListener("click", clearMarkers);

  btnRoundMinus.addEventListener("click", () => bumpRound(-1));
  btnRoundPlus.addEventListener("click", () => bumpRound(+1));
  btnStitchMinus.addEventListener("click", () => bumpStitch(-1));
  btnStitchPlus.addEventListener("click", () => bumpStitch(+1));

  inputTotalStitches.addEventListener("change", (e) => setTotalStitches(e.target.value));
  inputNotes.addEventListener("change", (e) => setNotes(e.target.value));

  // Teclas rápidas (PC)
  window.addEventListener("keydown", (e) => {
    const inProject = !viewProject.hidden;
    if (!inProject) return;

    if (e.key === "ArrowUp") { e.preventDefault(); bumpStitch(+1); }
    if (e.key === "ArrowDown") { e.preventDefault(); bumpStitch(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); bumpRound(+1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); bumpRound(-1); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
  });

  // ---------- Boot ----------
  let state = loadState();

  // Si no hay proyectos, muestra Home, si hay y había uno activo, abre ese.
  if (state.activeProjectId && getActiveProject()) {
    showProject(state.activeProjectId);
  } else {
    showHome();
  }
})();
