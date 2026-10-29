(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () =>
    Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
  const now = () => new Date().toISOString();
  const fmtDate = (d, full = false) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(
      "ko-KR",
      full
        ? {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }
        : { month: "short", day: "numeric" },
    ).format(date);
  };
  const escapeHtml = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function safeExternalUrl(value) {
    try {
      let raw = String(value || "").trim();
      if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
      const url = new URL(raw);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  }
  const plain = (s) =>
    String(s || "")
      .replace(/[#*_`>\[\]()!-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const icons = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/>',
    inbox:
      '<path d="M4 4h16l1 11h-6l-2 3h-2l-2-3H3L4 4Z"/><path d="M3 15h6m6 0h6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
    layout:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
    tag: '<path d="M20 13 13 20 3 10V3h7l10 10Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    network:
      '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.5 8.6m6.9-8.6 4.5 8.6M7.5 18h9"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M19.07 4.93l-2.12 2.12M7.05 16.95l-2.12 2.12"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.2 4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    paperclip:
      '<path d="m8 12.5 6.4-6.4a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a5 5 0 0 1-7.1-7.1l8-8"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3.9l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.2-1.2"/>',
    external:
      '<path d="M14 3h7v7m0-7-10 10"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/>',
  };
  const ico = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  $$("[data-icon]").forEach((el) => (el.innerHTML = ico(el.dataset.icon)));
  const STORE = "folio_kb_v1";
  let db = null,
    saveTimer = null,
    currentView = "home",
    activeDocId = null,
    activeDocDraft = null,
    currentBoardId = null,
    currentTag = null,
    searchQuery = "",
    searchFilter = "all",
    pendingAttachDoc = null,
    editorDirty = false,
    saveStatus = "saved";
  let quickMemoObjectUrls = new Map(),
    quickMemoDraftFiles = [],
    homeQuickDraftFiles = [];
  let pendingBoardLinkMetadata = new Set(),
    boardLinkObserver = null,
    pendingBoardRerender = false;
  let boardTransform = { x: 0, y: 0, scale: 1 },
    boardDrag = null,
    selectedCard = null,
    selectedCardIds = [],
    connectMode = false,
    connectFrom = null,
    lastPointer = null,
    boardLineArrowDirection = "none",
    boardLineDashed = false,
    selectedEdgeId = null,
    suppressBoardCardClick = false,
    boardClickWasSelected = false,
    boardDropPosition = null,
    boardUndoStack = [],
    boardRedoStack = [],
    boardSketchMode = false,
    boardSketchTool = "pen",
    boardSketchWidth = 4,
    boardSketchColor = "#222222",
    spacePressed = false;
  const seed = () => {
    const t = now();
    const dummyBody = `국무위원은 국정에 관하여 대통령을 보좌하며, 국무회의의 구성원으로서 국정을 심의한다. 비상계엄이 선포된 때에는 법률이 정하는 바에 의하여 영장제도, 언론·출판·집회·결사의 자유, 정부나 법원의 권한에 관하여 특별한 조치를 할 수 있다. 모든 국민은 법률이 정하는 바에 의하여 국방의 의무를 진다.

대통령은 제3항과 제4항의 사유를 지체없이 공포하여야 한다. 대법원에 대법관을 둔다. 다만, 법률이 정하는 바에 의하여 대법관이 아닌 법관을 둘 수 있다. 대통령은 필요하다고 인정할 때에는 외교·국방·통일 기타 국가안위에 관한 중요정책을 국민투표에 붙일 수 있다. 대통령은 조약을 체결·비준하고, 외교사절을 신임·접수 또는 파견하며, 선전포고와 강화를 한다.

형사피의자 또는 형사피고인으로서 구금되었던 자가 법률이 정하는 불기소처분을 받거나 무죄판결을 받은 때에는 법률이 정하는 바에 의하여 국가에 정당한 보상을 청구할 수 있다. 국가는 사회보장·사회복지의 증진에 노력할 의무를 진다. 국가는 노인과 청소년의 복지향상을 위한 정책을 실시할 의무를 진다.

나는 헌법을 준수하고 국가를 보위하며 조국의 평화적 통일과 국민의 자유와 복리의 증진 및 민족문화의 창달에 노력하여 대통령으로서의 직책을 성실히 수행할 것을 국민 앞에 엄숙히 선서합니다. 대통령은 법률이 정하는 바에 의하여 사면·감형 또는 복권을 명할 수 있다. 국민경제의 발전을 위한 중요정책의 수립에 관하여 대통령의 자문에 응하기 위하여 국민경제자문회의를 둘 수 있다.

제1항의 해임건의는 국회재적의원 3분의 1 이상의 발의에 의하여 국회재적의원 과반수의 찬성이 있어야 한다. 대통령은 취임에 즈음하여 다음의 선서를 한다. 대한민국의 영토는 한반도와 그 부속도서로 한다. 각급 선거관리위원회는 선거인명부의 작성등 선거사무와 국민투표사무에 관하여 관계 행정기관에 필요한 지시를 할 수 있다.`;
    const docs = [
      {
        id: "seed-idea",
        kind: "document",
        title: "더미텍스트 1",
        body: dummyBody,
        tags: ["더미"],
        category: "샘플 문서",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "seed-research",
        kind: "document",
        title: "더미텍스트 2",
        body: dummyBody,
        tags: ["더미"],
        category: "샘플 문서",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "seed-note",
        kind: "document",
        title: "더미텍스트 3",
        body: dummyBody,
        tags: ["더미"],
        category: "샘플 문서",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "seed-link",
        kind: "document",
        title: "더미텍스트 4",
        body: dummyBody,
        tags: ["더미"],
        category: "샘플 문서",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      },
      {
        id: "seed-extra",
        kind: "document",
        title: "더미텍스트 5",
        body: dummyBody,
        tags: ["더미"],
        category: "샘플 문서",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      },
    ];
    return {
      version: 1,
      docs,
      boards: [
        {
          id: "seed-board",
          name: "아이디어 맵",
          cards: [
            { id: "bc-a", targetId: "seed-idea", x: 310, y: 250 },
            { id: "bc-b", targetId: "seed-research", x: 650, y: 375 },
            { id: "bc-c", targetId: "seed-note", x: 995, y: 220 },
          ],
          edges: [
            { id: "be-1", from: "bc-a", to: "bc-b" },
            { id: "be-2", from: "bc-b", to: "bc-c" },
          ],
          updatedAt: t,
        },
      ],
      links: [
        {
          id: "ln-1",
          from: "seed-idea",
          to: "seed-research",
          context: "관련 참고",
        },
      ],
      categories: ["에세이", "작업 노트"],
      updatedAt: t,
    };
  };
  let state;
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(STORE, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("app")) db.createObjectStore("app");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function dbGet() {
    return new Promise((resolve, reject) => {
      if (!db) {
        resolve(null);
        return;
      }
      const tx = db.transaction("app", "readonly");
      const r = tx.objectStore("app").get("state");
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  function dbPut(value) {
    return new Promise((resolve, reject) => {
      if (!db) {
        try {
          localStorage.setItem(STORE, JSON.stringify(value));
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }
      const tx = db.transaction("app", "readwrite");
      tx.objectStore("app").put(value, "state");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  function persist(silent = false) {
    clearTimeout(saveTimer);
    saveStatus = "saving";
    if (currentView === "editor") updateSaveIndicator();
    saveTimer = setTimeout(async () => {
      try {
        state.updatedAt = now();
        await dbPut(state);
        saveStatus = "saved";
        if (currentView === "editor") updateSaveIndicator();
        if (!silent) toast("변경 사항을 저장했어요.");
      } catch (e) {
        saveStatus = "error";
        if (currentView === "editor") updateSaveIndicator();
        toast("저장하지 못했어요. 저장 공간을 확인해 주세요.", true);
      }
    }, 230);
  }
  function updateSaveIndicator() {
    const el = $("#saveState");
    if (!el) return;
    const labels = {
      saving: "저장 중…",
      saved: "모든 변경 사항 저장됨",
      error: "저장 실패 · 다시 시도 필요",
    };
    el.innerHTML = `<i class="save-dot" style="background:${saveStatus === "error" ? "#c43a31" : saveStatus === "saved" ? "#777" : "#c9a346"}"></i>${labels[saveStatus] || labels.saved}`;
  }
  function toast(msg, error = false) {
    const node = document.createElement("div");
    node.className = "toast" + (error ? " error" : "");
    node.textContent = msg;
    $("#toastWrap").append(node);
    setTimeout(() => node.remove(), 3000);
  }
  function getDoc(id) {
    return (
      state.docs.find((d) => d.id === id) ||
      (activeDocDraft?.id === id ? activeDocDraft : undefined)
    );
  }
  function hasDocumentPayload(d) {
    return !!(
      String(d?.title || "").trim() ||
      String(d?.body || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .trim() ||
      (d?.attachments || []).length
    );
  }
  function finishActiveDocumentDraft() {
    if (!activeDocDraft) return;
    const draft = activeDocDraft;
    activeDocDraft = null;
    if (hasDocumentPayload(draft)) {
      state.docs.unshift(draft);
      persist(true);
    }
  }
  function getBoard(id) {
    return state.boards.find((b) => b.id === id);
  }
  const BOARD_DRAWING_ID = "__board_drawing__",
    SKETCH_STROKE_PREFIX = "__sketch_stroke__:";
  function boardSketchBounds(canvas) {
    const ctx = canvas.getContext("2d"),
      { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    let left = width,
      top = height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    return right < left
      ? null
      : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
  }
  function updateBoardSelectionStyles() {
    const world = $("#boardWorld");
    if (!world) return;
    $$("[data-card]", world).forEach((el) =>
      el.classList.toggle(
        "selected",
        selectedCardIds.includes(el.dataset.card),
      ),
    );
    $$("[data-sketch-stroke]", world).forEach((el) =>
      el.classList.toggle(
        "selected",
        selectedCardIds.includes(
          SKETCH_STROKE_PREFIX + el.dataset.sketchStroke,
        ),
      ),
    );
    const board = getBoard(currentBoardId),
      bounds = board?.drawingBounds;
    let outline = $("#boardDrawingSelection", world);
    if (selectedCardIds.includes(BOARD_DRAWING_ID) && bounds) {
      if (!outline) {
        outline = document.createElement("div");
        outline.id = "boardDrawingSelection";
        outline.style.cssText =
          "position:absolute;pointer-events:none;border:1px dashed #171717;background:#17171708;z-index:2";
        world.append(outline);
      }
      outline.style.left = bounds.x + "px";
      outline.style.top = bounds.y + "px";
      outline.style.width = bounds.width + "px";
      outline.style.height = bounds.height + "px";
    } else outline?.remove();
  }
  function updateSelectedBoardUi() {
    const button = $('[data-action="delete-selected-card"]');
    if (button) button.disabled = selectedCardIds.length === 0;
  }
  function boardHistorySnapshot(b) {
    return structuredClone({
      cards: b.cards || [],
      edges: b.edges || [],
      drawingData: b.drawingData || "",
      drawingBounds: b.drawingBounds || null,
      strokes: b.strokes || [],
      boardIds: state.boards.map((x) => x.id),
    });
  }
  function saveBoardHistory() {
    const b = getBoard(currentBoardId);
    if (!b) return;
    boardUndoStack.push(boardHistorySnapshot(b));
    if (boardUndoStack.length > 60) boardUndoStack.shift();
    boardRedoStack = [];
  }
  function restoreBoardHistory(from, to) {
    const b = getBoard(currentBoardId);
    if (!b || !from.length) return;
    to.push(boardHistorySnapshot(b));
    const saved = from.pop(),
      prior =
        typeof saved === "string" ? JSON.parse(saved) : structuredClone(saved);
    if (prior.boardIds)
      state.boards = state.boards.filter((x) => prior.boardIds.includes(x.id));
    b.cards = prior.cards;
    b.edges = prior.edges;
    b.drawingData = prior.drawingData || "";
    b.drawingBounds = prior.drawingBounds || null;
    b.strokes = prior.strokes || [];
    b.updatedAt = now();
    persist(true);
    render();
  }
  function undoBoard() {
    restoreBoardHistory(boardUndoStack, boardRedoStack);
  }
  function redoBoard() {
    restoreBoardHistory(boardRedoStack, boardUndoStack);
  }
  function notes() {
    return state.docs.filter((d) => d.kind === "note");
  }
  function documents() {
    return state.docs.filter((d) => d.kind === "document");
  }
  function tagsFor(d) {
    return Array.isArray(d.tags) ? d.tags : [];
  }
  function tagCounts() {
    const m = {};
    state.docs.forEach((d) =>
      tagsFor(d).forEach((t) => (m[t] = (m[t] || 0) + 1)),
    );
    return m;
  }
  function setView(view) {
    if (["board", "boards"].includes(currentView)) saveBoardViewport();
    if (currentView === "editor" && activeDocDraft?.id === activeDocId)
      finishActiveDocumentDraft();
    if (!["board", "boards"].includes(view)) {
      boardDocumentPreviewId = null;
      boardDocumentPickerKind = null;
      boardDocumentWindowPosition = null;
    }
    currentView = view;
    if (!["editor", "board"].includes(view)) {
      activeDocId = null;
      if (view === "boards" && !currentBoardId && state?.boards?.length)
        currentBoardId = getBoard(state.lastBoardId)
          ? state.lastBoardId
          : state.boards[0].id;
      if (view !== "boards") currentBoardId = null;
    }
    if (view === "boards" && currentBoardId)
      boardTransform = boardViewportFor(currentBoardId);
    $$(".nav-btn[data-view]").forEach((b) =>
      b.classList.toggle(
        "active",
        b.dataset.view === view ||
          (view === "editor" &&
            b.dataset.view ===
              (getDoc(activeDocId)?.kind === "note" ? "inbox" : "documents")) ||
          (view === "board" && b.dataset.view === "boards"),
      ),
    );
    closeMobileMenu();
    render();
    window.scrollTo(0, 0);
  }
  function updateCounts() {
    $("#inboxCount").textContent = notes().length;
    $("#docCount").textContent = documents().length;
  }
  function heading(eyebrow, title, desc = "", actions = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ""}</div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
  }
  function fileIcon(kind) {
    return `<div class="file-icon">${ico(kind === "note" ? "inbox" : kind === "url" ? "link" : kind === "image" ? "file" : "file")}</div>`;
  }
  function renderTagList(tags) {
    return tags.length
      ? `<div class="tag-list">${tags
          .slice(0, 4)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join(
            "",
          )}${tags.length > 4 ? `<span class="tag">+${tags.length - 4}</span>` : ""}</div>`
      : "";
  }
  function docRow(d) {
    const title = d.title || plain(d.body).slice(0, 42) || "제목 없는 메모";
    return `<div class="doc-row" data-open-doc="${d.id}">${fileIcon(d.kind)}<div class="row-copy"><div class="row-title">${escapeHtml(title)}</div><div class="row-snippet">${escapeHtml(plain(d.body).slice(0, 88) || "아직 내용이 없습니다.")}</div>${renderTagList(tagsFor(d))}</div><div class="row-meta">${fmtDate(d.updatedAt)}</div></div>`;
  }
  function renderGlobalSearchResults(query) {
    const panel = $("#globalSearchResults");
    if (!panel) return;
    const q = (query || "").trim().toLocaleLowerCase();
    if (!q) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    const matches = state.docs.filter((d) =>
      `${d.title || ""} ${plain(d.body)} ${tagsFor(d).join(" ")} ${d.category || ""} ${(d.attachments || []).map((a) => a.name || "").join(" ")}`
        .toLocaleLowerCase()
        .includes(q),
    );
    const group = (kind, label) => {
      const items = matches.filter((d) => d.kind === kind).slice(0, 6);
      return items.length
        ? `<section class="global-search-group"><div class="global-search-heading">${label}</div>${items.map((d) => `<button type="button" class="global-search-result" data-open-doc="${escapeHtml(d.id)}"><span class="global-search-title">${escapeHtml(d.title || plain(d.body).slice(0, 48) || "제목 없는 기록")}</span><span class="global-search-snippet">${escapeHtml(plain(d.body).slice(0, 72) || "내용 없음")}</span><span class="global-search-meta">${escapeHtml([d.category, ...tagsFor(d).map((t) => "# " + t)].filter(Boolean).join(" · "))}</span></button>`).join("")}</section>`
        : "";
    };
    const content =
      group("note", "Quick Memo") + group("document", "Documents");
    panel.innerHTML =
      content || '<div class="global-search-empty">검색 결과가 없습니다.</div>';
    panel.hidden = false;
  }
  function miniBoardMarkup() {
    return `<div class="mini-board-canvas"><div class="mini-note">메인 아이디어<i></i><i style="width:45%"></i></div><div class="mini-note">참고 자료<i></i><i style="width:60%"></i></div><div class="mini-note">다음 단계<i></i><i style="width:40%"></i></div></div>`;
  }
  function renderHome() {
    const recent = [...state.docs]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);
    const board = state.boards[0];
    return `<div class="welcome"><div><div class="eyebrow">A LITTLE SPACE TO THINK</div><button class="btn primary" data-action="create-document"><span class="ico">${ico("plus")}</span>새 문서 작성</button></div><div class="welcome-art"><span>UNTIT</span></div></div>

<div class="home-grid"><div><div class="section-head"><h2>최근 기록</h2><button class="text-link" data-view="recent">모두 보기 ${ico("arrow")}</button></div><div class="panel"><div class="panel-head"><div><h3>Recently updated</h3><p>최근에 손댄 기록부터 이어서 작업하세요.</p></div><span class="status-pill"><i></i> Live locally</span></div><div class="recent-list">${recent.length ? recent.map(docRow).join("") : `<div class="empty"><h3>아직 기록이 없어요</h3><p>첫 번째 생각을 가볍게 남겨보세요.</p></div>`}</div></div>
</div><div><div class="section-head"><h2>생각을 펼쳐보기</h2></div><div class="panel mini-board" data-open-board="${board?.id || ""}">${miniBoardMarkup()}<div class="board-mini-meta"><b>${escapeHtml(board?.name || "새로운 보드")}</b><span>${board?.cards.length || 0} cards · 열기 ↗</span></div></div></div></div>`;
  }
  function renderLibrary(
    kind = "all",
    title = "Documents",
    desc = "기록을 찾고, 다시 읽고, 새로운 연결을 만들어보세요.",
  ) {
    const source =
      currentView === "inbox"
        ? notes()
        : currentView === "documents"
          ? documents()
          : currentView === "recent"
            ? [...state.docs].sort(
                (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
              )
            : state.docs;
    let list = source.filter((d) => {
      if (
        searchQuery &&
        !`${d.title} ${d.body} ${tagsFor(d).join(" ")} ${d.category || ""} ${(d.attachments || []).map((a) => a.name + " " + a.url).join(" ")}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
        return false;
      if (
        currentView !== "documents" &&
        searchFilter === "note" &&
        d.kind !== "note"
      )
        return false;
      if (
        currentView !== "documents" &&
        searchFilter === "document" &&
        d.kind !== "document"
      )
        return false;
      if (currentTag) {
        if (currentTag.startsWith("category:")) {
          if ((d.category || "") !== currentTag.slice(9)) return false;
        } else if (!tagsFor(d).includes(currentTag)) return false;
      }
      return true;
    });
    const label =
      currentView === "inbox"
        ? "QUICK CAPTURE"
        : currentView === "recent"
          ? "ACTIVITY"
          : "YOUR LIBRARY";
    return `${heading(label, title, desc, `<button class="btn" data-action="create-document">+ 새 문서</button>`)}<div class="filterbar"><input class="filter-input" id="librarySearch" placeholder="기록 안에서 검색…" value="${escapeHtml(searchQuery)}">${currentView === "documents" || currentView === "inbox" ? "" : `<select class="filter-select" id="typeFilter"><option value="all" ${searchFilter === "all" ? "selected" : ""}>모든 유형</option><option value="note" ${searchFilter === "note" ? "selected" : ""}>Quick Memo</option><option value="document" ${searchFilter === "document" ? "selected" : ""}>문서</option></select>`}<select class="filter-select" id="categoryFilter"><option value="all">모든 카테고리</option>${state.categories.map((c) => `<option ${currentTag === `category:${c}` ? "selected" : ""} value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>${
      ["documents", "inbox"].includes(currentView)
        ? `<select class="filter-select" id="tagFilter"><option value="all">모든 태그</option>${Object.keys(
            tagCounts(),
          )
            .sort((a, b) => a.localeCompare(b, "ko"))
            .map(
              (t) =>
                `<option value="${escapeHtml(t)}" ${currentTag === t ? "selected" : ""}># ${escapeHtml(t)}</option>`,
            )
            .join("")}</select>`
        : ""
    }${currentTag && !currentTag.startsWith("category:") ? `<button class="btn small" data-action="clear-library-filter"># ${escapeHtml(currentTag)} ×</button>` : ""}<span style="font-size:10px;color:#aaa;margin-left:auto">${list.length} items</span></div><div class="library-list ${["documents", "inbox"].includes(currentView) ? "classified" : ""}"><div class="list-header"><span>Title</span>${["documents", "inbox"].includes(currentView) ? "<span>태그 / 카테고리</span>" : "<span>Type</span><span>Category</span>"}<span style="text-align:right">Updated</span></div>${list.length ? list.map((d) => `<div class="library-item" data-open-doc="${d.id}"><div class="item-main">${fileIcon(d.kind)}<div class="row-copy"><div class="row-title">${escapeHtml(d.title || plain(d.body).slice(0, 42) || "제목 없는 메모")}</div><div class="row-snippet">${escapeHtml(plain(d.body).slice(0, 78) || "내용 없음")}</div></div></div>${["documents", "inbox"].includes(currentView) ? `<span class="item-category"><strong>${escapeHtml(d.category || "미분류")}</strong>${renderTagList(tagsFor(d))}</span>` : `<span class="kind-pill">${d.kind === "note" ? "Quick Memo" : "Document"}</span><span class="item-category">${escapeHtml(d.category || "미분류")} ${renderTagList(tagsFor(d))}</span>`}<span class="item-date">${fmtDate(d.updatedAt)}</span></div>`).join("") : `<div class="empty"><div class="empty-mark">${ico("search")}</div><h3>${searchQuery || currentTag ? "검색 결과가 없어요" : "기록이 비어 있어요"}</h3><p>${searchQuery || currentTag ? "다른 검색어를 입력하거나 필터를 해제해 보세요." : "생각을 메모하거나 새 문서를 만들어 보세요."}</p><button class="btn" data-action="quick-note">첫 메모 남기기</button></div>`}</div>`;
  }
  let editorSavedRange = null,
    editorActiveBlock = null,
    editorBlockDrag = null,
    editorImageResizeHandles = [],
    editorSelectedImage = null,
    editorImageResizeDrag = null;
  const EDITOR_BLOCK_TYPES = [
    "paragraph",
    "h1",
    "h2",
    "h3",
    "bullet",
    "numbered",
    "checklist",
    "quote",
    "code",
    "divider",
  ];
  function editorId() {
    return uid();
  }
  function editorInlineHtml(text) {
    let html = escapeHtml(text).replace(/\n/g, "<br>");
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener" target="_blank">$1</a>',
    );
    html = html
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~~([^~]+)~~/g, "<s>$1</s>");
    return html;
  }
  function parseLegacyEditorBlocks(body) {
    const lines = String(body || "")
        .replace(/\r/g, "")
        .split("\n"),
      out = [];
    let i = 0;
    const add = (type, text) =>
      out.push({
        id: editorId(),
        type,
        html: type === "divider" ? "<hr>" : editorInlineHtml(text),
        checked: false,
      });
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        if (!out.length || out[out.length - 1].type !== "paragraph")
          add("paragraph", "");
        i++;
        continue;
      }
      if (/^```/.test(line)) {
        const code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i]))
          code.push(lines[i++]);
        if (i < lines.length) i++;
        add("code", code.join("\n"));
        continue;
      }
      if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
        add("divider", "");
        i++;
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        add("h" + heading[1].length, heading[2]);
        i++;
        continue;
      }
      const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
      if (bullet) {
        add("bullet", bullet[1]);
        i++;
        continue;
      }
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (numbered) {
        add("numbered", numbered[1]);
        i++;
        continue;
      }
      const quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        const q = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*>\s?(.*)$/);
          if (!m) break;
          q.push(m[1]);
          i++;
        }
        add("quote", q.join("\n"));
        continue;
      }
      const para = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,3})\s/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+[.)]\s+/.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) &&
        !/^```/.test(lines[i]) &&
        !/^\s*([-*_])\1\1+\s*$/.test(lines[i])
      )
        para.push(lines[i++]);
      add("paragraph", para.join("\n"));
    }
    return out.length
      ? out
      : [{ id: editorId(), type: "paragraph", html: "", checked: false }];
  }
  function editorSanitizeHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const allowed = new Set([
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "S",
      "DEL",
      "CODE",
      "BR",
      "A",
      "SPAN",
      "IMG",
    ]);
    template.content.querySelectorAll("*").forEach((el) => {
      if (!allowed.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        return;
      }
      [...el.attributes].forEach((attr) => {
        if (el.tagName === "A" && attr.name === "href") {
          try {
            const u = new URL(attr.value, location.href);
            if (
              !["http:", "https:", "mailto:"].includes(u.protocol) &&
              !/^data:(application|text|audio|video)\/[a-z0-9.+-]+;base64,/i.test(
                attr.value,
              )
            )
              el.removeAttribute("href");
          } catch (_) {
            el.removeAttribute("href");
          }
        } else if (el.tagName === "IMG" && attr.name === "src") {
          if (
            !/^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i.test(
              attr.value,
            )
          )
            el.removeAttribute("src");
        } else if (el.tagName === "IMG" && attr.name === "alt") {
        } else if (el.tagName === "IMG" && attr.name === "style") {
          const width = el.style.width,
            match = width.match(/^(\d+(?:\.\d+)?)px$/),
            px = match ? Math.max(80, Math.min(1400, Number(match[1]))) : null,
            move = el.style.transform.match(
              /^translate\(\s*(-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\s*\)$/,
            ),
            transform = move
              ? "transform:translate(" +
                Number(move[1]) +
                "px, " +
                Number(move[2]) +
                "px);"
              : "";
          el.setAttribute(
            "style",
            (px ? "width:" + px + "px;" : "") +
              "max-width:100%;height:auto;" +
              transform,
          );
        } else if (el.tagName === "A" && attr.name === "download") {
        } else if (el.tagName === "SPAN" && attr.name === "style") {
          const source = el.style,
            clean = [];
          if (source.fontFamily && /^[\w\s,'-]+$/.test(source.fontFamily))
            clean.push("font-family:" + source.fontFamily);
          if (
            source.fontSize &&
            /^(\d+(?:\.\d+)?)(px|pt|em|rem|%)$/.test(source.fontSize)
          )
            clean.push("font-size:" + source.fontSize);
          for (const prop of ["color", "backgroundColor"])
            if (
              source[prop] &&
              /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(source[prop])
            )
              clean.push(
                (prop === "backgroundColor" ? "background-color" : "color") +
                  ":" +
                  source[prop],
              );
          if (clean.length) el.setAttribute("style", clean.join(";"));
          else el.removeAttribute("style");
        } else if (
          attr.name !== "href" &&
          attr.name !== "rel" &&
          attr.name !== "target" &&
          !(el.tagName === "A" && attr.name === "download") &&
          !(el.tagName === "IMG" && ["src", "alt", "style"].includes(attr.name))
        )
          el.removeAttribute(attr.name);
      });
      if (el.tagName === "A") {
        el.setAttribute("rel", "noopener");
        if (!el.hasAttribute("download")) el.setAttribute("target", "_blank");
        else el.removeAttribute("target");
      }
    });
    return template.innerHTML;
  }
  function editorBlockData(d) {
    const migrated = !Array.isArray(d.blocks) || !d.blocks.length;
    if (migrated) {
      d.blocks = parseLegacyEditorBlocks(d.body || "");
      persist(true);
    }
    const seen = new Set();
    d.blocks = d.blocks.map((b) => {
      let id = b.id || editorId();
      if (seen.has(id)) id = editorId();
      seen.add(id);
      return {
        id,
        type: EDITOR_BLOCK_TYPES.includes(b.type) ? b.type : "paragraph",
        html: editorSanitizeHtml(b.html || ""),
        checked: !!b.checked,
      };
    });
    return d.blocks;
  }
  function editorBlockControlsHtml() {
    return (
      '<div class="editor-block-controls" contenteditable="false"><button type="button" class="editor-drag-handle" data-editor-drag-handle aria-label="블록 이동" title="드래그해 블록 이동">⠿</button><button type="button" class="editor-insert-toggle" data-editor-insert-toggle aria-label="아래에 블록 삽입" title="블록 추가">+</button><button type="button" data-block-backlink aria-label="이 블록의 백링크 만들기" title="다른 문서에서 이 블록을 참조">↗</button><div class="editor-insert-menu" contenteditable="false" hidden>' +
      [
        ["paragraph", "일반 텍스트"],
        ["h1", "제목 1"],
        ["h2", "제목 2"],
        ["h3", "제목 3"],
        ["bullet", "글머리 기호"],
        ["numbered", "번호 매기기"],
        ["checklist", "체크리스트"],
        ["quote", "인용문"],
        ["code", "코드 블록"],
        ["divider", "구분선"],
      ]
        .map(
          (x) =>
            '<button type="button" data-insert-block-type="' +
            x[0] +
            '">' +
            x[1] +
            "</button>",
        )
        .join("") +
      "</div></div>"
    );
  }
  function renderEditorBlocks(d) {
    return editorBlockData(d)
      .map((b) => {
        const refs = state.links
          .filter((l) => l.to === d.id && l.toBlockId === b.id)
          .map((l) => getDoc(l.from))
          .filter(Boolean);
        return (
          '<div class="editor-block" data-block-id="' +
          escapeHtml(b.id) +
          '" data-type="' +
          b.type +
          '">' +
          editorBlockControlsHtml() +
          (b.type === "checklist"
            ? '<input class="editor-check" type="checkbox" contenteditable="false" aria-label="체크리스트 항목 완료" ' +
              (b.checked ? "checked" : "") +
              ">"
            : "") +
          '<div class="editor-block-content" data-placeholder="' +
          (b.type === "paragraph" ? "생각을 펼쳐보세요…" : "") +
          '" spellcheck="true">' +
          (b.type === "divider"
            ? '<hr contenteditable="false">'
            : b.html || "<br>") +
          "</div>" +
          (refs.length
            ? '<div contenteditable="false" style="font:11px/1.5 inherit;color:#777;padding:3px 0 3px 8px;border-left:2px solid #ddd">' +
              refs
                .map(
                  (x) =>
                    '<button type="button" data-open-doc="' +
                    escapeHtml(x.id) +
                    '" data-open-block="' +
                    escapeHtml(b.id) +
                    '" style="border:0;background:none;color:#555;text-decoration:underline;cursor:pointer;padding:2px 5px">' +
                    escapeHtml(
                      x.title || plain(x.body).slice(0, 32) || "제목 없는 문서",
                    ) +
                    "</button>",
                )
                .join("") +
              "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");
  }
  function editorBlocksFromDOM() {
    return $$("#editorBlocks .editor-block").map((el) => ({
      id: el.dataset.blockId || editorId(),
      type: EDITOR_BLOCK_TYPES.includes(el.dataset.type)
        ? el.dataset.type
        : "paragraph",
      html: editorSanitizeHtml($(".editor-block-content", el)?.innerHTML || ""),
      checked: !!$(".editor-check", el)?.checked,
    }));
  }
  function editorBlockPlain(b) {
    if (b.type === "divider") return "---";
    const box = document.createElement("div");
    box.innerHTML = b.html || "";
    const read = (node) =>
      [...node.childNodes]
        .map((child) =>
          child.nodeType === 3
            ? child.nodeValue
            : child.nodeName === "BR"
              ? "\n"
              : read(child),
        )
        .join("");
    return read(box)
      .replace(/\u00a0/g, " ")
      .trimEnd();
  }
  function editorBodyFromBlocks(blocks) {
    return blocks
      .map((b) => {
        const text = editorBlockPlain(b);
        switch (b.type) {
          case "h1":
            return "# " + text;
          case "h2":
            return "## " + text;
          case "h3":
            return "### " + text;
          case "bullet":
            return "- " + text;
          case "numbered":
            return "1. " + text;
          case "checklist":
            return "- [" + (b.checked ? "x" : " ") + "] " + text;
          case "quote":
            return text
              .split("\n")
              .map((x) => "> " + x)
              .join("\n");
          case "code":
            return "```\n" + text + "\n```";
          default:
            return text;
        }
      })
      .join("\n");
  }
  const quickMemoPreviewCache = new Map(),
    quickMemoPreviewTimers = new WeakMap();
  let quickMemoPreviewSequence = 0;
  function quickMemoUrls(text) {
    const found = [];
    for (const match of String(text || "").matchAll(
      /https?:\/\/[^\s<>\"']+/gi,
    )) {
      const raw = match[0].replace(/[),.!?;:]+$/, "");
      const url = safeExternalUrl(raw);
      if (url && !found.includes(url)) found.push(url);
    }
    return found;
  }
  function renderQuickMemoLinkPreviews(host, text) {
    if (!host) return;
    const urls = quickMemoUrls(text);
    host.innerHTML = urls
      .map((url) => {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        return (
          '<a class=\"quick-memo-link-preview\" href=\"' +
          escapeHtml(url) +
          '\" target=\"_blank\" rel=\"noopener noreferrer\" data-memo-preview-url=\"' +
          escapeHtml(url) +
          '\"><div class=\"memo-preview-image\">미리보기 불러오는 중…</div><div class=\"memo-preview-copy\"><div class=\"memo-preview-domain\">' +
          escapeHtml(domain) +
          '</div><div class=\"memo-preview-title\">' +
          escapeHtml(url) +
          '</div><div class=\"memo-preview-description\"></div></div></a>'
        );
      })
      .join("");
    const sequence = ++quickMemoPreviewSequence;
    for (const url of urls) {
      const node = [...host.querySelectorAll("[data-memo-preview-url]")].find(
        (el) => el.dataset.memoPreviewUrl === url,
      );
      if (!node) continue;
      const apply = (meta) => {
        if (sequence !== quickMemoPreviewSequence || !node.isConnected) return;
        node.querySelector(".memo-preview-title").textContent =
          meta.title || url;
        node.querySelector(".memo-preview-description").textContent =
          meta.description || "";
        const imageBox = node.querySelector(".memo-preview-image");
        if (meta.image) {
          const img = document.createElement("img");
          img.src = meta.image;
          img.alt = "";
          img.referrerPolicy = "no-referrer";
          img.dataset.fallbackStage = "0";
          img.onerror = () => {
            const stage = Number(img.dataset.fallbackStage || 0);
            if (stage === 0) {
              img.dataset.fallbackStage = "1";
              img.src = linkPreviewProxyEndpoint(meta.image);
              return;
            }
            if (stage === 1) {
              img.dataset.fallbackStage = "2";
              img.src = linkPreviewImageEndpoint(url);
              return;
            }
            if (img.parentNode)
              img.replaceWith(
                Object.assign(document.createElement("div"), {
                  className: "memo-preview-image",
                  textContent: "미리보기 이미지를 불러오지 못했어요",
                }),
              );
          };
          imageBox.replaceWith(img);
        } else imageBox.textContent = "미리보기 이미지가 없어요";
      };
      const cached = quickMemoPreviewCache.get(url);
      if (cached) {
        apply(cached);
        continue;
      }
      if (!node.dataset.loading) {
        node.dataset.loading = "1";
        fetchBoardLinkMetadata(url)
          .then((meta) => {
            quickMemoPreviewCache.set(url, meta);
            apply(meta);
          })
          .catch(() => {
            if (sequence === quickMemoPreviewSequence && node.isConnected) {
              const box = node.querySelector(".memo-preview-image");
              if (box) box.textContent = "미리보기 정보를 불러오지 못했어요";
            }
          });
      }
    }
  }
  function quickMemoAttachmentUrl(a) {
    if (a.type === "url") return a.url || "";
    if (a.blob instanceof Blob) {
      if (!quickMemoObjectUrls.has(a.id))
        quickMemoObjectUrls.set(a.id, URL.createObjectURL(a.blob));
      return quickMemoObjectUrls.get(a.id);
    }
    return a.dataUrl || "";
  }
  function renderQuickMemoEditor(d) {
    const atts = d.attachments || [];
    return `<div class="editor-page-actions"><button class="btn" data-action="back-library">닫기</button><button class="btn primary" data-action="promote-note">문서로 전환 ${ico("arrow")}</button></div><div class="editor-layout"><div class="editor-main quick-memo-editor"><div class="editor-toolbar"><div><div class="eyebrow">Quick Memo</div><div class="save-state" id="saveState"><i class="save-dot"></i>모든 변경 사항 저장됨</div></div><div class="quick-memo-actions"><button class="btn small" data-action="attach-file">${ico("paperclip")} 파일 첨부</button></div></div><textarea id="editorBody" class="editor-body quick-memo-body" aria-label="Quick Memo 내용" placeholder="내용을 간단히 적어보세요…">${escapeHtml(d.body || "")}</textarea><div id="editorMemoLinkPreviews" class="quick-memo-link-previews"></div><div class="quick-memo-tags"><label for="editorTags">태그</label><input class="field" id="editorTags" value="${escapeHtml(tagsFor(d).join(", "))}" placeholder="아이디어, 리서치"><span class="form-help">쉼표로 구분해 입력하세요.</span></div>${
      atts.length
        ? `<div class="quick-memo-attachments"><div class="field-label">첨부 자료</div>${atts
            .map((a) => {
              const url = quickMemoAttachmentUrl(a),
                isImage = (a.mime || "").startsWith("image/"),
                isVideo = (a.mime || "").startsWith("video/");
              return `<div class="quick-memo-attachment">${isImage && url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(a.name)}">` : isVideo && url ? `<video controls preload="metadata" src="${escapeHtml(url)}" aria-label="${escapeHtml(a.name)}"></video>` : ""}<a href="${escapeHtml(url)}" ${a.type === "url" ? 'target="_blank" rel="noopener"' : 'download="' + escapeHtml(a.name) + '"'}>${escapeHtml(a.name)}</a><button type="button" data-remove-attachment="${escapeHtml(a.id)}" title="첨부 제거">×</button></div>`;
            })
            .join("")}</div>`
        : ""
    }<div class="quick-memo-footer"><span class="hint">내용과 태그는 자동으로 저장됩니다.</span></div></div></div>`;
  }
  function renderEditor() {
    const d = getDoc(activeDocId);
    if (!d) {
      currentView = "documents";
      return renderLibrary("all", "Documents");
    }
    if (d.kind === "note") return renderQuickMemoEditor(d);
    const title = d.title || "";
    const outgoing = state.links.filter((l) => l.from === d.id);
    const incoming = state.links.filter((l) => l.to === d.id);
    const refs = outgoing
      .map((l) => ({ link: l, doc: getDoc(l.to) }))
      .filter((x) => x.doc);
    const backs = incoming
      .map((l) => ({ link: l, doc: getDoc(l.from) }))
      .filter((x) => x.doc);
    const atts = d.attachments || [];
    return `<div class="editor-page-actions"><button class="btn" data-action="back-library">닫기</button><button class="btn primary" data-action="promote-note" ${d.kind === "document" ? "disabled" : ""}>문서로 전환 ${ico("arrow")}</button></div><div class="editor-layout"><div class="editor-main"><div class="editor-toolbar"><div class="save-state" id="saveState"><i class="save-dot"></i>모든 변경 사항 저장됨</div></div><textarea class="editor-title" id="editorTitle" placeholder="제목 없는 기록" rows="1" maxlength="240">${escapeHtml(title)}</textarea><div class="editor-meta"><span>${d.kind === "note" ? "Quick Memo" : "Document"}</span><span class="dotsep">•</span><span>생성 ${fmtDate(d.createdAt)}</span><span class="dotsep">•</span><span>${(d.body || "").length} characters</span></div><div class="formatbar" role="toolbar" aria-label="문서 서식"><select id="editorBlockType" class="filter-select" aria-label="블록 유형"><option value="paragraph">일반 텍스트</option><option value="h1">제목 1</option><option value="h2">제목 2</option><option value="h3">제목 3</option><option value="bullet">글머리 기호</option><option value="numbered">번호 매기기</option><option value="checklist">체크리스트</option><option value="quote">인용문</option><option value="code">코드 블록</option><option value="divider">구분선</option></select><select id="editorFontFamily" class="format-select" aria-label="글꼴" title="글꼴"><option value="">글꼴</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option><option value="'Times New Roman', serif">Times New Roman</option><option value="'Courier New', monospace">Courier New</option><option value="'Noto Sans KR', sans-serif">Noto Sans KR</option></select><select id="editorFontSize" class="format-select" aria-label="텍스트 크기" title="텍스트 크기"><option value="">크기</option><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="24px">24</option><option value="32px">32</option><option value="40px">40</option></select><label class="format-color" title="텍스트 색상">A<input id="editorTextColor" type="color" aria-label="텍스트 색상" value="#3c3c3c"></label><label class="format-color format-highlight" title="텍스트 배경색">▰<input id="editorTextBackground" type="color" aria-label="텍스트 배경색" value="#fff2a8"></label><button type="button" data-inline-format="bold" title="굵게 (Ctrl+B)"><b>B</b></button><button type="button" data-inline-format="italic" title="기울임 (Ctrl+I)"><i>I</i></button><button type="button" data-inline-format="underline" title="밑줄 (Ctrl+U)"><u>U</u></button><button type="button" data-action="insert-link" id="insertLinkButton" hidden>↗ 링크 삽입</button><button type="button" data-action="attach-file">📎 파일 첨부</button></div><div class="editor-body" id="editorBlocks" contenteditable="true" role="textbox" aria-multiline="true" aria-label="문서 블록" tabindex="0">${renderEditorBlocks(d)}</div>${
      atts.length
        ? `<div class="quick-memo-attachments document-attachments"><div class="field-label">Attachments</div>${atts
            .map((a) => {
              const url = quickMemoAttachmentUrl(a),
                name = escapeHtml(a.name || "Attachment"),
                image = (a.mime || "").startsWith("image/"),
                boxWidth = Math.min(
                  1400,
                  Math.max(180, Number(a.displayWidth) || 320),
                ),
                boxHeight = Math.min(
                  900,
                  Math.max(90, Number(a.displayHeight) || 220),
                );
              return `<div class="quick-memo-attachment document-attachment-item" data-document-attachment="${escapeHtml(a.id)}" style="width:${boxWidth}px;height:${boxHeight}px">${image && url ? `<img src="${escapeHtml(url)}" alt="${name}">` : ""}<a href="${escapeHtml(url)}" ${a.type === "url" ? 'target="_blank" rel="noopener"' : 'download="' + name + '"'}>${name}</a><button type="button" data-remove-attachment="${escapeHtml(a.id)}" title="Remove attachment">&times;</button><span class="document-attachment-resize" title="드래그하여 크기 조절" aria-label="첨부 파일 크기 조절"></span></div>`;
            })
            .join("")}</div>`
        : ""
    }</div></div></div>`;
  }
  function editorBlockForNode(node) {
    if (node?.nodeType === 3) node = node.parentElement;
    return node?.closest?.("#editorBlocks .editor-block") || null;
  }
  function editorCurrentBlock() {
    const sel = getSelection();
    return editorBlockForNode(sel?.anchorNode) || editorActiveBlock;
  }
  function editorSetActiveBlock(block) {
    $$("#editorBlocks .editor-block.is-active").forEach((x) =>
      x.classList.remove("is-active"),
    );
    if (block?.isConnected) block.classList.add("is-active");
    editorActiveBlock = block?.isConnected ? block : null;
  }
  function editorContent(block) {
    return $(".editor-block-content", block);
  }
  function editorSelectionIn(content) {
    const sel = getSelection();
    return !!(
      sel &&
      sel.rangeCount &&
      content?.contains(sel.anchorNode) &&
      content.contains(sel.focusNode)
    );
  }
  function saveEditorSelection() {
    const sel = getSelection();
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0);
      if ($("#editorBlocks")?.contains(r.commonAncestorContainer)) {
        editorSavedRange = r.cloneRange();
        editorSetActiveBlock(editorCurrentBlock());
      }
    }
  }
  function applyEditorStyleToSelection(property, value, fallbackCommand) {
    const root = $("#editorBlocks"),
      sel = getSelection();
    if (!root || !sel?.rangeCount) return false;
    const range = sel.getRangeAt(0);
    if (range.collapsed || !root.contains(range.commonAncestorContainer))
      return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest(".editor-block-content")) continue;
      try {
        if (!range.intersectsNode(node)) continue;
      } catch (_) {
        continue;
      }
      const start = node === range.startContainer ? range.startOffset : 0,
        end =
          node === range.endContainer ? range.endOffset : node.nodeValue.length;
      if (end > start) nodes.push({ node, start, end });
    }
    if (!nodes.length) return false;
    const spans = [];
    for (const item of nodes) {
      const original = item.node,
        part = item.start ? original.splitText(item.start) : original;
      if (item.end - item.start < part.nodeValue.length)
        part.splitText(item.end - item.start);
      const span = document.createElement("span");
      span.style[property] = value;
      part.parentNode.insertBefore(span, part);
      span.appendChild(part);
      spans.push(span);
    }
    const nextRange = document.createRange();
    nextRange.setStartBefore(spans[0]);
    nextRange.setEndAfter(spans[spans.length - 1]);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    editorSavedRange = nextRange.cloneRange();
    return true;
  }
  function normalizeEditorFontTags() {
    const root = $("#editorBlocks");
    if (!root) return;
    root.querySelectorAll("font").forEach((font) => {
      const span = document.createElement("span");
      if (font.getAttribute("face"))
        span.style.fontFamily = font.getAttribute("face");
      if (font.getAttribute("color"))
        span.style.color = font.getAttribute("color");
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }
  function restoreEditorSelection() {
    const sel = getSelection();
    if (
      editorSavedRange &&
      $("#editorBlocks")?.contains(editorSavedRange.commonAncestorContainer)
    ) {
      sel.removeAllRanges();
      sel.addRange(editorSavedRange);
    }
  }
  function focusEditorContent(content, atStart) {
    if (!content) return;
    $("#editorBlocks")?.focus({ preventScroll: true });
    const range = document.createRange(),
      sel = getSelection();
    range.selectNodeContents(content);
    range.collapse(!!atStart);
    sel.removeAllRanges();
    sel.addRange(range);
    editorSavedRange = range.cloneRange();
    editorSetActiveBlock(content.closest(".editor-block"));
  }
  function makeEditorBlock(type, html, checked) {
    const el = document.createElement("div");
    el.className = "editor-block";
    el.dataset.blockId = editorId();
    el.dataset.type = EDITOR_BLOCK_TYPES.includes(type) ? type : "paragraph";
    el.innerHTML = editorBlockControlsHtml();
    if (type === "checklist") {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "editor-check";
      box.setAttribute("aria-label", "체크리스트 항목 완료");
      box.setAttribute("contenteditable", "false");
      box.checked = !!checked;
      el.append(box);
    }
    const content = document.createElement("div");
    content.className = "editor-block-content";
    content.spellcheck = true;
    content.dataset.placeholder =
      type === "paragraph" ? "생각을 펼쳐보세요…" : "";
    content.innerHTML =
      type === "divider" ? '<hr contenteditable="false">' : html || "<br>";
    el.append(content);
    return el;
  }
  function editorTextOffset(root, node, offset) {
    const range = document.createRange();
    range.selectNodeContents(root);
    try {
      range.setEnd(node, offset);
    } catch (_) {
      return 0;
    }
    return range.toString().length;
  }
  function editorPointAtTextOffset(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (remaining <= node.length) return { node, offset: remaining };
      remaining -= node.length;
    }
    return { node: root, offset: root.childNodes.length };
  }
  function setEditorBlockType(block, type) {
    if (!block || !EDITOR_BLOCK_TYPES.includes(type)) return;
    const old = editorContent(block),
      selection = getSelection(),
      saved = selection?.rangeCount
        ? selection.getRangeAt(0).cloneRange()
        : null,
      wasInside = !!(
        saved &&
        old?.contains(saved.startContainer) &&
        old.contains(saved.endContainer)
      ),
      start = wasInside
        ? editorTextOffset(old, saved.startContainer, saved.startOffset)
        : 0,
      end = wasInside
        ? editorTextOffset(old, saved.endContainer, saved.endOffset)
        : start,
      text = old?.innerHTML || "",
      checked = $(".editor-check", block)?.checked,
      id = block.dataset.blockId || editorId(),
      fresh = makeEditorBlock(type, text, checked);
    fresh.dataset.blockId = id;
    block.replaceWith(fresh);
    editorActiveBlock = fresh;
    const content = editorContent(fresh);
    if (wasInside) {
      const a = editorPointAtTextOffset(content, start),
        b = editorPointAtTextOffset(content, end),
        range = document.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      selection.removeAllRanges();
      selection.addRange(range);
      editorSavedRange = range.cloneRange();
    } else focusEditorContent(content, false);
    updateDocFromEditor();
  }
  function insertEditorBlockAfter(block, type, html, checked) {
    const next = makeEditorBlock(type, html, checked);
    block.after(next);
    editorActiveBlock = next;
    return next;
  }
  function showSlashMenu(block) {
    document.querySelectorAll(".editor-slash-menu").forEach((x) => x.remove());
    document
      .querySelectorAll(".editor-insert-menu")
      .forEach((x) => (x.hidden = true));
    const menu = document.createElement("div");
    menu.className = "editor-slash-menu";
    menu.setAttribute("contenteditable", "false");
    const choices = [
      ["paragraph", "일반 텍스트"],
      ["h1", "제목 1"],
      ["h2", "제목 2"],
      ["h3", "제목 3"],
      ["bullet", "글머리 기호 목록"],
      ["numbered", "번호 매기기 목록"],
      ["checklist", "체크리스트"],
      ["quote", "인용문"],
      ["code", "코드 블록"],
      ["divider", "구분선"],
    ];
    menu.innerHTML = choices
      .map(
        (x, i) =>
          '<button type="button" data-slash-type="' +
          x[0] +
          '" ' +
          (i === 0 ? 'aria-selected="true"' : "") +
          ">" +
          x[1] +
          "</button>",
      )
      .join("");
    block.append(menu);
    menu.addEventListener("mousedown", (e) => e.preventDefault());
    menu.addEventListener("click", (e) => {
      const button = e.target.closest("[data-slash-type]");
      if (button) chooseSlashType(block, button.dataset.slashType);
    });
  }
  function chooseSlashType(block, type) {
    const content = editorContent(block);
    if (content) content.innerHTML = "";
    document.querySelectorAll(".editor-slash-menu").forEach((x) => x.remove());
    setEditorBlockType(block, type);
  }
  function editorDeleteRange(range) {
    const root = $("#editorBlocks"),
      startBlock = editorBlockForNode(range.startContainer),
      endBlock = editorBlockForNode(range.endContainer);
    if (!startBlock || !endBlock) return startBlock;
    if (startBlock === endBlock) {
      range.deleteContents();
      editorSavedRange = range.cloneRange();
      editorSetActiveBlock(startBlock);
      return startBlock;
    }
    const startContent = editorContent(startBlock),
      endContent = editorContent(endBlock),
      suffixRange = document.createRange();
    suffixRange.setStart(range.endContainer, range.endOffset);
    suffixRange.setEnd(endContent, endContent.childNodes.length);
    const suffix = suffixRange.cloneContents(),
      all = [...root.querySelectorAll(".editor-block")],
      startIndex = all.indexOf(startBlock),
      endIndex = all.indexOf(endBlock);
    range.deleteContents();
    all.slice(startIndex + 1, endIndex + 1).forEach((el) => el.remove());
    const last = suffix.lastChild;
    if (suffix.childNodes.length) range.insertNode(suffix);
    if (!startContent.hasChildNodes()) startContent.innerHTML = "<br>";
    const caret = document.createRange();
    if (last?.parentNode) caret.setStartAfter(last);
    else {
      caret.selectNodeContents(startContent);
      caret.collapse(false);
    }
    caret.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(caret);
    editorSavedRange = caret.cloneRange();
    editorSetActiveBlock(startBlock);
    return startBlock;
  }
  function editorBackspace(block, content) {
    const sel = getSelection();
    if (!sel?.rangeCount) return false;
    let range = sel.getRangeAt(0);
    if (!range.collapsed) {
      editorDeleteRange(range);
      updateDocFromEditor();
      return true;
    }
    if (!content.contains(range.startContainer)) return false;
    const before = range.cloneRange();
    before.selectNodeContents(content);
    before.setEnd(range.startContainer, range.startOffset);
    const beforeFragment = before.cloneContents();
    if (before.toString().length) return false;
    if (beforeFragment.querySelector("br")) {
      document.execCommand("delete", false);
      updateDocFromEditor();
      return true;
    }
    if (beforeFragment.childNodes.length) return false;
    const prev = block.previousElementSibling;
    if (!prev) {
      if (
        !content.textContent.trim() &&
        $("#editorBlocks .editor-block").length > 1
      ) {
        const next = block.nextElementSibling;
        block.remove();
        if (next) focusEditorContent(editorContent(next), true);
        updateDocFromEditor();
        return true;
      }
      return false;
    }
    const prevContent = editorContent(prev);
    if (block.dataset.type === "divider") {
      block.remove();
      focusEditorContent(editorContent(prev), false);
      updateDocFromEditor();
      return true;
    }
    if (prev.dataset.type === "divider") {
      prev.remove();
      focusEditorContent(content, true);
      editorActiveBlock = block;
      updateDocFromEditor();
      return true;
    }
    if (!prevContent.textContent && prevContent.querySelector("br"))
      prevContent.innerHTML = "";
    const joinRange = document.createRange();
    joinRange.selectNodeContents(prevContent);
    joinRange.collapse(false);
    const offset = prevContent.textContent.length;
    if (content.textContent.length) {
      const frag = document.createDocumentFragment();
      while (content.firstChild) frag.append(content.firstChild);
      if (frag.childNodes.length) joinRange.insertNode(frag);
    }
    block.remove();
    focusEditorContent(prevContent, false);
    const walker = document.createTreeWalker(prevContent, NodeFilter.SHOW_TEXT);
    let remaining = offset,
      last = null;
    while (walker.nextNode()) {
      last = walker.currentNode;
      if (remaining <= last.length) break;
      remaining -= last.length;
    }
    const caret = document.createRange();
    if (last) {
      caret.setStart(last, Math.min(remaining, last.length));
      caret.collapse(true);
      const current = getSelection();
      current.removeAllRanges();
      current.addRange(caret);
      editorSavedRange = caret.cloneRange();
    }
    updateDocFromEditor();
    return true;
  }
  function pasteEditorText(e, block, content) {
    const text = e.clipboardData?.getData("text/plain");
    if (text == null) return;
    e.preventDefault();
    const sel = getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const lines = text.replace(/\r/g, "").split("\n");
    const first = document.createTextNode(lines[0]);
    range.insertNode(first);
    if (lines.length === 1) {
      const caret = document.createRange();
      caret.setStartAfter(first);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
      editorSavedRange = caret.cloneRange();
      updateDocFromEditor();
      return;
    }
    const tail = range.cloneRange();
    tail.setStartAfter(first);
    tail.setEnd(content, content.childNodes.length);
    const suffix = tail.extractContents();
    let cursor = block;
    for (let i = 1; i < lines.length; i++) {
      const next = insertEditorBlockAfter(cursor, "paragraph", "");
      const target = editorContent(next);
      target.innerHTML = "";
      const node = document.createTextNode(lines[i]);
      target.append(node);
      if (i === lines.length - 1 && suffix.childNodes.length)
        target.append(suffix);
      if (i === lines.length - 1) {
        const caret = document.createRange();
        caret.setStartAfter(node);
        caret.collapse(true);
        sel.removeAllRanges();
        sel.addRange(caret);
        editorSavedRange = caret.cloneRange();
        editorActiveBlock = next;
      }
      cursor = next;
    }
    updateDocFromEditor();
  }

  function positionEditorImageResizeHandle() {
    const img = editorSelectedImage,
      handles = editorImageResizeHandles;
    if (!img?.isConnected || !$("#editorBlocks")?.contains(img)) {
      handles.forEach((h) => (h.hidden = true));
      editorSelectedImage = null;
      return;
    }
    const r = img.getBoundingClientRect(),
      size = 24,
      positions = {
        nw: [r.left - size / 2, r.top - size / 2],
        ne: [r.right - size / 2, r.top - size / 2],
        sw: [r.left - size / 2, r.bottom - size / 2],
        se: [r.right - size / 2, r.bottom - size / 2],
      };
    handles.forEach((h) => {
      const p = positions[h.dataset.corner];
      h.style.left = Math.max(0, Math.min(innerWidth - size, p[0])) + "px";
      h.style.top = Math.max(0, Math.min(innerHeight - size, p[1])) + "px";
      h.hidden = false;
    });
  }
  function ensureEditorImageResizeHandle() {
    if (editorImageResizeHandles.length) return editorImageResizeHandles;
    for (const corner of ["nw", "ne", "sw", "se"]) {
      const h = document.createElement("button");
      h.type = "button";
      h.className = "editor-image-resize-handle";
      h.dataset.corner = corner;
      h.title = "드래그하여 이미지 크기 조절";
      h.setAttribute("aria-label", "이미지 크기 조절 " + corner);
      h.hidden = true;
      document.body.append(h);
      h.addEventListener("pointerdown", (e) => {
        const img = editorSelectedImage;
        if (!img) return;
        e.preventDefault();
        e.stopPropagation();
        const r = img.getBoundingClientRect(),
          content = img.closest(".editor-block-content"),
          maxWidth = Math.max(80, Math.min(1400, content?.clientWidth || 1400)),
          ratio =
            img.naturalWidth && img.naturalHeight
              ? img.naturalHeight / img.naturalWidth
              : r.height / r.width || 1,
          transform = img.style.transform.match(
            /^translate\(\s*(-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\s*\)$/,
          );
        editorImageResizeDrag = {
          pointerId: e.pointerId,
          corner,
          startX: e.clientX,
          startY: e.clientY,
          startWidth: r.width,
          startHeight: r.height,
          maxWidth,
          ratio,
          baseX: transform ? Number(transform[1]) : 0,
          baseY: transform ? Number(transform[2]) : 0,
        };
        try {
          h.setPointerCapture(e.pointerId);
        } catch (_) {}
      });
      h.addEventListener("pointermove", (e) => {
        const d = editorImageResizeDrag,
          img = editorSelectedImage;
        if (!d || d.pointerId !== e.pointerId || !img) return;
        e.preventDefault();
        const signX = d.corner.endsWith("w") ? -1 : 1,
          signY = d.corner.startsWith("n") ? -1 : 1,
          dx = ((e.clientX - d.startX) * signX) / (d.startWidth / 2),
          dy = ((e.clientY - d.startY) * signY) / (d.startHeight / 2),
          factor = Math.max(0.1, 1 + (Math.abs(dx) >= Math.abs(dy) ? dx : dy)),
          width = Math.max(80, Math.min(d.maxWidth, d.startWidth * factor)),
          height = width * d.ratio;
        img.style.width = Math.round(width) + "px";
        img.style.height = "auto";
        img.style.transform =
          "translate(" +
          Math.round(d.baseX + (d.startWidth - width) / 2) +
          "px, 0px)";
        positionEditorImageResizeHandle();
      });
      const end = (e) => {
        if (
          !editorImageResizeDrag ||
          editorImageResizeDrag.pointerId !== e.pointerId
        )
          return;
        editorImageResizeDrag = null;
        if (editorSelectedImage?.isConnected) updateDocFromEditor();
        positionEditorImageResizeHandle();
      };
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
      window.addEventListener("scroll", positionEditorImageResizeHandle, true);
      window.addEventListener("resize", positionEditorImageResizeHandle);
      editorImageResizeHandles.push(h);
    }
    return editorImageResizeHandles;
  }
  function updateDocFromEditor() {
    const d = getDoc(activeDocId);
    if (!d) return;
    const title = $("#editorTitle"),
      root = $("#editorBlocks"),
      category = $("#editorCategory"),
      tags = $("#editorTags");
    if (title) d.title = title.value;
    if (root) {
      d.blocks = editorBlocksFromDOM();
      d.body = editorBodyFromBlocks(d.blocks);
    } else {
      const quickBody = $("#editorBody");
      if (quickBody) d.body = quickBody.value;
    }
    if (category) d.category = category.value;
    if (tags)
      d.tags = [
        ...new Set(
          tags.value
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean),
        ),
      ];
    d.updatedAt = now();
    editorDirty = true;
    if (activeDocDraft?.id === d.id) {
      if (!hasDocumentPayload(d)) {
        saveStatus = "saved";
        updateSaveIndicator();
        return;
      }
      activeDocDraft = null;
      state.docs.unshift(d);
    }
    saveStatus = "saving";
    updateSaveIndicator();
    const meta = $(".editor-meta");
    if (meta) {
      const spans = meta.querySelectorAll("span");
      if (spans.length > 4)
        spans[4].textContent = (d.body || "").length + " characters";
    }
    persist(true);
  }
  function wireEditor() {
    const root = $("#viewRoot"),
      blocks = $("#editorBlocks", root);
    if (!blocks) return;
    if (!window.editorEnterCaptureWired) {
      document.addEventListener(
        "keydown",
        (e) => {
          if (
            e.key !== "Enter" ||
            e.shiftKey ||
            e.isComposing ||
            e.keyCode === 229
          )
            return;
          const target = e.target instanceof Element ? e.target : null,
            editor = target?.closest("#editorBlocks");
          if (!editor) return;
          const block = target.closest(".editor-block") || editorCurrentBlock(),
            content = editorContent(block);
          if (!block || !content) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          editorEnter(block, content);
        },
        true,
      );
      window.editorEnterCaptureWired = true;
    }
    editorImageResizeHandles = ensureEditorImageResizeHandle();
    editorSelectedImage = null;
    editorImageResizeHandles.forEach((h) => (h.hidden = true));
    const attachmentArea = $(".document-attachments", root);
    let attachmentResizeDrag = null;
    attachmentArea?.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest(".document-attachment-resize");
      if (!handle) return;
      const item = handle.closest("[data-document-attachment]"),
        rect = item?.getBoundingClientRect();
      if (!item || !rect) return;
      e.preventDefault();
      attachmentResizeDrag = {
        item,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
      };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    attachmentArea?.addEventListener("pointermove", (e) => {
      const drag = attachmentResizeDrag;
      if (!drag || drag.pointerId !== e.pointerId) return;
      drag.item.style.width =
        Math.max(
          180,
          Math.min(1400, drag.startWidth + e.clientX - drag.startX),
        ) + "px";
      drag.item.style.height =
        Math.max(
          90,
          Math.min(900, drag.startHeight + e.clientY - drag.startY),
        ) + "px";
    });
    const finishAttachmentResize = (e) => {
      const drag = attachmentResizeDrag;
      if (!drag || drag.pointerId !== e.pointerId) return;
      attachmentResizeDrag = null;
      const doc = getDoc(activeDocId),
        attachment = doc?.attachments?.find(
          (a) => a.id === drag.item.dataset.documentAttachment,
        );
      if (!attachment) return;
      attachment.displayWidth = Math.round(
        drag.item.getBoundingClientRect().width,
      );
      attachment.displayHeight = Math.round(
        drag.item.getBoundingClientRect().height,
      );
      doc.updatedAt = now();
      persist(true);
    };
    attachmentArea?.addEventListener("pointerup", finishAttachmentResize);
    attachmentArea?.addEventListener("pointercancel", finishAttachmentResize);
    if (!window.editorSelectionWired) {
      document.addEventListener("selectionchange", () => {
        saveEditorSelection();
        const linkButton = $('[data-action="insert-link"]', root);
        if (linkButton) {
          const sel = getSelection(),
            range = sel?.rangeCount ? sel.getRangeAt(0) : null;
          linkButton.hidden = !(
            range &&
            !range.collapsed &&
            !!range.toString().trim() &&
            $("#editorBlocks")?.contains(range.commonAncestorContainer)
          );
        }
      });
      window.editorSelectionWired = true;
    }
    blocks.addEventListener(
      "mousedown",
      (e) => {
        const target =
          e.target instanceof Element ? e.target : e.target?.parentElement;
        if (target?.closest(".editor-block-controls")) e.preventDefault();
      },
      true,
    );
    blocks.addEventListener(
      "click",
      (e) => {
        const target =
          e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!target) return;
        const toggle = target.closest("[data-editor-insert-toggle]");
        if (toggle) {
          document
            .querySelectorAll(".editor-slash-menu")
            .forEach((item) => item.remove());
          const menu = $(
            ".editor-insert-menu",
            toggle.closest(".editor-block"),
          );
          $(".editor-insert-menu").forEach((item) => {
            if (item !== menu) item.hidden = true;
          });
          if (menu) menu.hidden = !menu.hidden;
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
        const choice = target.closest("[data-insert-block-type]");
        if (choice) {
          const block = choice.closest(".editor-block"),
            type = choice.dataset.insertBlockType;
          $(".editor-insert-menu", block).hidden = true;
          const next = insertEditorBlockAfter(block, type, "");
          updateDocFromEditor();
          focusEditorContent(editorContent(next), true);
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      },
      true,
    );
    blocks.addEventListener("beforeinput", (e) => {
      if (e.inputType !== "insertParagraph" || e.isComposing) return;
      const block =
          e.target instanceof Element
            ? e.target.closest(".editor-block")
            : null,
        content = editorContent(block);
      if (!block || !content) return;
      e.preventDefault();
      editorEnter(block, content);
    });
    blocks.addEventListener("click", (e) => {
      const image =
        e.target instanceof Element
          ? e.target.closest(".editor-block-content img")
          : null;
      if (image) {
        if (editorSelectedImage && editorSelectedImage !== image)
          editorSelectedImage.classList.remove("is-resizing-selected");
        editorSelectedImage = image;
        image.classList.add("is-resizing-selected");
        positionEditorImageResizeHandle();
        return;
      }
      if (editorSelectedImage) {
        editorSelectedImage.classList.remove("is-resizing-selected");
        editorSelectedImage = null;
        editorImageResizeHandles.forEach((h) => (h.hidden = true));
      }
      const target =
          e.target instanceof Element ? e.target : e.target?.parentElement,
        link = target?.closest("a[href]");
      if (!link || link.hasAttribute("download")) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, "_blank", "noopener,noreferrer");
    });
    blocks.addEventListener("focusin", (e) => {
      editorSetActiveBlock(
        e.target.closest(".editor-block") || editorCurrentBlock(),
      );
      const type = $("#editorBlockType", root);
      if (type && editorActiveBlock)
        type.value = editorActiveBlock.dataset.type;
      saveEditorSelection();
    });
    const refreshLinkButton = () => {
      saveEditorSelection();
      const button = $('[data-action="insert-link"]', root),
        sel = getSelection(),
        range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      if (button)
        button.hidden = !(
          range &&
          !range.collapsed &&
          !!range.toString().trim() &&
          $("#editorBlocks")?.contains(range.commonAncestorContainer)
        );
    };
    blocks.addEventListener("keyup", refreshLinkButton);
    blocks.addEventListener("mouseup", refreshLinkButton);
    blocks.addEventListener("input", (e) => {
      const block = e.target.closest(".editor-block") || editorCurrentBlock(),
        content = editorContent(block);
      if (!content) return;
      if (
        content.textContent.trim() === "/" &&
        block.dataset.type === "paragraph"
      )
        showSlashMenu(block);
      else if (!content.textContent.startsWith("/"))
        $(".editor-slash-menu", block)?.remove();
      editorSetActiveBlock(block);
      updateDocFromEditor();
    });
    blocks.addEventListener(
      "keydown",
      (e) => {
        if (
          e.target.closest("button,input,select,.editor-insert-menu") ||
          e.isComposing ||
          e.keyCode === 229
        )
          return;
        const block = e.target.closest(".editor-block") || editorCurrentBlock(),
          content = editorContent(block);
        if (!block || !content) return;
        const menu = $(".editor-slash-menu", block);
        if (menu) {
          const items = [...menu.querySelectorAll("[data-slash-type]")],
            current = items.findIndex(
              (x) => x.getAttribute("aria-selected") === "true",
            );
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            items.forEach((x) => x.removeAttribute("aria-selected"));
            items[
              (current + (e.key === "ArrowDown" ? 1 : items.length - 1)) %
                items.length
            ].setAttribute("aria-selected", "true");
            return;
          }
          if (e.key === "Escape") {
            menu.remove();
            e.preventDefault();
            return;
          }
        }
        if (
          (e.ctrlKey || e.metaKey) &&
          ["b", "i", "u"].includes(e.key.toLowerCase())
        ) {
          e.preventDefault();
          document.execCommand(
            { b: "bold", i: "italic", u: "underline" }[e.key.toLowerCase()],
            false,
          );
          updateDocFromEditor();
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          editorEnter(block, content);
          return;
        }
        if (
          (e.key === "Backspace" || e.key === "Delete") &&
          getSelection()?.rangeCount &&
          !getSelection().getRangeAt(0).collapsed
        ) {
          e.preventDefault();
          editorDeleteRange(getSelection().getRangeAt(0));
          updateDocFromEditor();
          return;
        }
        if (e.key === "Backspace" && editorBackspace(block, content)) {
          e.preventDefault();
          return;
        }
      },
      true,
    );
    blocks.addEventListener("paste", (e) => {
      const block = e.target.closest(".editor-block") || editorCurrentBlock(),
        content = editorContent(block);
      if (content) pasteEditorText(e, block, content);
    });
    blocks.addEventListener("change", (e) => {
      if (e.target.matches(".editor-check")) updateDocFromEditor();
    });
    blocks.addEventListener("click", (e) => {
      const fileLink = (
        e.target instanceof Element ? e.target : e.target?.parentElement
      )?.closest("a[download]");
      if (fileLink && fileLink.href.startsWith("data:")) {
        e.preventDefault();
        e.stopPropagation();
        const dataUrl = fileLink.getAttribute("href"),
          filename = fileLink.getAttribute("download") || "download";
        fetch(dataUrl)
          .then((response) => response.blob())
          .then((blob) => {
            const objectUrl = URL.createObjectURL(blob),
              download = document.createElement("a");
            download.href = objectUrl;
            download.download = filename;
            document.body.append(download);
            download.click();
            download.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
          })
          .catch(() => toast("파일을 다운로드할 수 없어요.", true));
        return;
      }
      const backlink = e.target.closest("[data-block-backlink]");
      if (backlink) {
        const block = backlink.closest(".editor-block");
        showBlockBacklinkModal(block?.dataset.blockId);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const ref = e.target.closest("[data-open-doc]");
      if (ref) {
        e.preventDefault();
        e.stopPropagation();
        openDoc(ref.dataset.openDoc, ref.dataset.openBlock);
        return;
      }
      const toggle = e.target.closest("[data-editor-insert-toggle]");
      if (toggle) {
        const menu = $(".editor-insert-menu", toggle.closest(".editor-block"));
        document.querySelectorAll(".editor-insert-menu").forEach((x) => {
          if (x !== menu) x.hidden = true;
        });
        if (menu) menu.hidden = !menu.hidden;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const choice = e.target.closest("[data-insert-block-type]");
      if (choice) {
        const block = choice.closest(".editor-block"),
          type = choice.dataset.insertBlockType;
        $(".editor-insert-menu", block).hidden = true;
        const next = insertEditorBlockAfter(block, type, "");
        updateDocFromEditor();
        focusEditorContent(editorContent(next), true);
        e.preventDefault();
        e.stopPropagation();
      }
    });
    blocks.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest("[data-editor-drag-handle]");
      if (!handle || e.button !== 0) return;
      const block = handle.closest(".editor-block");
      if (!block) return;
      editorBlockDrag = { block, pointerId: e.pointerId, moved: false };
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
      block.classList.add("is-dragging");
      e.preventDefault();
    });
    blocks.addEventListener("pointermove", (e) => {
      if (!editorBlockDrag || e.pointerId !== editorBlockDrag.pointerId) return;
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("#editorBlocks .editor-block");
      if (!target || target === editorBlockDrag.block) return;
      const rect = target.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2)
        target.before(editorBlockDrag.block);
      else target.after(editorBlockDrag.block);
      editorBlockDrag.moved = true;
    });
    const finishMove = (e) => {
      if (!editorBlockDrag || e.pointerId !== editorBlockDrag.pointerId) return;
      const block = editorBlockDrag.block;
      block.classList.remove("is-dragging");
      try {
        const handle = $("[data-editor-drag-handle]", block);
        if (handle?.hasPointerCapture(e.pointerId))
          handle.releasePointerCapture(e.pointerId);
      } catch (_) {}
      const moved = editorBlockDrag.moved;
      editorBlockDrag = null;
      if (moved) updateDocFromEditor();
    };
    blocks.addEventListener("pointerup", finishMove);
    blocks.addEventListener("pointercancel", finishMove);
    root.querySelectorAll("[data-inline-format]").forEach((button) => {
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => {
        restoreEditorSelection();
        document.execCommand(button.dataset.inlineFormat, false);
        updateDocFromEditor();
      });
    });
    const linkButton = $('[data-action="insert-link"]', root);
    linkButton?.addEventListener("mousedown", (e) => e.preventDefault());
    const typeSelect = $("#editorBlockType", root);
    typeSelect?.addEventListener("mousedown", saveEditorSelection);
    typeSelect?.addEventListener("change", () => {
      restoreEditorSelection();
      setEditorBlockType(editorCurrentBlock(), typeSelect.value);
    });
    const bindImmediateFormat = (control, apply) => {
      if (!control) return;
      control.addEventListener("focus", saveEditorSelection);
      control.addEventListener("pointerdown", saveEditorSelection);
      control.addEventListener("mousedown", saveEditorSelection);
      let lastValue = null,
        lastAt = 0;
      const commit = () => {
        if (!control.value) return;
        const value = control.value,
          at = Date.now();
        if (value === lastValue && at - lastAt < 150) return;
        lastValue = value;
        lastAt = at;
        restoreEditorSelection();
        apply(value);
        updateDocFromEditor();
      };
      control.addEventListener("input", commit);
      control.addEventListener("change", commit);
    };
    [
      ["#editorFontFamily", "fontFamily", "fontName"],
      ["#editorTextColor", "color", "foreColor"],
      ["#editorTextBackground", "backgroundColor", "hiliteColor"],
    ].forEach(([sel, property, command]) =>
      bindImmediateFormat($(sel, root), (value) => {
        if (!applyEditorStyleToSelection(property, value, command)) {
          document.execCommand(command, false, value);
          normalizeEditorFontTags();
        }
      }),
    );
    const sizeControl = $("#editorFontSize", root);
    bindImmediateFormat(sizeControl, (value) => {
      if (!applyEditorStyleToSelection("fontSize", value, "fontSize")) {
        document.execCommand("fontSize", false, "7");
        $('#editorBlocks font[size="7"]').forEach((font) => {
          const span = document.createElement("span");
          span.style.fontSize = value;
          span.innerHTML = font.innerHTML;
          font.replaceWith(span);
        });
        if (!getSelection()?.toString()) {
          const block = editorCurrentBlock(),
            content = editorContent(block);
          if (content) content.style.fontSize = value;
        }
      }
    });
  }
  function renderBoards() {
    if (state.boards.length) {
      if (!currentBoardId || !getBoard(currentBoardId))
        currentBoardId = getBoard(state.lastBoardId)
          ? state.lastBoardId
          : state.boards[0].id;
      return renderBoard();
    }
    return `${heading("THINK VISUALLY", "보드", "생각을 자유롭게 놓고 연결해 보세요.", `<button class="btn primary" data-action="create-board">${ico("plus")} 새 보드</button>`)}<div class="panel empty"><div class="empty-mark">${ico("layout")}</div><h3>첫 번째 보드를 만들어보세요</h3><p>문서와 메모를 카드로 놓고 생각의 관계를 시각적으로 정리할 수 있어요.</p><button class="btn primary" data-action="create-board">보드 만들기</button></div>`;
  }
  let boardDocumentPreviewId = null,
    boardDocumentPickerKind = null,
    boardDocumentWindowPosition = null,
    boardDocumentWindowDrag = null,
    boardDocumentItemDrag = null;
  function renderBoardDocumentPanel() {
    if (boardDocumentPickerKind) {
      const items = state.docs
        .filter((d) => d.kind === boardDocumentPickerKind)
        .slice()
        .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      const isNote = boardDocumentPickerKind === "note";
      const tabs =
        '<div class="board-document-picker-tabs"><button class="' +
        (isNote ? "active" : "") +
        '" data-action="board-picker-tab" data-kind="note">메모 <span>' +
        notes().length +
        '</span></button><button class="' +
        (!isNote ? "active" : "") +
        '" data-action="board-picker-tab" data-kind="document">문서 <span>' +
        documents().length +
        "</span></button></div>";
      const search =
        '<div class="board-document-picker-search"><input type="search" data-board-picker-search placeholder="제목·내용·태그 검색" aria-label="제목, 내용, 태그 검색"></div>';
      const list = items.length
        ? '<div class="board-document-picker-list">' +
          items
            .map((d) => {
              const body = plain(d.body),
                title = d.title || body.slice(0, 50) || "제목 없는 기록",
                tags = tagsFor(d),
                files = d.attachments || [],
                searchable = [
                  title,
                  body,
                  ...tags,
                  ...files.map((a) => a.name || ""),
                ].join(" ");
              const attachments = files
                .map((a) => {
                  const url = quickMemoAttachmentUrl(a),
                    name = escapeHtml(a.name || "첨부 자료"),
                    isImage =
                      (a.type === "image" ||
                        (a.type !== "url" &&
                          (a.mime || "").startsWith("image/"))) &&
                      url;
                  if (isImage)
                    return (
                      '<a class="board-document-picker-attachment-image" href="' +
                      escapeHtml(url) +
                      '" target="_blank" rel="noopener noreferrer" title="' +
                      name +
                      ' 열기"><img src="' +
                      escapeHtml(url) +
                      '" alt="' +
                      name +
                      '" loading="lazy"></a>'
                    );
                  if (!url)
                    return (
                      '<span class="board-document-picker-attachment-file">' +
                      name +
                      "</span>"
                    );
                  return (
                    '<a class="board-document-picker-attachment-file" href="' +
                    escapeHtml(url) +
                    '" ' +
                    (a.type === "url"
                      ? 'target="_blank" rel="noopener noreferrer"'
                      : 'download="' + name + '"') +
                    ">" +
                    name +
                    "</a>"
                  );
                })
                .join("");
              return (
                '<article class="board-document-picker-item' +
                (isNote ? " is-note" : "") +
                '" draggable="false" data-board-doc-drag="' +
                escapeHtml(d.id) +
                '" data-search-text="' +
                escapeHtml(searchable) +
                '" title="보드로 끌어 놓기"><div class="board-document-picker-copy"><b>' +
                escapeHtml(title) +
                "</b><p>" +
                escapeHtml(body || "아직 작성된 내용이 없습니다.") +
                "</p>" +
                (tags.length
                  ? '<div class="board-document-panel-tags">' +
                    tags
                      .map((t) => "<span>" + escapeHtml(t) + "</span>")
                      .join("") +
                    "</div>"
                  : "") +
                (attachments
                  ? '<div class="board-document-picker-attachments">' +
                    attachments +
                    "</div>"
                  : "") +
                "</div></article>"
              );
            })
            .join("") +
          '<div class="board-document-picker-no-results" hidden>검색 결과가 없습니다.</div></div>'
        : '<div class="board-document-picker-empty">저장된 ' +
          (isNote ? "메모" : "문서") +
          "가 없습니다.</div>";
      return (
        '<aside class="board-document-panel board-document-picker" aria-label="기존 메모와 문서 선택" ' +
        (boardDocumentWindowPosition
          ? 'style="left:' +
            boardDocumentWindowPosition.x +
            "px;top:" +
            boardDocumentWindowPosition.y +
            'px;right:auto"'
          : "") +
        '><div class="board-document-panel-head"><div class="board-document-window-move"><span>기존 메모와 문서</span></div><button class="board-document-close" data-action="close-board-document" aria-label="닫기">×</button></div>' +
        tabs +
        search +
        list +
        "</aside>"
      );
    }
    const d = getDoc(boardDocumentPreviewId);
    if (!d) return "";
    const attachments = (d.attachments || [])
      .map((a) => {
        const url = quickMemoAttachmentUrl(a),
          name = escapeHtml(a.name || "첨부 자료"),
          isImage =
            (a.type === "image" || (a.mime || "").startsWith("image/")) && url,
          isVideo =
            a.type !== "url" && (a.mime || "").startsWith("video/") && url;
        if (isImage)
          return (
            '<a href="' +
            escapeHtml(url) +
            '" target="_blank" rel="noopener noreferrer" aria-label="' +
            name +
            ' 열기"><img class="board-document-panel-image" src="' +
            escapeHtml(url) +
            '" alt="' +
            name +
            '" loading="lazy"></a>'
          );
        if (isVideo)
          return (
            '<video class="board-document-panel-video" controls preload="metadata" src="' +
            escapeHtml(url) +
            '" aria-label="' +
            name +
            '"></video>'
          );
        const size = a.size
          ? a.size < 1048576
            ? (a.size / 1024).toFixed(1) + " KB"
            : (a.size / 1048576).toFixed(1) + " MB"
          : "";
        return (
          '<div class="board-document-panel-file"><a href="' +
          escapeHtml(url) +
          '" ' +
          (a.type === "url"
            ? 'target="_blank" rel="noopener noreferrer"'
            : 'download="' + name + '"') +
          ">" +
          name +
          "</a>" +
          (size ? "<small>" + size + "</small>" : "") +
          "</div>"
        );
      })
      .join("");
    return (
      '<aside class="board-document-panel" aria-label="문서 미리보기" ' +
      (boardDocumentWindowPosition
        ? 'style="left:' +
          boardDocumentWindowPosition.x +
          "px;top:" +
          boardDocumentWindowPosition.y +
          'px;right:auto"'
        : "") +
      '><div class="board-document-panel-head"><div class="board-document-window-move" data-board-document-move title="창 이동">⠿ <span>' +
      escapeHtml(d.title || "제목 없는 기록") +
      '</span></div><button class="board-document-close" data-action="close-board-document" aria-label="닫기">×</button></div><div class="board-document-panel-content"><div class="eyebrow">' +
      (d.kind === "note" ? "메모" : "문서") +
      "</div><h2>" +
      escapeHtml(d.title || "제목 없는 기록") +
      '</h2><div class="board-document-panel-meta">수정 ' +
      fmtDate(d.updatedAt) +
      "</div>" +
      (tagsFor(d).length
        ? '<div class="board-document-panel-tags">' +
          tagsFor(d)
            .map((t) => "<span>" + escapeHtml(t) + "</span>")
            .join("") +
          "</div>"
        : "") +
      '<div class="board-document-panel-body">' +
      escapeHtml(plain(d.body) || "아직 작성된 내용이 없습니다.") +
      "</div>" +
      (attachments
        ? '<div class="board-document-panel-attachments"><div class="field-label">첨부 자료</div>' +
          attachments +
          "</div>"
        : "") +
      '</div><div class="board-document-panel-foot"><button class="btn small" data-action="edit-board-document" data-document-id="' +
      escapeHtml(d.id) +
      '">전체 편집</button></div></aside>'
    );
  }
  function openBoardDocumentPreview(id) {
    if (!getDoc(id)) return;
    boardDocumentPickerKind = null;
    if (boardDocumentPreviewId !== id) boardDocumentWindowPosition = null;
    boardDocumentPreviewId = id;
    render();
  }
  function openBoardDocumentPicker() {
    boardDocumentPreviewId = null;
    boardDocumentPickerKind = "note";
    boardDocumentWindowPosition = null;
    render();
  }
  function placeBoardDocumentOnBoard(id, clientX, clientY) {
    const d = getDoc(id),
      b = getBoard(currentBoardId),
      wrap = $("#boardWrap");
    if (!d || !b || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    saveBoardHistory();
    b.cards.push({
      id: uid(),
      type: "doc",
      targetId: id,
      x: (clientX - rect.left - boardTransform.x) / boardTransform.scale,
      y: (clientY - rect.top - boardTransform.y) / boardTransform.scale,
    });
    b.updatedAt = now();
    persist(true);
    render();
    toast("기록을 보드 요소로 추가했어요.");
  }
  function boardAttachmentMarkup(a) {
    const url = quickMemoAttachmentUrl(a),
      name = escapeHtml(a.name || "첨부 파일"),
      mime = a.mime || "",
      isImage = (a.type === "image" || mime.startsWith("image/")) && url,
      isVideo = a.type !== "url" && mime.startsWith("video/") && url;
    if (isImage)
      return (
        '<img class="board-media-image" src="' +
        escapeHtml(url) +
        '" alt="' +
        name +
        '" draggable="false">'
      );
    if (isVideo)
      return (
        '<video class="board-media-video" controls preload="metadata" data-board-attachment-control src="' +
        escapeHtml(url) +
        '" aria-label="' +
        name +
        '"></video>'
      );
    if (!url) return '<span class="board-media-file">📎 ' + name + "</span>";
    return (
      '<a class="board-media-file" data-board-attachment-control href="' +
      escapeHtml(url) +
      '" ' +
      (a.type === "url"
        ? 'target="_blank" rel="noopener noreferrer"'
        : 'download="' + name + '"') +
      ">📎 " +
      name +
      "</a>"
    );
  }
  function renderBoard() {
    const b = getBoard(currentBoardId);
    if (!b) {
      currentView = "boards";
      return renderBoards();
    }
    const chain = [];
    let q = b;
    while (q) {
      chain.unshift(q);
      q = q.parentId ? getBoard(q.parentId) : null;
    }
    const cards = b.cards || [],
      edges = b.edges || [];
    const html = cards
      .map((c) => {
        if (c.type === "attachment") {
          const d = c.targetId ? getDoc(c.targetId) : null,
            attachment =
              c.attachment ||
              d?.attachments?.find((a) => a.id === c.attachmentId);
          if (!attachment) return "";
          const name = escapeHtml(attachment.name || d?.title || "첨부 파일"),
            preview = boardAttachmentMarkup(attachment),
            openDoc = d ? ' data-open-doc="' + d.id + '"' : "";
          return (
            '<div class="board-item board-attachment" data-card="' +
            c.id +
            '"' +
            openDoc +
            ' style="left:' +
            c.x +
            "px;top:" +
            c.y +
            'px"><div class="item-head">파일 첨부<button class="board-card-menu" data-remove-board-item="' +
            c.id +
            '" title="요소 삭제">×</button></div><div class="item-content">' +
            preview +
            "</div></div>"
          );
        }
        if (c.type === "board") {
          const child = getBoard(c.boardId);
          return child
            ? '<div class="board-item nested" data-card="' +
                c.id +
                '" data-open-board="' +
                child.id +
                '" style="left:' +
                c.x +
                "px;top:" +
                c.y +
                'px"><div class="item-head">▣ 하위 보드</div><div class="item-content"><b>' +
                escapeHtml(child.name) +
                "</b><br>" +
                child.cards.length +
                "개 항목 · 열기 ↗</div></div>"
            : "";
        }
        if (c.type === "doc" || c.targetId) {
          const d = getDoc(c.targetId);
          if (!d) return "";
          const attachments = (d.attachments || [])
            .map(boardAttachmentMarkup)
            .join("");
          return (
            '<div class="board-card" data-card="' +
            c.id +
            '" data-open-doc="' +
            d.id +
            '" style="left:' +
            c.x +
            "px;top:" +
            c.y +
            'px"><div class="board-card-top"><span class="board-card-dot"></span><span class="board-card-type">' +
            (d.kind === "note" ? "Quick Memo" : "Document") +
            '</span><button class="board-card-menu" data-remove-board-item="' +
            c.id +
            '" title="요소 삭제" aria-label="요소 삭제">×</button></div><div class="board-card-title">' +
            escapeHtml(d.title || "제목 없는 기록") +
            '</div><div class="board-card-body">' +
            escapeHtml(plain(d.body).slice(0, 100)) +
            "</div>" +
            (attachments
              ? '<div class="board-card-attachments">' + attachments + "</div>"
              : "") +
            "</div>"
          );
        }
        if (c.type === "link" && safeExternalUrl(c.url)) {
          const href = safeExternalUrl(c.url),
            host = new URL(href).hostname,
            preview = youtubeThumbnail(href) || safeExternalUrl(c.previewImage),
            imageSrc = preview || linkPreviewImageEndpoint(href),
            thumb =
              '<img class="link-preview-image" draggable="false" src="' +
              escapeHtml(imageSrc) +
              '" alt="링크 미리보기 이미지" loading="lazy">';
          return (
            '<div class="board-item link-preview" role="link" tabindex="0" aria-label="' +
            escapeHtml(c.content || host) +
            ' 열기" data-board-url="' +
            escapeHtml(href) +
            '" data-card="' +
            c.id +
            '" style="left:' +
            c.x +
            "px;top:" +
            c.y +
            'px"><div class="link-preview-thumb">' +
            thumb +
            '</div><div class="item-head"><span>' +
            escapeHtml(host) +
            '</span><button class="board-card-menu" data-edit-board-link="' +
            c.id +
            '" title="링크 편집">✎</button></div><div class="item-content"><strong>' +
            escapeHtml(c.content || host) +
            "</strong>" +
            (c.description
              ? '<span class="link-preview-description">' +
                escapeHtml(c.description) +
                "</span>"
              : "") +
            '<span class="link-preview-url">' +
            escapeHtml(host) +
            "</span></div></div>"
          );
        }
        const types = {
          note: "메모",
          link: "링크",
          todo: "할 일",
          column: "컬럼",
          sketch: "스케치",
          file: "문서 첨부",
          audio: "오디오",
          table: "표",
          comment: "코멘트",
          video: "비디오",
          image: "이미지",
        };
        let text = escapeHtml(c.content || c.url || "");
        if (c.type === "sketch" && c.content?.startsWith("data:image"))
          text =
            '<img src="' +
            escapeHtml(c.content) +
            '" alt="스케치" style="display:block;max-width:100%;max-height:220px">';
        if (c.type === "todo") text = (c.checked ? "☑" : "☐") + " " + text;
        if (c.type === "table")
          text =
            "<table><tbody>" +
            (c.content || "")
              .split("\n")
              .map(
                (r) =>
                  "<tr>" +
                  r
                    .split(",")
                    .map((v) => "<td>" + escapeHtml(v) + "</td>")
                    .join("") +
                  "</tr>",
              )
              .join("") +
            "</tbody></table>";
        if (c.type === "image" && (c.imageData || c.url))
          text =
            '<img src="' +
            escapeHtml(c.imageData || c.url) +
            '" alt="보드 이미지" style="display:block;max-width:100%;max-height:210px;object-fit:contain">';
        if (
          ["link", "file", "audio", "video", "image"].includes(c.type) &&
          c.url &&
          c.type !== "image"
        )
          text =
            '<a href="' +
            escapeHtml(c.url) +
            '" target="_blank" rel="noopener">' +
            escapeHtml(c.url) +
            "</a>";
        return (
          '<div class="board-item ' +
          (c.type === "column" ? "column" : "") +
          '" data-card="' +
          c.id +
          '" data-edit-board-item="' +
          c.id +
          '" style="left:' +
          c.x +
          "px;top:" +
          c.y +
          'px"><div class="item-head">' +
          (types[c.type] || c.type) +
          '<button class="board-card-menu" data-remove-board-item="' +
          c.id +
          '" title="요소 삭제">×</button></div><div class="item-content">' +
          text +
          "</div></div>"
        );
      })
      .join("");
    return (
      '<div class="board-stage"><div class="board-toolbar">' +
      (b.parentId
        ? '<button class="btn small" data-action="back-parent-board">← 이전 보드</button><span class="board-name">' +
          escapeHtml(b.name) +
          '</span><button class="btn small" data-action="rename-board">이름 변경</button>'
        : "") +
      '<div class="board-tools">' +
      [
        ["note", "메모"],
        ["link", "링크"],
        ["todo", "할 일"],
        ["line", "선"],
        ["column", "컬럼"],
        ["sketch", "스케치"],
        ["table", "표"],
        ["comment", "코멘트"],
      ]
        .map(
          (x) =>
            '<button class="btn small' +
            ((x[0] === "line" && connectMode) ||
            (x[0] === "sketch" && boardSketchMode)
              ? " active"
              : "") +
            '" draggable="true" data-board-item="' +
            x[0] +
            '">' +
            x[1] +
            "</button>",
        )
        .join("") +
      '<button class="btn small" data-action="attach-board-file">파일 첨부</button>' +
      '<button class="btn small" data-action="add-nested-board">보드 추가</button><button class="btn small" data-action="add-board-card">기존 문서</button></div><button class="btn small" data-action="delete-selected-card" ' +
      (selectedCardIds.length ? "" : "disabled") +
      '>선택 삭제</button></div><input id="boardFilePicker" type="file" multiple hidden><div class="board-wrap" id="boardWrap"><div class="board-viewport"><div class="board-world" id="boardWorld" style="transform:translate(' +
      boardTransform.x +
      "px," +
      boardTransform.y +
      "px) scale(" +
      boardTransform.scale +
      ')"><svg class="board-edges" id="boardEdges" viewBox="0 0 2200 1600">' +
      edgeMarkup(edges, cards) +
      "</svg>" +
      html +
      '</div></div><div class="board-floating"><div class="board-control-group"><div class="board-history-controls"><button class="btn small" data-action="board-undo" title="실행 취소">↶ 되돌리기</button><button class="btn small" data-action="board-redo" title="재실행">↷ 다시 실행</button></div><div class="zoom-controls"><button data-action="zoom-out" title="축소">−</button><span class="zoom-label">' +
      Math.round(boardTransform.scale * 100) +
      '%</span><button data-action="zoom-in" title="확대">+</button></div></div><div class="board-tip">빈 곳을 드래그해 여러 항목을 선택하세요. 휠 버튼을 누른 채 드래그하면 보드를 이동합니다.</div></div>' +
      renderBoardDocumentPanel() +
      "</div></div>"
    );
  }
  function renderTags() {
    const counts = tagCounts();
    const tags = Object.keys(counts).sort((a, b) => a.localeCompare(b, "ko"));
    const cats = state.categories;
    const filtered = currentTag
      ? state.docs.filter(
          (d) => tagsFor(d).includes(currentTag) || d.category === currentTag,
        )
      : [];
    return `${heading("ORGANIZE LIGHTLY", "태그와 카테고리", "분류는 시작부터 완벽할 필요가 없어요. 필요할 때 가볍게 정리하세요.", `<button class="btn" data-action="create-category">${ico("plus")} 카테고리 추가</button>`)}<div class="tags-layout"><div class="tag-summary"><div class="eyebrow">YOUR VOCABULARY</div><strong>${tags.length + cats.length}</strong><p>개의 태그와 카테고리로 기록을 정리하고 있어요. 태그는 유연하게, 카테고리는 조금 더 안정적으로 사용해 보세요.</p><button class="btn" style="margin-top:15px;width:100%" data-action="create-tag">새 태그 안내</button></div><div><div class="section-head"><h2>태그 <span style="color:#aaa;font-weight:400">${tags.length}</span></h2><span class="hint">선택하면 관련 기록을 볼 수 있어요</span></div><div class="tag-cloud" style="margin-bottom:28px">${tags.map((t) => `<button class="tag-chip ${currentTag === t ? "active" : ""}" data-tag="${escapeHtml(t)}"># ${escapeHtml(t)} <span>${counts[t]}</span></button>`).join("") || '<div class="panel empty" style="width:100%;padding:30px"><p>아직 태그가 없습니다. 문서를 열고 태그를 추가해보세요.</p></div>'}</div><div class="section-head"><h2>카테고리 <span style="color:#aaa;font-weight:400">${cats.length}</span></h2></div><div class="tag-cloud">${cats.map((c) => `<button class="tag-chip ${currentTag === `category:${c}` ? "active" : ""}" data-category-tag="${escapeHtml(c)}">${ico("layout")} ${escapeHtml(c)} <span>${state.docs.filter((d) => d.category === c).length}</span></button>`).join("") || '<span class="hint">카테고리가 아직 없어요.</span>'}</div>${currentTag ? `<div style="margin-top:27px"><div class="section-head"><h2>‘${escapeHtml(currentTag.replace("category:", ""))}’ 기록</h2><button class="text-link" data-action="clear-tag">초기화 ×</button></div><div class="panel"><div class="recent-list">${filtered.length ? filtered.map(docRow).join("") : '<div class="empty"><p>이 분류에 해당하는 기록이 없어요.</p></div>'}</div></div></div>` : ""}</div></div>`;
  }
  function renderConnections() {
    return heading("KNOWLEDGE GRAPH", "연결 관계", "", "");
  }
  function renderSettings() {
    return `${heading("PREFERENCES", "설정 및 데이터", "이 버전은 현재 브라우저에 데이터를 저장합니다.", `<button class="btn" data-action="export-data">${ico("external")} 데이터 내보내기</button>`)}<div class="settings-grid"><div class="settings-card"><div class="eyebrow">BACKUP</div><h3 style="margin-top:10px">백업 파일 만들기</h3><p>현재 데이터를 JSON 파일로 내려받아 보관할 수 있습니다. 첨부 파일은 내보내기 시 파일 데이터도 포함합니다. 민감한 자료는 안전한 위치에 보관하세요.</p><button class="btn primary" data-action="export-data">데이터 내보내기</button></div><div class="settings-card"><div class="eyebrow">RESTORE</div><h3 style="margin-top:10px">백업에서 복원</h3><p>이전에 Untit에서 내보낸 JSON 파일을 불러옵니다. 현재 데이터는 가져온 데이터로 교체되므로 먼저 백업하는 것을 권장합니다.</p><button class="btn" data-action="import-data">백업 파일 선택</button></div><div class="settings-card" style="grid-column:1/-1"><div class="eyebrow">DANGER ZONE</div><h3 style="margin-top:10px">로컬 데이터 초기화</h3><p>현재 브라우저에 저장된 문서, 메모, 보드, 연결 정보를 모두 삭제하고 샘플 데이터로 되돌립니다. 이 작업은 되돌릴 수 없습니다.</p><button class="btn danger" data-action="reset-data">초기화 및 샘플 데이터 복원</button></div></div><input id="importPicker" type="file" accept="application/json,.json" hidden>`;
  }
  function render() {
    if (boardDrag && ["board", "boards"].includes(currentView)) {
      pendingBoardRerender = true;
      return;
    }
    $(".app").classList.toggle(
      "board-open",
      currentView === "board" ||
        (currentView === "boards" && state.boards.length > 0),
    );
    updateCounts();
    $$(".nav-btn[data-view]").forEach((b) =>
      b.classList.toggle(
        "active",
        b.dataset.view === currentView ||
          (currentView === "editor" &&
            b.dataset.view ===
              (getDoc(activeDocId)?.kind === "note" ? "inbox" : "documents")) ||
          (["board", "boards"].includes(currentView) &&
            b.dataset.view === "boards"),
      ),
    );
    const root = $("#viewRoot");
    $("#crumbText").textContent =
      {
        home: "Overview",
        inbox: "Quick Memo",
        documents: "Documents",
        editor: "Editor",
        boards: "Boards",
        board: "Board",
        tags: "Tags & categories",
        recent: "Recently updated",
        links: "Connections",
        settings: "Settings",
      }[currentView] || "Overview";
    if (currentView === "home") root.innerHTML = renderHome();
    else if (["inbox", "documents", "recent"].includes(currentView))
      root.innerHTML = renderLibrary(
        "all",
        currentView === "inbox"
          ? "Quick Memo"
          : currentView === "recent"
            ? "Recently updated"
            : "Documents",
        currentView === "inbox"
          ? "가볍게 남겨둔 생각을 확인하고, 필요한 기록으로 발전시켜보세요."
          : currentView === "recent"
            ? "최근 수정한 모든 메모와 문서입니다."
            : "모든 문서를 한곳에서 검색하고 관리하세요.",
      );
    else if (currentView === "editor") root.innerHTML = renderEditor();
    if (currentView === "editor" && getDoc(activeDocId)?.kind === "note")
      renderQuickMemoLinkPreviews(
        $("#editorMemoLinkPreviews"),
        getDoc(activeDocId)?.body || "",
      );
    else if (currentView === "boards") root.innerHTML = renderBoards();
    else if (currentView === "board") root.innerHTML = renderBoard();
    else if (currentView === "tags") root.innerHTML = renderTags();
    else if (currentView === "links") root.innerHTML = renderConnections();
    else if (currentView === "settings") root.innerHTML = renderSettings();
    if (["board", "boards"].includes(currentView)) {
    }
    if (currentView === "boards" && state.boards.length) {
      root.querySelector('[data-action="create-nested-board"]')?.remove();
      const actions = $(".page-heading .heading-actions", root);
      if (actions) {
        const select = document.createElement("select");
        select.className = "filter-select";
        select.setAttribute("aria-label", "보드 선택");
        select.innerHTML = state.boards
          .map(
            (b) =>
              `<option value="${b.id}" ${b.id === currentBoardId ? "selected" : ""}>${escapeHtml(b.name)}</option>`,
          )
          .join("");
        select.addEventListener("change", () => openBoard(select.value));
        actions.prepend(select);
      }
    }
    root
      .querySelectorAll("[data-card]")
      .forEach((el) =>
        el.classList.toggle(
          "selected",
          selectedCardIds.includes(el.dataset.card),
        ),
      );
    root
      .querySelectorAll("[data-board-item]")
      .forEach((el) => (el.draggable = true));
    root
      .querySelectorAll("[data-icon]")
      .forEach((el) => (el.innerHTML = ico(el.dataset.icon)));
    if (["board", "boards"].includes(currentView)) {
      wireLinkPreviewImages(root);
      fetchMissingBoardLinkMetadata(currentBoardId);
      drawEdges();
    }
    if (currentView === "editor") wireEditor();
    else if (editorImageResizeHandles.length) {
      editorSelectedImage = null;
      editorImageResizeHandles.forEach((h) => (h.hidden = true));
    }
    if (["board", "boards"].includes(currentView)) wireBoardSketch(root);
    if (["board", "boards"].includes(currentView)) wireBoardLineTools(root);
  }
  function createDoc(kind = "document", title = "", body = "") {
    finishActiveDocumentDraft();
    const t = now(),
      d = {
        id: uid(),
        kind,
        title,
        body,
        tags: [],
        category: "",
        attachments: [],
        createdAt: t,
        updatedAt: t,
      };
    if (kind === "document" && !hasDocumentPayload(d)) activeDocDraft = d;
    else {
      state.docs.unshift(d);
      activeDocDraft = null;
      persist(true);
    }
    activeDocId = d.id;
    saveStatus = "saved";
    currentView = "editor";
    render();
    setTimeout(() => ($("#editorTitle") || $("#editorBody"))?.focus(), 0);
    return d;
  }
  function openDoc(id, blockId) {
    if (activeDocDraft?.id === activeDocId && id !== activeDocId)
      finishActiveDocumentDraft();
    const d = getDoc(id);
    if (!d) return toast("이 기록을 찾을 수 없어요.", true);
    activeDocId = id;
    currentView = "editor";
    connectMode = false;
    connectFrom = null;
    render();
    window.scrollTo(0, 0);
    if (blockId)
      requestAnimationFrame(() => {
        const target = $(
          '#editorBlocks [data-block-id="' + CSS.escape(blockId) + '"]',
        );
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.classList.add("is-linked-target");
          setTimeout(() => target.classList.remove("is-linked-target"), 1800);
        }
      });
  }
  function boardViewportFor(id) {
    const v = getBoard(id)?.viewport || {};
    return {
      x: Number.isFinite(v.x) ? v.x : 0,
      y: Number.isFinite(v.y) ? v.y : 0,
      scale: Number.isFinite(v.scale)
        ? Math.max(0.25, Math.min(3, v.scale))
        : 1,
    };
  }
  function saveBoardViewport() {
    const b = getBoard(currentBoardId);
    if (!b) return;
    b.viewport = {
      x: boardTransform.x,
      y: boardTransform.y,
      scale: boardTransform.scale,
    };
    persist(true);
  }
  function openBoard(id) {
    if (!getBoard(id)) return;
    saveBoardViewport();
    boardDocumentPreviewId = null;
    boardDocumentWindowPosition = null;
    currentBoardId = id;
    state.lastBoardId = id;
    currentView = "boards";
    selectedCard = null;
    selectedCardIds = [];
    selectedEdgeId = null;
    connectMode = false;
    connectFrom = null;
    boardSketchMode = false;
    boardUndoStack = [];
    boardRedoStack = [];
    boardTransform = boardViewportFor(id);
    persist(true);
    render();
  }
  let editorDebounce;
  function openModal(title, body, buttons = "", wide = false) {
    $("#modalRoot").innerHTML =
      `<div class="modal-backdrop" data-backdrop><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="modal-close" data-modal-close aria-label="닫기">×</button></div><div class="modal-body">${body}</div>${buttons ? `<div class="modal-foot">${buttons}</div>` : ""}</div></div>`;
    const backdrop = $("[data-backdrop]");
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    $("[data-modal-close]").addEventListener("click", closeModal);
    setTimeout(
      () => $(".modal input,.modal textarea,.modal select")?.focus(),
      50,
    );
  }
  function closeModal() {
    $("#modalRoot").innerHTML = "";
  }
  function modalButtons(
    cancel = "취소",
    ok = "완료",
    action = "modal-confirm",
  ) {
    return `<button class="btn" data-modal-close>${cancel}</button><button class="btn primary" data-action="${action}">${ok}</button>`;
  }
  let modalConfirm = null;
  function showQuickModal() {
    quickMemoDraftFiles = [];
    modalConfirm = () => {
      const title = $("#quickMemoDraftTitle").value.trim(),
        body = $("#modalBody").value.trim(),
        tags = [
          ...new Set(
            $("#quickMemoDraftTags")
              .value.split(",")
              .map((t) => t.trim().replace(/^#/, ""))
              .filter(Boolean),
          ),
        ];
      if (!title && !body && !quickMemoDraftFiles.length) {
        toast("제목, 내용 또는 파일을 추가해 주세요.", true);
        return false;
      }
      if (category && !state.categories.includes(category))
        state.categories.push(category);
      const createdAt = now(),
        d = {
          id: uid(),
          kind: "note",
          title,
          body,
          tags,
          category,
          attachments: quickMemoDraftFiles.map((file) => ({
            id: uid(),
            type: "file",
            name: file.name,
            mime: file.type || "application/octet-stream",
            size: file.size,
            blob: file,
            createdAt,
          })),
          createdAt,
          updatedAt: createdAt,
        };
      state.docs.unshift(d);
      quickMemoDraftFiles = [];
      persist(true);
      closeModal();
      render();
      toast("Quick Memo를 저장했어요.");
      return true;
    };
    openModal(
      "Quick Memo",
      `<div class="form-group"><label for="quickMemoDraftTitle">제목</label><input id="quickMemoDraftTitle" class="form-control" placeholder="제목을 입력하세요 (선택)"></div><div class="form-group"><label for="modalBody">내용</label><textarea id="modalBody" class="form-control textarea" placeholder="떠오른 생각을 간단히 적어보세요…"></textarea><div id="quickMemoDraftLinkPreviews" class="quick-memo-link-previews"></div></div><div class="form-group"><label for="quickMemoDraftTags">태그</label><input id="quickMemoDraftTags" class="form-control" placeholder="아이디어, 리서치"></div><div class="capture-tools"><button type="button" class="btn small" data-action="quick-memo-draft-file">파일 첨부</button><input id="quickMemoDraftPicker" type="file" multiple hidden></div><div id="quickMemoDraftAttachmentList" class="quick-memo-draft-files"></div>`,
      modalButtons("취소", "Quick Memo 저장", "modal-confirm"),
    );
  }
  function renderQuickMemoDraftFiles() {
    const list = $("#quickMemoDraftAttachmentList");
    if (!list) return;
    list.innerHTML = quickMemoDraftFiles
      .map(
        (file, index) =>
          `<div class="quick-memo-draft-file"><span>${escapeHtml(file.name)}</span><button type="button" data-remove-draft-file="${index}" aria-label="첨부 삭제">×</button></div>`,
      )
      .join("");
  }
  function renderHomeQuickDraftFiles() {
    const list = $("#homeQuickDraftAttachmentList");
    if (!list) return;
    list.innerHTML = homeQuickDraftFiles
      .map(
        (file, index) =>
          `<div class="quick-memo-draft-file"><span>${escapeHtml(file.name)}</span><button type="button" data-remove-home-draft-file="${index}" aria-label="첨부 삭제">×</button></div>`,
      )
      .join("");
  }
  function showCreateBoardModal() {
    modalConfirm = () => {
      const name = $("#boardName").value.trim();
      if (!name) {
        toast("보드 이름을 입력해 주세요.", true);
        return false;
      }
      const b = { id: uid(), name, cards: [], edges: [], updatedAt: now() };
      state.boards.push(b);
      persist(true);
      closeModal();
      openBoard(b.id);
      toast("새 보드를 만들었어요.");
      return true;
    };
    openModal(
      "새 보드 만들기",
      `<div class="form-group"><label for="boardName">보드 이름</label><input id="boardName" class="form-control" maxlength="80" placeholder="예: 프로젝트 아이디어 맵"></div><p class="form-help">보드는 원본 문서를 저장하는 곳이 아니라, 자료를 시각적으로 배치하고 연결하는 공간이에요.</p>`,
      modalButtons("취소", "보드 만들기", "modal-confirm"),
    );
  }
  function showCreateCategory() {
    modalConfirm = () => {
      const name = $("#categoryName").value.trim();
      if (!name) return (toast("카테고리 이름을 입력해 주세요.", true), false);
      if (state.categories.includes(name))
        return (toast("이미 있는 카테고리예요.", true), false);
      state.categories.push(name);
      persist(true);
      closeModal();
      render();
      toast("카테고리를 추가했어요.");
      return true;
    };
    openModal(
      "카테고리 추가",
      `<div class="form-group"><label for="categoryName">카테고리 이름</label><input id="categoryName" class="form-control" maxlength="40" placeholder="예: 프로젝트, 리서치, 일상"></div>`,
      modalButtons("취소", "추가", "modal-confirm"),
    );
  }
  function showBlockBacklinkModal(blockId) {
    const target = getDoc(activeDocId),
      block = editorBlockData(target || {}).find((b) => b.id === blockId);
    if (!target || !block) return;
    const candidates = state.docs.filter(
      (x) =>
        x.id !== target.id &&
        !state.links.some(
          (l) =>
            l.from === x.id && l.to === target.id && l.toBlockId === blockId,
        ),
    );
    const candidateOptions = (kind) =>
      candidates
        .filter((x) => x.kind === kind)
        .map(
          (x) =>
            `<option value="${x.id}">${escapeHtml(x.title || plain(x.body).slice(0, 40) || "제목 없는 기록")}</option>`,
        )
        .join("");
    const candidateGroups = [
      ["메모", candidateOptions("note")],
      ["도큐먼트", candidateOptions("document")],
    ]
      .filter((x) => x[1])
      .map(
        ([label, options]) =>
          `<optgroup label="${label}">${options}</optgroup>`,
      )
      .join("");
    const excerpt = editorBlockPlain(block).slice(0, 120) || "빈 블록";
    modalConfirm = () => {
      const from = $("#blockBacklinkSource").value;
      if (!from) return (toast("참조할 문서를 선택해 주세요.", true), false);
      state.links.push({
        id: uid(),
        from,
        to: target.id,
        toBlockId: blockId,
        context: excerpt,
      });
      persist(true);
      closeModal();
      render();
      toast("블록 백링크를 추가했어요.");
      return true;
    };
    openModal(
      "이 블록의 백링크 만들기",
      candidates.length
        ? `<div class="form-group"><label>대상 블록</label><div class="form-help">${escapeHtml(excerpt)}</div></div><div class="form-group"><label for="blockBacklinkSource">이 블록을 참조할 문서</label><select class="form-control" id="blockBacklinkSource">${candidateGroups}</select></div><div class="form-help">선택한 문서에서 현재 블록으로 연결하고, 이 블록 아래에 백링크를 표시합니다.</div>`
        : `<div class="empty" style="padding:20px"><h3>연결할 문서가 없어요</h3><p>다른 문서를 먼저 만들어 주세요.</p></div>`,
      candidates.length
        ? modalButtons("취소", "블록 연결", "modal-confirm")
        : `<button class="btn" data-modal-close>닫기</button>`,
    );
  }
  function showLinkModal() {
    const d = getDoc(activeDocId);
    if (!d) return;
    const candidates = state.docs.filter(
      (x) =>
        x.id !== d.id &&
        x.kind === "document" &&
        !state.links.some((l) => l.from === d.id && l.to === x.id),
    );
    modalConfirm = () => {
      const to = $("#linkTarget").value;
      if (!to) return (toast("연결할 문서를 선택해 주세요.", true), false);
      if (state.links.some((l) => l.from === d.id && l.to === to))
        return (toast("이미 연결된 문서예요.", true), false);
      state.links.push({ id: uid(), from: d.id, to, context: "" });
      persist(true);
      closeModal();
      render();
      toast("문서 연결을 추가했어요.");
      return true;
    };
    openModal(
      "관련 문서 연결",
      candidates.length
        ? `<div class="form-group"><label for="linkTarget">참조할 문서</label><select class="form-control" id="linkTarget">${candidates.map((x) => `<option value="${x.id}">${escapeHtml(x.title || plain(x.body).slice(0, 40) || "제목 없는 문서")}</option>`).join("")}</select></div><div class="form-help">이 문서가 선택한 문서를 참조합니다. 대상 문서의 백링크에 현재 문서가 자동으로 나타납니다.</div>`
        : `<div class="empty" style="padding:20px"><h3>연결할 문서가 없어요</h3><p>다른 문서를 먼저 만들어 주세요.</p></div>`,
      candidates.length
        ? modalButtons("취소", "연결 추가", "modal-confirm")
        : `<button class="btn" data-modal-close>닫기</button>`,
    );
  }
  function showAppendModal() {
    const d = getDoc(activeDocId);
    const notesList = notes().filter((n) => n.id !== d?.id);
    if (!d) return;
    modalConfirm = () => {
      const note = getDoc($("#appendTarget").value);
      if (!note) return (toast("편입할 메모를 선택해 주세요.", true), false);
      const fragment =
        (note.title ? `## ${note.title}\n\n` : "") + (note.body || "");
      d.body = (d.body ? d.body + "\n\n---\n\n" : "") + fragment;
      d.updatedAt = now();
      note.kind = "note";
      note.title = note.title || "";
      persist(true);
      closeModal();
      render();
      toast("메모 내용을 문서에 편입했어요. 원본 메모는 유지됩니다.");
      return true;
    };
    openModal(
      "기존 문서에 메모 편입",
      notesList.length
        ? `<div class="form-group"><label for="appendTarget">편입할 메모</label><select id="appendTarget" class="form-control">${notesList.map((n) => `<option value="${n.id}">${escapeHtml(n.title || plain(n.body).slice(0, 55) || "제목 없는 메모")}</option>`).join("")}</select></div><div class="form-help">메모의 내용은 현재 문서 끝에 추가되며, 원본 메모도 별도로 유지됩니다.</div>`
        : `<div class="empty" style="padding:20px"><h3>편입할 메모가 없습니다</h3></div>`,
      notesList.length
        ? modalButtons("취소", "내용 편입", "modal-confirm")
        : `<button class="btn" data-modal-close>닫기</button>`,
    );
  }
  function showAddBoardCardModal() {
    const b = getBoard(currentBoardId);
    if (!b) return;
    const candidates = state.docs;
    modalConfirm = () => {
      const id = $("#boardDocTarget").value;
      if (!id) return (toast("추가할 기록을 선택해 주세요.", true), false);
      if (b.cards.some((c) => c.targetId === id))
        return (toast("이 보드에 이미 추가된 기록이에요.", true), false);
      let x = 160,
        y = 150;
      const n = b.cards.length;
      x += (n % 3) * 310;
      y += Math.floor(n / 3) * 235;
      b.cards.push({ id: uid(), type: "doc", targetId: id, x, y });
      b.updatedAt = now();
      persist(true);
      closeModal();
      render();
      toast("보드에 카드를 추가했어요.");
      return true;
    };
    openModal(
      "보드에 카드 추가",
      candidates.length
        ? `<div class="form-group"><label for="boardDocTarget">기록 선택</label><select id="boardDocTarget" class="form-control">${candidates.map((d) => `<option value="${d.id}">${d.kind === "note" ? "[메모]" : "[문서]"} ${escapeHtml(d.title || plain(d.body).slice(0, 50) || "제목 없는 기록")}</option>`).join("")}</select></div><div class="form-help">원본 문서와 메모는 그대로 유지되고, 보드에는 참조 카드만 추가됩니다.</div>`
        : `<div class="empty" style="padding:20px"><h3>먼저 기록을 만들어주세요</h3></div>`,
      candidates.length
        ? modalButtons("취소", "카드 추가", "modal-confirm")
        : `<button class="btn" data-modal-close>닫기</button>`,
    );
  }
  function showUrlModal() {
    const d = getDoc(activeDocId);
    if (!d) return;
    modalConfirm = () => {
      let url = $("#urlInput").value.trim();
      if (!url) return (toast("URL을 입력해 주세요.", true), false);
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try {
        new URL(url);
      } catch (e) {
        return (toast("올바른 URL을 입력해 주세요.", true), false);
      }
      const name = $("#urlTitle").value.trim() || new URL(url).hostname;
      d.attachments = d.attachments || [];
      d.attachments.push({ id: uid(), type: "url", name, url });
      d.updatedAt = now();
      persist(true);
      closeModal();
      render();
      toast("링크를 첨부했어요.");
      return true;
    };
    openModal(
      "외부 링크 첨부",
      `<div class="form-group"><label for="urlInput">URL</label><input id="urlInput" class="form-control" type="url" placeholder="https://example.com"></div><div class="form-group"><label for="urlTitle">표시 이름 (선택)</label><input id="urlTitle" class="form-control" placeholder="링크를 설명하는 이름"></div><div class="form-help">이 버전에서는 URL과 표시 이름을 저장합니다. 웹페이지 제목이나 썸네일을 자동으로 가져오지는 않습니다.</div>`,
      modalButtons("취소", "링크 첨부", "modal-confirm"),
    );
  }
  function attachFiles(accept = "") {
    if (!getDoc(activeDocId)) return;
    if (getDoc(activeDocId)?.kind === "document") saveEditorSelection();
    pendingAttachDoc = activeDocId;
    const picker = $("#filePicker");
    picker.accept = accept;
    picker.value = "";
    picker.click();
  }
  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(reader.error || new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  }
  async function resizeDocumentImage(file) {
    if (!file.type.startsWith("image/")) return fileAsDataUrl(file);
    const source = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = source;
      });
      const maxSide = 1800,
        scale = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth, image.naturalHeight),
        );
      if (scale === 1 && file.size < 1200000) return fileAsDataUrl(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, mime, mime === "image/jpeg" ? 0.84 : undefined),
      );
      if (!blob) throw new Error("Image resize failed");
      return fileAsDataUrl(blob);
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  function insertDocumentFileHtml(html) {
    const root = $("#editorBlocks");
    if (!root) return;
    restoreEditorSelection();
    let range = getSelection()?.rangeCount
      ? getSelection().getRangeAt(0)
      : null;
    if (!range || !root.contains(range.commonAncestorContainer)) {
      const content = editorContent(
        root.querySelector(".editor-block:last-child"),
      );
      range = document.createRange();
      range.selectNodeContents(content || root);
      range.collapse(false);
    }
    if (!editorBlockForNode(range.startContainer)) {
      const block = root.querySelector(".editor-block:last-child"),
        content = editorContent(block);
      range.selectNodeContents(content);
      range.collapse(false);
    }
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    const last = fragment.lastChild;
    range.insertNode(fragment);
    const sel = getSelection();
    if (last) {
      const caret = document.createRange();
      caret.setStartAfter(last);
      caret.collapse(true);
      sel.removeAllRanges();
      sel.addRange(caret);
    }
    updateDocFromEditor();
  }
  async function handleFiles(files) {
    const d = getDoc(pendingAttachDoc);
    if (!d || !files?.length) return;
    const accepted = Array.from(files).filter(
      (file) => file.size <= 30 * 1024 * 1024,
    );
    for (const file of files)
      if (file.size > 30 * 1024 * 1024)
        toast(file.name + ": 30MB limit; skipped.", true);
    if (d.kind === "document") {
      restoreEditorSelection();
      for (const file of accepted) {
        try {
          const data = await resizeDocumentImage(file),
            safeName = escapeHtml(file.name),
            html = file.type.startsWith("image/")
              ? '<img src="' +
                data +
                '" alt="' +
                safeName +
                '" style="max-width:100%;height:auto">'
              : '<a href="' +
                data +
                '" download="' +
                safeName +
                '">' +
                safeName +
                "</a>";
          insertDocumentFileHtml(html);
        } catch (error) {
          toast(file.name + ": could not insert file.", true);
        }
      }
      if (activeDocDraft?.id === d.id && hasDocumentPayload(d)) {
        activeDocDraft = null;
        state.docs.unshift(d);
      }
      persist(true);
      if (currentView === "editor") render();
      toast(accepted.length + " file(s) inserted into the document.");
      pendingAttachDoc = null;
      return;
    }
    d.attachments = d.attachments || [];
    for (const file of accepted)
      d.attachments.push({
        id: uid(),
        type: "file",
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        blob: file,
        createdAt: now(),
      });
    d.updatedAt = now();
    if (activeDocDraft?.id === d.id && hasDocumentPayload(d)) {
      activeDocDraft = null;
      state.docs.unshift(d);
    }
    persist(true);
    if (currentView === "editor") render();
    toast(accepted.length + " file(s) attached.");
    pendingAttachDoc = null;
  }
  function exportData() {
    const backup = {
      ...state,
      exportedAt: now(),
      exportFormat: "folio-backup-v1",
    }; // File blobs are converted to data URLs for portable backup.
    const files = [];
    state.docs.forEach((d) =>
      (d.attachments || []).forEach((a) => {
        if (a.blob instanceof Blob)
          files.push({
            scope: "doc",
            ownerId: d.id,
            attachmentId: a.id,
            blob: a.blob,
          });
      }),
    );
    state.boards.forEach((b) =>
      (b.cards || []).forEach((c) => {
        if (c.attachment?.blob instanceof Blob)
          files.push({
            scope: "board",
            ownerId: b.id,
            cardId: c.id,
            attachmentId: c.attachment.id,
            blob: c.attachment.blob,
          });
      }),
    );
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ ...file, data: r.result });
            r.onerror = () => resolve({ ...file, data: null });
            r.readAsDataURL(file.blob);
          }),
      ),
    ).then((results) => {
      const resultFor = (scope, ownerId, attachmentId, cardId) =>
        results.find(
          (x) =>
            x.scope === scope &&
            x.ownerId === ownerId &&
            x.attachmentId === attachmentId &&
            (scope !== "board" || x.cardId === cardId),
        );
      backup.docs = backup.docs.map((d) => ({
        ...d,
        attachments: (d.attachments || []).map((a) => {
          const r = resultFor("doc", d.id, a.id);
          if (r?.data) {
            const { blob, ...rest } = a;
            return { ...rest, dataUrl: r.data };
          }
          return a;
        }),
      }));
      backup.boards = backup.boards.map((b) => ({
        ...b,
        cards: (b.cards || []).map((c) => {
          const a = c.attachment,
            r = a && resultFor("board", b.id, a.id, c.id);
          if (r?.data) {
            const { blob, ...rest } = a;
            return { ...c, attachment: { ...rest, dataUrl: r.data } };
          }
          return c;
        }),
      }));
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      downloadBlob(
        blob,
        "untit-backup-" + new Date().toISOString().slice(0, 10) + ".json",
      );
      toast("백업 파일을 만들었어요.");
    });
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function importData() {
    const input = $("#importPicker");
    if (input) input.click();
  }
  async function readImport(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (
        !parsed ||
        !Array.isArray(parsed.docs) ||
        !Array.isArray(parsed.boards) ||
        !Array.isArray(parsed.links)
      )
        throw new Error("지원하지 않는 백업 형식입니다.");
      const restoreAttachment = (a) => {
        if (!a?.dataUrl) return a;
        const [head, content] = a.dataUrl.split(","),
          mime =
            (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream",
          raw = atob(content),
          bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        const { dataUrl, ...rest } = a;
        return { ...rest, blob: new Blob([bytes], { type: mime }) };
      };
      const converted = {
        ...parsed,
        docs: parsed.docs.map((d) => ({
          ...d,
          attachments: (d.attachments || []).map(restoreAttachment),
        })),
        boards: parsed.boards.map((b) => ({
          ...b,
          cards: (b.cards || []).map((c) =>
            c.attachment?.dataUrl
              ? { ...c, attachment: restoreAttachment(c.attachment) }
              : c,
          ),
        })),
      };
      const yes = confirm(
        "가져온 데이터로 현재 로컬 데이터를 교체할까요? 먼저 현재 데이터를 내보내는 것을 권장합니다.",
      );
      if (!yes) return;
      state = converted;
      persist(true);
      render();
      toast("백업을 복원했어요.");
    } catch (e) {
      toast("백업을 읽지 못했어요: " + e.message, true);
    }
  }
  function resetData() {
    if (
      !confirm(
        "현재 브라우저의 모든 데이터를 삭제하고 샘플 데이터로 되돌릴까요? 이 작업은 되돌릴 수 없습니다.",
      )
    )
      return;
    state = seed();
    activeDocId = null;
    currentBoardId = null;
    currentView = "home";
    boardTransform = { x: 0, y: 0, scale: 1 };
    persist(true);
    render();
    toast("샘플 데이터로 초기화했어요.");
  }
  function insertFormat(format) {
    if (format !== "link") return;
    saveEditorSelection();
    restoreEditorSelection();
    const sel = getSelection(),
      range = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    const selected = range?.toString() || "";
    modalConfirm = () => {
      let url = $("#insertLinkUrl").value.trim();
      if (!url) return (toast("URL을 입력해 주세요.", true), false);
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      try {
        new URL(url);
      } catch (e) {
        return (toast("올바른 URL을 입력해 주세요.", true), false);
      }
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      if (
        range &&
        $("#editorBlocks")?.contains(range.commonAncestorContainer)
      ) {
        link.append(range.extractContents());
        range.insertNode(link);
        const r = document.createRange();
        r.setStartAfter(link);
        r.collapse(true);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
      }
      updateDocFromEditor();
      closeModal();
      return true;
    };
    openModal(
      "선택한 텍스트에 링크 삽입",
      '<div class="form-group"><label for="insertLinkUrl">URL</label><input id="insertLinkUrl" class="form-control" type="url" placeholder="https://example.com"></div>',
      modalButtons("취소", "삽입", "modal-confirm"),
    );
  }
  function boardVisibleCenter() {
    const wrap = $("#boardWrap");
    if (!wrap) return { x: 150, y: 140 };
    const x = (wrap.clientWidth / 2 - boardTransform.x) / boardTransform.scale,
      y = (wrap.clientHeight / 2 - boardTransform.y) / boardTransform.scale;
    return {
      x: Math.max(0, Math.min(1982, x - 109)),
      y: Math.max(0, Math.min(1479, y - 60)),
    };
  }
  function showCreateNestedBoardModal() {
    const parent = getBoard(currentBoardId);
    if (!parent) return;
    modalConfirm = () => {
      const name = $("#nestedBoardName").value.trim();
      if (!name) {
        toast("보드 이름을 입력해 주세요.", true);
        return false;
      }
      saveBoardHistory();
      const child = {
        id: uid(),
        name,
        parentId: parent.id,
        cards: [],
        edges: [],
        updatedAt: now(),
      };
      state.boards.push(child);
      const n = parent.cards.length,
        pt = boardDropPosition || boardVisibleCenter();
      parent.cards.push({
        id: uid(),
        type: "board",
        boardId: child.id,
        x: pt.x,
        y: pt.y,
      });
      parent.updatedAt = now();
      boardDropPosition = null;
      persist(true);
      closeModal();
      render();
      toast("현재 보드에 새 보드 요소를 추가했어요.");
      return true;
    };
    openModal(
      "보드 추가",
      `<div class="form-group"><label for="nestedBoardName">새 보드 이름</label><input id="nestedBoardName" class="form-control" maxlength="80" placeholder="예: 조사 자료"></div><p class="form-help">현재 보드에 새 보드로 들어가는 카드를 추가합니다.</p>`,
      modalButtons("취소", "보드 추가", "modal-confirm"),
    );
  }
  function closeBoardToolMenus() {
    boardSketchMode = false;
    connectMode = false;
    connectFrom = null;
    selectedEdgeId = null;
    $("#viewRoot .board-sketch-tools")?.remove();
    $("#viewRoot .board-line-tools")?.remove();
    $$("[data-board-item=line],[data-board-item=sketch]").forEach((el) =>
      el.classList.remove("active"),
    );
  }
  function attachBoardFiles(files) {
    const board = getBoard(currentBoardId);
    if (!board || !files?.length) return;
    const accepted = Array.from(files).filter((file) => {
      if (file.size > 30 * 1024 * 1024) {
        toast(file.name + ": 30MB를 초과해 건너뛰었어요.", true);
        return false;
      }
      return true;
    });
    if (!accepted.length) return;
    saveBoardHistory();
    const center = boardVisibleCenter();
    accepted.forEach((file, index) => {
      const createdAt = now(),
        cardId = uid(),
        attachment = {
          id: uid(),
          type: "file",
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          blob: file,
          createdAt,
        },
        offset = index * 32;
      board.cards.push({
        id: cardId,
        type: "attachment",
        attachment,
        x: center.x + offset,
        y: center.y + offset,
      });
    });
    board.updatedAt = now();
    persist(true);
    render();
    toast(accepted.length + "개 파일을 보드에 첨부했어요.");
  }
  function addBoardItem(type, position) {
    const b = getBoard(currentBoardId);
    if (!b) return;
    if (type === "line") {
      const enable = !connectMode;
      closeBoardToolMenus();
      connectMode = enable;
      $$("[data-board-item=line]").forEach((el) =>
        el.classList.toggle("active", connectMode),
      );
      render();
      toast(
        connectMode
          ? "연결할 요소에서 다른 요소까지 드래그하세요."
          : "선 그리기를 종료했어요.",
      );
      return;
    }
    if (type === "sketch") {
      const enable = !boardSketchMode;
      closeBoardToolMenus();
      boardSketchMode = enable;
      $$("[data-board-item=sketch]").forEach((el) =>
        el.classList.toggle("active", boardSketchMode),
      );
      render();
      return;
    }
    closeBoardToolMenus();
    if (type === "link") {
      showBoardItemModal(type, position);
      return;
    }
    if (
      ![
        "note",
        "todo",
        "column",
        "file",
        "table",
        "comment",
        "video",
        "image",
      ].includes(type)
    )
      return;
    saveBoardHistory();
    const pt = position || boardVisibleCenter();
    b.cards.push({
      id: uid(),
      type,
      content: "",
      url: "",
      x: pt.x,
      y: pt.y,
      checked: false,
    });
    b.updatedAt = now();
    persist(true);
    render();
    toast("보드에 추가했어요. 요소를 클릭해 내용을 입력하세요.");
  }
  function youtubeVideoId(value) {
    try {
      const url = new URL(safeExternalUrl(value));
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtu.be") {
        const id = url.pathname.split("/").filter(Boolean)[0] || "";
        return /^[\w-]{11}$/.test(id) ? id : "";
      }
      if (
        ![
          "youtube.com",
          "m.youtube.com",
          "music.youtube.com",
          "youtube-nocookie.com",
        ].includes(host)
      )
        return "";
      let id = url.searchParams.get("v") || "";
      if (!id) {
        const match = url.pathname.match(
          /^\/(?:shorts|embed|live|v)\/([\w-]{11})(?:\/|$)/,
        );
        id = match?.[1] || "";
      }
      return /^[\w-]{11}$/.test(id) ? id : "";
    } catch (_) {
      return "";
    }
  }
  function youtubeThumbnail(url) {
    const id = youtubeVideoId(url);
    return id ? "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg" : "";
  }
  function linkPreviewImageEndpoint(url) {
    const youtubeImage = youtubeThumbnail(url);
    if (youtubeImage) return youtubeImage;
    const endpoint = new URL("https://api.microlink.io/");
    endpoint.searchParams.set("url", safeExternalUrl(url));
    endpoint.searchParams.set("embed", "image.url");
    endpoint.searchParams.set("prerender", "false");
    return endpoint.href;
  }
  function linkPreviewProxyEndpoint(imageUrl) {
    const endpoint = new URL("https://images.weserv.nl/");
    endpoint.searchParams.set("url", safeExternalUrl(imageUrl));
    return endpoint.href;
  }
  async function fetchYouTubeLinkMetadata(url) {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("format", "json");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error("YouTube metadata unavailable");
      const data = await response.json();
      return {
        title: String(data.title || "").trim(),
        description: "",
        image:
          youtubeThumbnail(url) || safeExternalUrl(data.thumbnail_url || ""),
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async function fetchMicrolinkBoardMetadata(url) {
    const endpoint = new URL("https://api.microlink.io/");
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("prerender", "false");
    endpoint.searchParams.set("filter", "title,description,image");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error("metadata request failed");
      const result = await response.json();
      if (result.status !== "success" || !result.data)
        throw new Error("metadata unavailable");
      const data = result.data;
      return {
        title: String(data.title || "").trim(),
        description: String(data.description || "").trim(),
        image: safeExternalUrl(
          typeof data.image === "string" ? data.image : data.image?.url || "",
        ),
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async function fetchBoardLinkMetadata(url) {
    if (youtubeVideoId(url)) {
      const youtube = await fetchYouTubeLinkMetadata(url).catch(() => ({}));
      return {
        title: youtube.title || "",
        description: "",
        image: youtubeThumbnail(url) || youtube.image || "",
      };
    }
    return fetchMicrolinkBoardMetadata(url);
  }
  function fetchMissingBoardLinkMetadata(boardId) {
    boardLinkObserver?.disconnect();
    const board = getBoard(boardId),
      wrap = $("#boardWrap");
    if (!board || !wrap || !("IntersectionObserver" in window)) return;
    boardLinkObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const cardId = entry.target.dataset.card;
          boardLinkObserver.unobserve(entry.target);
          const key = boardId + ":" + cardId;
          if (pendingBoardLinkMetadata.has(key)) continue;
          pendingBoardLinkMetadata.add(key);
          const item = getBoard(boardId)?.cards.find((x) => x.id === cardId),
            url = safeExternalUrl(item?.url);
          if (!item || !url) {
            pendingBoardLinkMetadata.delete(key);
            continue;
          }
          fetchBoardLinkMetadata(url)
            .then((meta) => {
              const latest = getBoard(boardId),
                target = latest?.cards.find((x) => x.id === cardId);
              if (!target || safeExternalUrl(target.url) !== url) return;
              target.content = meta.title || target.content;
              target.description = meta.description || target.description || "";
              target.previewImage =
                meta.image || youtubeThumbnail(url) || target.previewImage;
              target.previewMetadataFetched = true;
              latest.updatedAt = now();
              persist(true);
              if (currentBoardId === boardId && currentView === "board")
                render();
            })
            .catch(() => {
              const latest = getBoard(boardId),
                target = latest?.cards.find((x) => x.id === cardId);
              if (target && safeExternalUrl(target.url) === url) {
                target.previewMetadataFetched = true;
                persist(true);
              }
            })
            .finally(() => pendingBoardLinkMetadata.delete(key));
        }
      },
      { root: wrap, rootMargin: "250px" },
    );
    for (const card of board.cards || []) {
      if (
        card.type !== "link" ||
        !safeExternalUrl(card.url) ||
        (card.previewImage && !youtubeVideoId(card.url)) ||
        card.previewMetadataFetched
      )
        continue;
      const node = [...wrap.querySelectorAll(".link-preview")].find(
        (el) => el.dataset.card === card.id,
      );
      if (node) boardLinkObserver.observe(node);
    }
  }
  function wireLinkPreviewImages(root) {
    root.querySelectorAll(".link-preview-image").forEach((img) => {
      img.dataset.originalSrc = img.getAttribute("src") || img.src;
      img.addEventListener("error", () => {
        const card = img.closest("[data-card]"),
          item = getBoard(currentBoardId)?.cards.find(
            (c) => c.id === card?.dataset.card,
          );
        if (!item?.url) {
          img.remove();
          return;
        }
        const stage = Number(img.dataset.fallbackStage || 0);
        if (stage === 0 && !youtubeVideoId(item.url)) {
          img.dataset.fallbackStage = "1";
          img.src = linkPreviewImageEndpoint(item.url);
          return;
        }
        if (stage < 2) {
          img.dataset.fallbackStage = "2";
          img.src = linkPreviewProxyEndpoint(
            item.previewImage || img.dataset.originalSrc || item.url,
          );
          return;
        }
        img.replaceWith(
          Object.assign(document.createElement("div"), {
            className: "link-preview-placeholder",
            innerHTML: "<span>미리보기 이미지를 불러오지 못했어요</span>",
          }),
        );
      });
    });
  }
  function showBoardItemModal(type, position, itemId) {
    const labels = {
      note: "메모",
      link: "링크",
      todo: "할 일",
      column: "컬럼",
      sketch: "스케치 메모",
      file: "문서 링크",
      audio: "오디오 링크",
      table: "표",
      comment: "코멘트",
      video: "비디오 링크",
      image: "이미지 링크",
    };
    const board = getBoard(currentBoardId),
      item = itemId ? board?.cards.find((c) => c.id === itemId) : null,
      needsUrl = ["link", "file", "audio", "video", "image"].includes(type),
      content = item?.content || "",
      url = item?.url || "";
    const fields =
      type === "link"
        ? `<div class="form-group"><label for="boardItemUrl">링크 주소</label><input id="boardItemUrl" class="form-control" type="url" value="${escapeHtml(url)}" placeholder="https://example.com"></div><p class="form-help">주소를 저장하면 페이지의 제목, 설명, 미리보기 이미지를 자동으로 가져옵니다.</p>`
        : type === "table"
          ? `<div class="form-group"><label for="boardItemContent">표 내용 (행마다 입력, 열은 쉼표로 구분)</label><textarea id="boardItemContent" class="form-control textarea" placeholder="항목 1, 항목 2&#10;내용, 내용">${escapeHtml(content)}</textarea></div>`
          : needsUrl
            ? `<div class="form-group"><label for="boardItemUrl">${labels[type]} URL</label><input id="boardItemUrl" class="form-control" type="url" value="${escapeHtml(url)}" placeholder="https://example.com"></div><div class="form-group"><label for="boardItemContent">설명 (선택)</label><textarea id="boardItemContent" class="form-control textarea" placeholder="간단한 설명">${escapeHtml(content)}</textarea></div>`
            : `<div class="form-group"><label for="boardItemContent">${type === "column" ? "컬럼 이름" : "내용"}</label><textarea id="boardItemContent" class="form-control textarea" placeholder="${labels[type]} 내용을 입력하세요">${escapeHtml(content)}</textarea></div>`;
    modalConfirm = () => {
      let nextContent =
          type === "link" ? "" : $("#boardItemContent")?.value.trim() || "",
        nextUrl = $("#boardItemUrl")?.value.trim() || "";
      if (needsUrl) {
        if (!nextUrl) return (toast("URL을 입력해 주세요.", true), false);
        nextUrl = safeExternalUrl(nextUrl);
        if (!nextUrl)
          return (toast("올바른 URL을 입력해 주세요.", true), false);
      }
      const current = getBoard(currentBoardId);
      if (!current) return false;
      let target = itemId ? current.cards.find((c) => c.id === itemId) : null;
      if (itemId && !target) return false;
      saveBoardHistory();
      if (!target) {
        const n = current.cards.length,
          pt = position || boardVisibleCenter();
        target = {
          id: uid(),
          type,
          content: "",
          url: "",
          x: pt.x,
          y: pt.y,
          checked: false,
        };
        current.cards.push(target);
      }
      target.content = nextContent;
      target.url = nextUrl;
      if (type === "link") {
        target.description = "";
        target.previewImage = "";
        target.previewMetadataFetched = true;
      }
      target.updatedAt = now();
      current.updatedAt = now();
      const cardId = target.id,
        boardId = current.id;
      persist(true);
      closeModal();
      render();
      toast(
        type === "link"
          ? "링크 미리보기를 가져오는 중이에요."
          : "내용을 저장했어요.",
      );
      if (type === "link") {
        fetchBoardLinkMetadata(nextUrl)
          .then((meta) => {
            const latest = getBoard(boardId),
              card = latest?.cards.find((c) => c.id === cardId);
            if (!card || card.url !== nextUrl) return;
            saveBoardHistory();
            card.content =
              meta.title || card.content || new URL(nextUrl).hostname;
            card.description = meta.description || card.description || "";
            card.previewImage =
              meta.image || youtubeThumbnail(nextUrl) || card.previewImage;
            card.updatedAt = now();
            latest.updatedAt = now();
            persist(true);
            render();
          })
          .catch(() =>
            toast(
              "페이지 정보를 가져오지 못했어요. 링크는 저장했으며 제목과 이미지 없이 표시됩니다.",
              true,
            ),
          );
      }
      return true;
    };
    openModal(
      itemId ? `${labels[type]} 편집` : `${labels[type]} 추가`,
      fields,
      modalButtons("취소", itemId ? "저장" : "추가", "modal-confirm"),
    );
  }
  function addBoardImage(imageData, url = "", position) {
    const b = getBoard(currentBoardId);
    if (!b) return;
    saveBoardHistory();
    const n = b.cards.length,
      pt = position || boardVisibleCenter();
    b.cards.push({
      id: uid(),
      type: "image",
      content: "",
      url,
      imageData,
      x: pt.x,
      y: pt.y,
      checked: false,
    });
    b.updatedAt = now();
    persist(true);
    render();
    toast("이미지를 보드에 추가했어요.");
  }
  function showImageInsertModal() {
    let imageData = "";
    openModal(
      "이미지 추가",
      `<div class="form-group"><label for="boardImageFile">이미지 파일</label><input id="boardImageFile" class="form-control" type="file" accept="image/*"><div class="form-help">이미지를 선택하거나 아래에 이미지 주소를 입력하세요.</div></div><div class="form-group"><label for="boardImageUrl">이미지 링크</label><input id="boardImageUrl" class="form-control" type="url" placeholder="https://example.com/image.png"></div>`,
      modalButtons("취소", "추가", "modal-confirm"),
    );
    $("#boardImageFile").addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (!f.type.startsWith("image/")) {
        toast("이미지 파일을 선택해 주세요.", true);
        return;
      }
      const reader = new FileReader(),
        submit = $('[data-action="modal-confirm"]');
      if (submit) submit.disabled = true;
      reader.onload = () => {
        imageData = reader.result;
        if (submit) submit.disabled = false;
      };
      reader.onerror = () => {
        if (submit) submit.disabled = false;
        toast("이미지를 읽지 못했어요.", true);
      };
      reader.readAsDataURL(f);
    });
    modalConfirm = () => {
      const url = $("#boardImageUrl").value.trim();
      if (!imageData && !url)
        return (toast("이미지 파일 또는 링크를 선택해 주세요.", true), false);
      if (url && !/^https?:\/\//i.test(url))
        return (
          toast("http 또는 https 이미지 링크를 입력해 주세요.", true),
          false
        );
      if (url)
        try {
          new URL(url);
        } catch (e) {
          return (toast("올바른 이미지 링크를 입력해 주세요.", true), false);
        }
      closeModal();
      addBoardImage(imageData, url);
      return true;
    };
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  let inlineBoardEditId = null;
  function saveInlineBoardItem() {
    const b = getBoard(currentBoardId),
      item = b?.cards.find((c) => c.id === inlineBoardEditId);
    if (!item) return;
    const content = $("#boardInlineContent")?.value ?? item.content,
      url = $("#boardInlineUrl")?.value ?? item.url;
    saveBoardHistory();
    item.content = content.trim();
    item.url = url.trim();
    item.updatedAt = now();
    b.updatedAt = now();
    inlineBoardEditId = null;
    persist(true);
    render();
    toast("내용을 저장했어요.");
  }
  function startInlineBoardEdit(id) {
    const b = getBoard(currentBoardId),
      item = b?.cards.find((c) => c.id === id);
    if (!item) return;
    inlineBoardEditId = id;
    const el = $(`[data-card="${id}"]`);
    if (!el) return;
    const urlTypes = ["link", "file", "audio", "video", "image"];
    el.innerHTML = `<div class="item-head">${escapeHtml(item.type)} 편집</div>${urlTypes.includes(item.type) ? `<input id="boardInlineUrl" class="form-control" placeholder="https://…" value="${escapeHtml(item.url || "")}">` : ""}<textarea id="boardInlineContent" class="form-control textarea" placeholder="내용 입력">${escapeHtml(item.content || "")}</textarea><div class="item-actions"><button class="btn small" data-inline-cancel>취소</button><button class="btn small primary" data-inline-save>저장</button></div>`;
    $("#boardInlineContent")?.focus();
  }
  function removeSelectedCard() {
    const b = getBoard(currentBoardId);
    if (!b || !selectedCardIds.length) return;
    saveBoardHistory();
    if (selectedCardIds.includes(BOARD_DRAWING_ID)) {
      b.drawingData = "";
      b.drawingBounds = null;
    }
    const strokeIds = selectedCardIds
        .filter((id) => id.startsWith(SKETCH_STROKE_PREFIX))
        .map((id) => id.slice(SKETCH_STROKE_PREFIX.length)),
      ids = selectedCardIds.filter(
        (id) => id !== BOARD_DRAWING_ID && !id.startsWith(SKETCH_STROKE_PREFIX),
      );
    b.strokes = (b.strokes || []).filter(
      (stroke) => !strokeIds.includes(stroke.id),
    );
    b.cards = b.cards.filter((c) => !ids.includes(c.id));
    b.edges = b.edges.filter(
      (e) => !ids.includes(e.from) && !ids.includes(e.to),
    );
    selectedCard = null;
    selectedCardIds = [];
    b.updatedAt = now();
    persist(true);
    render();
  }
  function boardStrokeBounds(stroke) {
    const points = stroke.points || [];
    if (!points.length) return null;
    const pad = Math.max(1, (Number(stroke.width) || 4) / 2);
    return {
      left: Math.min(...points.map((p) => p.x)) - pad,
      right: Math.max(...points.map((p) => p.x)) + pad,
      top: Math.min(...points.map((p) => p.y)) - pad,
      bottom: Math.max(...points.map((p) => p.y)) + pad,
    };
  }
  function boardStrokePath(stroke) {
    const pts = Array.isArray(stroke.points) ? stroke.points : [];
    if (!pts.length) return "";
    const a = pts[0],
      z = pts[pts.length - 1],
      n = pts.length === 1 ? { x: a.x + 0.1, y: a.y } : z;
    if (stroke.tool === "rect")
      return (
        "M " +
        a.x +
        " " +
        a.y +
        " L " +
        n.x +
        " " +
        a.y +
        " L " +
        n.x +
        " " +
        n.y +
        " L " +
        a.x +
        " " +
        n.y +
        " Z"
      );
    if (stroke.tool === "circle") {
      const rx = Math.abs(n.x - a.x) / 2,
        ry = Math.abs(n.y - a.y) / 2,
        cx = (a.x + n.x) / 2,
        cy = (a.y + n.y) / 2;
      return (
        "M " +
        (cx - rx) +
        " " +
        cy +
        " A " +
        rx +
        " " +
        ry +
        " 0 1 0 " +
        (cx + rx) +
        " " +
        cy +
        " A " +
        rx +
        " " +
        ry +
        " 0 1 0 " +
        (cx - rx) +
        " " +
        cy
      );
    }
    return "M " + pts.map((p) => p.x + " " + p.y).join(" L ");
  }
  function renderBoardSketchStrokes(svg, strokes) {
    if (!svg) return;
    svg.innerHTML = (strokes || [])
      .map((stroke) => {
        const id = escapeHtml(stroke.id),
          d = boardStrokePath(stroke),
          width = Math.max(1, Number(stroke.width) || 4),
          color = escapeHtml(stroke.color || "#222222");
        return (
          '<g class="board-sketch-stroke" data-sketch-stroke="' +
          id +
          '"><path class="board-sketch-hit" d="' +
          d +
          '" stroke="transparent" stroke-width="' +
          Math.max(14, width + 10) +
          '" fill="none" pointer-events="stroke"/><path class="board-sketch-path" d="' +
          d +
          '" stroke="' +
          color +
          '" stroke-width="' +
          width +
          '" fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/></g>'
        );
      })
      .join("");
    updateBoardSelectionStyles();
  }
  function placeBoardSubmenu(root, bar) {
    const toolbar = $(".board-toolbar", root),
      stage = $(".board-stage", root);
    if (!toolbar || !stage) return;
    stage.append(bar);
    const tr = toolbar.getBoundingClientRect(),
      sr = stage.getBoundingClientRect();
    bar.style.left = Math.max(8, tr.left - sr.left + 8) + "px";
    bar.style.top = tr.bottom - sr.top + 8 + "px";
  }
  function loadBoardLineSettings(edge) {
    if (!edge) return;
    const legacy = edge.style;
    boardLineArrowDirection =
      edge.arrowDirection ??
      (legacy === "arrow" ? "forward" : legacy === "both" ? "both" : "none");
    boardLineDashed = edge.dashed ?? legacy === "dashed";
  }
  function wireBoardLineTools(root) {
    let bar = $(".board-line-tools", root);
    if (!connectMode && !selectedEdgeId) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "board-submenu board-line-tools";
      bar.innerHTML =
        '<label for="boardLineArrowDirection">화살표</label><select id="boardLineArrowDirection" class="filter-select"><option value="none">없음</option><option value="forward">시작 → 끝</option><option value="reverse">끝 → 시작</option><option value="both">양방향</option></select><label for="boardLineDashed"><input id="boardLineDashed" type="checkbox"> 점선</label>';
      placeBoardSubmenu(root, bar);
    }
    const edge = getBoard(currentBoardId)?.edges.find(
      (x) => x.id === selectedEdgeId,
    );
    if (edge) loadBoardLineSettings(edge);
    const direction = $("#boardLineArrowDirection", bar),
      dashed = $("#boardLineDashed", bar);
    if (direction) direction.value = boardLineArrowDirection;
    if (dashed) dashed.checked = boardLineDashed;
    placeBoardSubmenu(root, bar);
  }
  function wireBoardSketch(root) {
    const b = getBoard(currentBoardId),
      world = $("#boardWorld", root),
      wrap = $("#boardWrap", root);
    if (!b || !world || !wrap) return;
    b.strokes = Array.isArray(b.strokes) ? b.strokes : [];
    let canvas = $("#boardSketchCanvas", world);
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "boardSketchCanvas";
      canvas.width = 2200;
      canvas.height = 1600;
      canvas.style.cssText =
        "position:absolute;inset:0;z-index:1;pointer-events:none;touch-action:none";
      world.prepend(canvas);
    }
    canvas.style.pointerEvents = "none";
    if (b.drawingData && !canvas.dataset.loaded) {
      const ctx = canvas.getContext("2d"),
        img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        if (!b.drawingBounds) b.drawingBounds = boardSketchBounds(canvas);
        updateBoardSelectionStyles();
      };
      img.src = b.drawingData;
      canvas.dataset.loaded = "1";
    }
    let svg = $("#boardSketchSvg", world);
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = "boardSketchSvg";
      svg.setAttribute("viewBox", "0 0 2200 1600");
      svg.setAttribute("width", "2200");
      svg.setAttribute("height", "1600");
      svg.style.cssText =
        "position:absolute;inset:0;width:2200px;height:1600px;overflow:visible;z-index:2;pointer-events:none;touch-action:none";
      world.append(svg);
    }
    svg.style.overflow = "visible";
    renderBoardSketchStrokes(svg, b.strokes);
    let surface = $("#boardSketchInput", wrap);
    if (!surface) {
      surface = document.createElement("div");
      surface.id = "boardSketchInput";
      surface.style.cssText =
        "position:absolute;inset:0;z-index:4;background:transparent;touch-action:none;display:none";
      wrap.append(surface);
    }
    let bar = $(".board-sketch-tools", root);
    if (boardSketchMode && !bar) {
      bar = document.createElement("div");
      bar.className = "board-submenu board-sketch-tools";
      bar.innerHTML =
        '<select id="boardSketchTool" class="filter-select"><option value="pen">펜</option><option value="line">선</option><option value="rect">사각형</option><option value="circle">원</option><option value="eraser">지우개</option></select><input id="boardSketchWidth" type="range" min="1" max="40" value="4"><input id="boardSketchColor" type="color" value="#222222"><button class="btn small" data-action="board-sketch-done">그리기 완료</button>';
      placeBoardSubmenu(root, bar);
    }
    if (!boardSketchMode) {
      surface.style.display = "none";
      bar?.remove();
      surface.onpointerdown = null;
      surface.onpointermove = null;
      surface.onpointerup = null;
      surface.onpointercancel = null;
      updateBoardSelectionStyles();
      return;
    }
    surface.style.display = "block";
    surface.style.cursor = "crosshair";
    $("#boardSketchTool", root).value = boardSketchTool;
    $("#boardSketchWidth", root).value = boardSketchWidth;
    $("#boardSketchColor", root).value = boardSketchColor;
    let activeStroke = null,
      erased = false;
    const pt = (e) => {
      const r = wrap.getBoundingClientRect();
      return {
        x: (e.clientX - r.left - boardTransform.x) / boardTransform.scale,
        y: (e.clientY - r.top - boardTransform.y) / boardTransform.scale,
      };
    };
    surface.onpointerdown = (e) => {
      if (e.button !== 0) return;
      const p = pt(e);
      saveBoardHistory();
      erased = false;
      if (boardSketchTool === "eraser") {
        activeStroke = { tool: "eraser", points: [p] };
      } else {
        activeStroke = {
          id: uid(),
          tool: boardSketchTool,
          points: [p],
          color: boardSketchColor,
          width: boardSketchWidth,
        };
        b.strokes.push(activeStroke);
      }
      try {
        surface.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    };
    surface.onpointermove = (e) => {
      if (!activeStroke) return;
      const p = pt(e);
      if (activeStroke.tool === "eraser") {
        const radius = Math.max(12, boardSketchWidth * 2),
          before = b.strokes.length;
        b.strokes = b.strokes.filter(
          (stroke) =>
            !stroke.points?.some(
              (q) => Math.hypot(q.x - p.x, q.y - p.y) <= radius,
            ),
        );
        erased = erased || before !== b.strokes.length;
      } else if (activeStroke.tool === "pen") {
        const last = activeStroke.points[activeStroke.points.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) >= 1)
          activeStroke.points.push(p);
      } else {
        activeStroke.points = [activeStroke.points[0], p];
      }
      renderBoardSketchStrokes(svg, b.strokes);
    };
    const finish = (e) => {
      if (!activeStroke) return;
      activeStroke = null;
      if (e?.pointerId !== undefined) {
        try {
          if (surface.hasPointerCapture(e.pointerId))
            surface.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      if (erased || boardSketchTool !== "eraser") {
        b.updatedAt = now();
        persist(true);
      }
      renderBoardSketchStrokes(svg, b.strokes);
    };
    surface.onpointerup = finish;
    surface.onpointercancel = finish;
    $("#boardSketchTool", root).onchange = (e) =>
      (boardSketchTool = e.target.value);
    $("#boardSketchWidth", root).oninput = (e) =>
      (boardSketchWidth = +e.target.value);
    $("#boardSketchColor", root).oninput = (e) =>
      (boardSketchColor = e.target.value);
    updateBoardSelectionStyles();
  }
  document.addEventListener(
    "click",
    (e) => {
      const target =
        e.target instanceof Element ? e.target : e.target?.parentElement;
      if (!target) return;
      if (target.closest("[data-board-attachment-control]")) return;
      const card = target.closest("#boardWorld [data-card]");
      if (!card) return;
      if (suppressBoardCardClick && e.detail !== 0) {
        suppressBoardCardClick = false;
        boardClickWasSelected = false;
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      const control = target.closest("button,input,textarea,select");
      if (
        e.detail !== 0 &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !control &&
        !boardClickWasSelected
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      boardClickWasSelected = false;
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const target =
      e.target instanceof Element ? e.target : e.target?.parentElement;
    if (!target) return;
    if (target.closest("[data-board-attachment-control]")) return;
    const t = target.closest("[data-action]");
    if (t) {
      const a = t.dataset.action;
      if (a === "modal-confirm") {
        if (modalConfirm?.() !== false) modalConfirm = null;
        return;
      }
      if (a === "create-document") {
        createDoc();
        return;
      }
      if (a === "quick-note") {
        showQuickModal();
        return;
      }
      if (a === "quick-memo-draft-file") {
        const picker = $("#quickMemoDraftPicker");
        if (picker) {
          picker.accept = "";
          picker.click();
        }
        return;
      }
      if (a === "home-draft-file") {
        const picker = $("#homeQuickPicker");
        if (picker) {
          picker.accept = "";
          picker.click();
        }
        return;
      }
      if (a === "create-board") {
        showCreateBoardModal();
        return;
      }
      if (a === "add-board-card") {
        closeBoardToolMenus();
        openBoardDocumentPicker();
        return;
      }
      if (a === "attach-board-file") {
        const picker = $("#boardFilePicker");
        if (picker) {
          picker.value = "";
          picker.click();
        }
        return;
      }
      if (a === "add-nested-board") {
        closeBoardToolMenus();
        showCreateNestedBoardModal();
        return;
      }
      if (a === "back-parent-board") {
        const b = getBoard(currentBoardId);
        if (b?.parentId) openBoard(b.parentId);
        return;
      }
      if (a === "rename-board") {
        const b = getBoard(currentBoardId);
        if (!b) return;
        const name = prompt("보드 이름", b.name);
        if (name?.trim()) {
          b.name = name.trim();
          persist(true);
          render();
        }
        return;
      }
      if (a === "board-undo") {
        undoBoard();
        return;
      }
      if (a === "board-redo") {
        redoBoard();
        return;
      }
      if (a === "board-sketch-done") {
        boardSketchMode = false;
        render();
        return;
      }
      if (a === "clear-library-filter") {
        currentTag = null;
        render();
        return;
      }
      if (a === "delete-selected-card") {
        removeSelectedCard();
        return;
      }
      if (a === "zoom-in" || a === "zoom-out") {
        zoomBoard(boardTransform.scale * (a === "zoom-in" ? 1.15 : 1 / 1.15));
        return;
      }
      if (a === "close-board-document") {
        boardDocumentPreviewId = null;
        boardDocumentPickerKind = null;
        boardDocumentWindowPosition = null;
        render();
        return;
      }
      if (a === "board-picker-tab") {
        boardDocumentPickerKind =
          t.dataset.kind === "document" ? "document" : "note";
        render();
        return;
      }
      if (a === "edit-board-document") {
        const id = t.dataset.documentId;
        boardDocumentPreviewId = null;
        boardDocumentPickerKind = null;
        boardDocumentWindowPosition = null;
        openDoc(id);
        return;
      }
      if (a === "back-library") {
        if (activeDocDraft?.id === activeDocId) finishActiveDocumentDraft();
        currentView = "documents";
        activeDocId = null;
        render();
        return;
      }
      if (a === "promote-note") {
        const d = getDoc(activeDocId);
        if (d) {
          d.kind = "document";
          persist(true);
          render();
        }
        return;
      }
      if (a === "add-url") {
        showUrlModal();
        return;
      }
      if (a === "attach-file") {
        attachFiles();
        return;
      }
      if (a === "home-capture") {
        const title = $("#homeQuickTitle")?.value.trim() || "",
          body = $("#homeQuickBody")?.value.trim() || "";
        if (!title && !body && !homeQuickDraftFiles.length) {
          toast("제목, 내용 또는 파일을 추가해 주세요.", true);
          return;
        }
        const d = createDoc("note", title, body);
        d.tags = [
          ...new Set(
            ($("#homeQuickTags")?.value || "")
              .split(",")
              .map((t) => t.trim().replace(/^#/, ""))
              .filter(Boolean),
          ),
        ];
        d.attachments = homeQuickDraftFiles.map((file) => ({
          id: uid(),
          type: "file",
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          blob: file,
          createdAt: now(),
        }));
        homeQuickDraftFiles = [];
        persist(true);
        render();
        toast("Quick Memo를 저장했어요.");
        return;
      }
      if (a === "insert-link") {
        insertFormat("link");
        return;
      }
      if (a === "export-data") {
        exportData();
        return;
      }
      if (a === "import-data") {
        importData();
        return;
      }
      if (a === "reset-data") {
        resetData();
        return;
      }
      if (a === "create-category") {
        showCreateCategory();
        return;
      }
      if (a === "modal-close") {
        closeModal();
        return;
      }
      return;
    }
    if (target.closest("[data-remove-home-draft-file]")) {
      const draftRemove = target.closest("[data-remove-home-draft-file]");
      homeQuickDraftFiles.splice(
        Number(draftRemove.dataset.removeHomeDraftFile),
        1,
      );
      renderHomeQuickDraftFiles();
      return;
    }
    if (target.closest("[data-remove-draft-file]")) {
      const draftRemove = target.closest("[data-remove-draft-file]");
      quickMemoDraftFiles.splice(
        Number(draftRemove.dataset.removeDraftFile),
        1,
      );
      renderQuickMemoDraftFiles();
      return;
    }
    const attachmentRemove = target.closest("[data-remove-attachment]");
    if (attachmentRemove) {
      const d = getDoc(activeDocId),
        id = attachmentRemove.dataset.removeAttachment;
      if (d) {
        d.attachments = (d.attachments || []).filter((a) => {
          if (a.id !== id) return true;
          const objectUrl = quickMemoObjectUrls.get(a.id);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          quickMemoObjectUrls.delete(a.id);
          return false;
        });
        d.updatedAt = now();
        persist(true);
        render();
      }
      return;
    }
    const save = e.target.closest("[data-inline-save]");
    if (save) {
      saveInlineBoardItem();
      return;
    }
    if (e.target.closest("[data-inline-cancel]")) {
      inlineBoardEditId = null;
      render();
      return;
    }
    const del = e.target.closest("[data-remove-board-item]");
    if (del) {
      e.stopPropagation();
      selectedCard = del.dataset.removeBoardItem;
      selectedCardIds = [selectedCard];
      removeSelectedCard();
      return;
    }
    const palette = e.target.closest("[data-board-item]");
    if (palette) {
      if (palette.dataset.boardItem === "image") {
        closeBoardToolMenus();
        showImageInsertModal();
      } else if (palette.dataset.boardItem === "link") {
        closeBoardToolMenus();
        showBoardItemModal("link", boardDropPosition);
      } else addBoardItem(palette.dataset.boardItem, boardDropPosition);
      boardDropPosition = null;
      return;
    }
    const editBoardLink = e.target.closest("[data-edit-board-link]");
    if (editBoardLink) {
      showBoardItemModal("link", null, editBoardLink.dataset.editBoardLink);
      return;
    }
    const boardLink = e.target.closest("[data-board-url]");
    if (boardLink && !e.target.closest("[data-edit-board-item]")) {
      window.open(boardLink.dataset.boardUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const openBoardBtn = e.target.closest("[data-open-board]");
    if (openBoardBtn) {
      openBoard(openBoardBtn.dataset.openBoard);
      return;
    }
    const doc = e.target.closest("[data-open-doc]");
    if (doc) {
      if (doc.closest("#globalSearchResults")) {
        $("#globalSearchResults").hidden = true;
        $("#globalSearch").value = "";
      }
      if (currentView === "board" && doc.closest("#boardWorld"))
        openBoardDocumentPreview(doc.dataset.openDoc);
      else openDoc(doc.dataset.openDoc);
      return;
    }
    const item = e.target.closest("[data-edit-board-item]");
    if (item) {
      if (suppressBoardCardClick) {
        suppressBoardCardClick = false;
        return;
      }
      const b = getBoard(currentBoardId),
        card = b?.cards.find((c) => c.id === item.dataset.editBoardItem);
      if (card?.type === "link") showBoardItemModal("link", null, card.id);
      else startInlineBoardEdit(item.dataset.editBoardItem);
      return;
    }
    const nav = e.target.closest("[data-view]");
    if (nav) {
      setView(nav.dataset.view);
      return;
    }
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      currentTag = tag.dataset.tag;
      currentView = "documents";
      render();
      return;
    }
    if (e.target.closest("[data-modal-close]")) closeModal();
  });
  document.addEventListener("change", (e) => {
    if (!["boardLineArrowDirection", "boardLineDashed"].includes(e.target.id))
      return;
    const b = getBoard(currentBoardId),
      edge = b?.edges.find((x) => x.id === selectedEdgeId);
    if (e.target.id === "boardLineArrowDirection")
      boardLineArrowDirection = e.target.value;
    else boardLineDashed = e.target.checked;
    if (edge) {
      saveBoardHistory();
      edge.arrowDirection = boardLineArrowDirection;
      edge.dashed = boardLineDashed;
      b.updatedAt = now();
      persist(true);
      drawEdges();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Backspace" &&
      ["board", "boards"].includes(currentView) &&
      selectedCardIds.length &&
      !e.target.closest('input,textarea,select,[contenteditable="true"]')
    ) {
      e.preventDefault();
      removeSelectedCard();
      return;
    }
    if (e.code === "Space" && !e.target.closest("input,textarea,select")) {
      spacePressed = true;
      e.preventDefault();
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "z" &&
      ["board", "boards"].includes(currentView)
    ) {
      e.preventDefault();
      e.shiftKey ? redoBoard() : undoBoard();
    }
    if (e.key === "Escape" && $("#modalRoot").innerHTML) closeModal();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") spacePressed = false;
  });
  let librarySearchComposing = false,
    librarySearchCompositionCommit = false;
  function refreshLibrarySearch(input) {
    searchQuery = input.value;
    const root = $("#viewRoot"),
      title =
        currentView === "inbox"
          ? "Quick notes"
          : currentView === "recent"
            ? "Recently updated"
            : "Documents",
      desc =
        currentView === "inbox"
          ? "가볍게 남겨둔 생각을 확인하고, 필요한 기록으로 발전시켜보세요."
          : currentView === "recent"
            ? "최근 수정한 모든 메모와 문서입니다."
            : "모든 문서를 한곳에서 검색하고 관리하세요.",
      template = document.createElement("template");
    template.innerHTML = renderLibrary("all", title, desc);
    const currentList = $(".library-list", root),
      nextList = template.content.querySelector(".library-list");
    if (currentList && nextList) currentList.replaceWith(nextList);
    const currentCount = $(".filterbar > span:last-child", root),
      nextCount = template.content.querySelector(
        ".filterbar > span:last-child",
      );
    if (currentCount && nextCount)
      currentCount.textContent = nextCount.textContent;
  }
  document.addEventListener("keydown", (e) => {
    if (e.target.id === "globalSearch" && e.key === "Escape") {
      $("#globalSearchResults").hidden = true;
      e.target.blur();
    }
  });
  document.addEventListener("compositionstart", (e) => {
    if (e.target.id === "globalSearch") {
      return;
    }
    if (e.target.id === "librarySearch") {
      librarySearchComposing = true;
      librarySearchCompositionCommit = false;
    }
  });
  document.addEventListener("compositionend", (e) => {
    if (e.target.id === "globalSearch") {
      renderGlobalSearchResults(e.target.value);
      return;
    }
    if (e.target.id !== "librarySearch") return;
    librarySearchComposing = false;
    librarySearchCompositionCommit = true;
    searchQuery = e.target.value;
    setTimeout(() => {
      if (!librarySearchCompositionCommit) return;
      librarySearchCompositionCommit = false;
      refreshLibrarySearch(e.target);
    }, 0);
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("[data-board-picker-search]")) {
      const query = e.target.value.trim().toLocaleLowerCase(),
        list = e.target
          .closest(".board-document-picker")
          ?.querySelector(".board-document-picker-list");
      if (list) {
        let visible = 0;
        list.querySelectorAll(".board-document-picker-item").forEach((item) => {
          const match = (item.dataset.searchText || "")
            .toLocaleLowerCase()
            .includes(query);
          item.hidden = !match;
          if (match) visible++;
        });
        const empty = list.querySelector(".board-document-picker-no-results");
        if (empty) empty.hidden = visible > 0;
      }
      return;
    }
    if (["homeQuickBody", "modalBody", "editorBody"].includes(e.target.id)) {
      const host = $(
        "#" +
          {
            homeQuickBody: "homeQuickLinkPreviews",
            modalBody: "quickMemoDraftLinkPreviews",
            editorBody: "editorMemoLinkPreviews",
          }[e.target.id],
      );
      clearTimeout(quickMemoPreviewTimers.get(host));
      quickMemoPreviewTimers.set(
        host,
        setTimeout(
          () => renderQuickMemoLinkPreviews(host, e.target.value),
          420,
        ),
      );
    }
    if (e.target.id === "globalSearch") {
      renderGlobalSearchResults(e.target.value);
      return;
    }
    if (e.target.id === "librarySearch") {
      searchQuery = e.target.value;
      if (e.isComposing || librarySearchComposing) return;
      librarySearchCompositionCommit = false;
      refreshLibrarySearch(e.target);
    }
    if (
      e.target.id === "editorTitle" ||
      e.target.id === "editorBody" ||
      e.target.id === "editorTags"
    )
      updateDocFromEditor();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id === "boardFilePicker") {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length) attachBoardFiles(files);
      return;
    }
    if (e.target.id === "homeQuickPicker") {
      homeQuickDraftFiles.push(...Array.from(e.target.files || []));
      e.target.value = "";
      renderHomeQuickDraftFiles();
      return;
    }
    if (e.target.id === "quickMemoDraftPicker") {
      quickMemoDraftFiles.push(...Array.from(e.target.files || []));
      e.target.value = "";
      renderQuickMemoDraftFiles();
      return;
    }
    if (e.target.id === "typeFilter") {
      searchFilter = e.target.value;
      render();
    }
    if (e.target.id === "categoryFilter") {
      currentTag =
        e.target.value === "all" ? null : "category:" + e.target.value;
      render();
    }
    if (e.target.id === "tagFilter") {
      currentTag = e.target.value === "all" ? null : e.target.value;
      render();
    }
    if (e.target.id === "editorCategory" || e.target.id === "editorTags")
      updateDocFromEditor();
    if (e.target.id === "importPicker" && e.target.files?.[0])
      readImport(e.target.files[0]);
    if (e.target.id === "filePicker" && e.target.files?.length)
      handleFiles(e.target.files);
  });
  document.addEventListener("pointerdown", (e) => {
    const item = e.target.closest(
      ".board-document-picker-item[data-board-doc-drag]",
    );
    if (!item || e.button !== 0 || e.target.closest("a,button,input")) return;
    const panel = item.closest(".board-document-panel");
    boardDocumentItemDrag = {
      id: item.dataset.boardDocDrag,
      item,
      panel,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      ghost: null,
      pointerId: e.pointerId,
    };
    try {
      item.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    const drag = boardDocumentItemDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const distance = Math.hypot(
      e.clientX - drag.startX,
      e.clientY - drag.startY,
    );
    if (!drag.moved && distance < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.panel?.classList.add("is-dragging");
      const ghost = document.createElement("div");
      ghost.className = "board-document-drag-ghost";
      ghost.textContent = getDoc(drag.id)?.title || "제목 없는 기록";
      document.body.append(ghost);
      drag.ghost = ghost;
    }
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX + 14 + "px";
      drag.ghost.style.top = e.clientY + 14 + "px";
    }
  });
  const finishBoardDocumentItemDrag = (e) => {
    const drag = boardDocumentItemDrag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    boardDocumentItemDrag = null;
    try {
      if (drag.item?.hasPointerCapture(e.pointerId))
        drag.item.releasePointerCapture(e.pointerId);
    } catch (_) {}
    drag.panel?.classList.remove("is-dragging");
    drag.ghost?.remove();
    if (!drag.moved) return;
    const wrap = $("#boardWrap"),
      rect = wrap?.getBoundingClientRect();
    if (
      rect &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    )
      placeBoardDocumentOnBoard(drag.id, e.clientX, e.clientY);
  };
  window.addEventListener("pointerup", finishBoardDocumentItemDrag, true);
  window.addEventListener("pointercancel", finishBoardDocumentItemDrag, true);
  document.addEventListener("dragstart", (e) => {
    const docHandle = e.target.closest("[data-board-doc-drag]");
    if (docHandle) {
      e.dataTransfer.setData("text/board-doc", docHandle.dataset.boardDocDrag);
      e.dataTransfer.setData("text/plain", docHandle.dataset.boardDocDrag);
      e.dataTransfer.effectAllowed = "copy";
      docHandle.closest(".board-document-panel")?.classList.add("is-dragging");
      return;
    }
    if (e.target.closest("#boardWorld [data-card]")) {
      e.preventDefault();
      return;
    }
    const p = e.target.closest("[data-board-item]");
    if (p) e.dataTransfer.setData("text/board-item", p.dataset.boardItem);
  });
  document.addEventListener("dragend", (e) => {
    e.target
      .closest("[data-board-doc-drag]")
      ?.closest(".board-document-panel")
      ?.classList.remove("is-dragging");
  });
  document.addEventListener("dragover", (e) => {
    if (e.target.closest("#boardWrap")) e.preventDefault();
  });
  document.addEventListener("drop", async (e) => {
    const wrap = e.target.closest("#boardWrap");
    if (!wrap) return;
    e.preventDefault();
    const rect = wrap.getBoundingClientRect();
    boardDropPosition = {
      x: (e.clientX - rect.left - boardTransform.x) / boardTransform.scale,
      y: (e.clientY - rect.top - boardTransform.y) / boardTransform.scale,
    };
    const file = [...(e.dataTransfer.files || [])].find((f) =>
      f.type.startsWith("image/"),
    );
    if (file) {
      addBoardImage(await fileToDataUrl(file), "", boardDropPosition);
      return;
    }
    const docId =
      e.dataTransfer.getData("text/board-doc") ||
      e.dataTransfer.getData("text/plain");
    if (docId) {
      const b = getBoard(currentBoardId);
      if (!b || !getDoc(docId)) return;
      saveBoardHistory();
      b.cards.push({
        id: uid(),
        type: "doc",
        targetId: docId,
        x: boardDropPosition.x,
        y: boardDropPosition.y,
      });
      b.updatedAt = now();
      persist(true);
      render();
      toast("문서를 보드 요소로 추가했어요.");
      return;
    }
    const type = e.dataTransfer.getData("text/board-item");
    if (type === "link") showBoardItemModal("link", boardDropPosition);
    else if (type) addBoardItem(type, boardDropPosition);
  });
  document.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest("[data-board-document-move]");
    if (!handle || currentView !== "board" || e.button !== 0) return;
    const panel = handle.closest(".board-document-panel"),
      wrap = $("#boardWrap");
    if (!panel || !wrap) return;
    const wr = wrap.getBoundingClientRect(),
      pr = panel.getBoundingClientRect();
    boardDocumentWindowPosition = { x: pr.left - wr.left, y: pr.top - wr.top };
    panel.style.left = boardDocumentWindowPosition.x + "px";
    panel.style.top = boardDocumentWindowPosition.y + "px";
    panel.style.right = "auto";
    boardDocumentWindowDrag = {
      handle,
      panel,
      wrap,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: boardDocumentWindowPosition.x,
      origY: boardDocumentWindowPosition.y,
    };
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (_) {}
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    const drag = boardDocumentWindowDrag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const maxX = Math.max(0, drag.wrap.clientWidth - drag.panel.offsetWidth),
      maxY = Math.max(0, drag.wrap.clientHeight - drag.panel.offsetHeight);
    boardDocumentWindowPosition = {
      x: Math.max(0, Math.min(maxX, drag.origX + e.clientX - drag.startX)),
      y: Math.max(0, Math.min(maxY, drag.origY + e.clientY - drag.startY)),
    };
    drag.panel.style.left = boardDocumentWindowPosition.x + "px";
    drag.panel.style.top = boardDocumentWindowPosition.y + "px";
  });
  const finishBoardDocumentWindowMove = (e) => {
    if (
      !boardDocumentWindowDrag ||
      (e.pointerId !== undefined &&
        boardDocumentWindowDrag.pointerId !== e.pointerId)
    )
      return;
    const drag = boardDocumentWindowDrag;
    boardDocumentWindowDrag = null;
    try {
      if (
        e.pointerId !== undefined &&
        drag.handle.hasPointerCapture(e.pointerId)
      )
        drag.handle.releasePointerCapture(e.pointerId);
    } catch (_) {}
  };
  window.addEventListener("pointerup", finishBoardDocumentWindowMove, true);
  window.addEventListener("pointercancel", finishBoardDocumentWindowMove, true);
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!["board", "boards"].includes(currentView)) return;
      const world = $("#boardWorld"),
        wrap = $("#boardWrap");
      if (
        !world ||
        !wrap ||
        !wrap.contains(e.target) ||
        e.target.closest(
          ".board-floating,.board-toolbar,.board-tools,.board-submenu,.board-document-panel",
        ) ||
        (boardSketchMode && e.target.closest("#boardWrap"))
      )
        return;
      const pt = { x: e.clientX, y: e.clientY };
      if (e.button === 1 || spacePressed) {
        boardDrag = {
          kind: "pan",
          startX: pt.x,
          startY: pt.y,
          origX: boardTransform.x,
          origY: boardTransform.y,
          moved: false,
          pointerId: e.pointerId,
        };
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
        return;
      }
      if (
        e.button !== 0 ||
        e.target.closest(
          "input,textarea,select,button,[data-board-attachment-control]",
        )
      )
        return;
      const sketchStroke = e.target.closest("[data-sketch-stroke]");
      if (sketchStroke && !boardSketchMode) {
        const strokeId = sketchStroke.dataset.sketchStroke,
          b = getBoard(currentBoardId),
          stroke = b?.strokes?.find((x) => x.id === strokeId);
        if (!stroke) return;
        const selectedStrokeId = SKETCH_STROKE_PREFIX + strokeId;
        if (!selectedCardIds.includes(selectedStrokeId)) {
          selectedCard = selectedStrokeId;
          selectedCardIds = [selectedStrokeId];
          updateSelectedBoardUi();
          updateBoardSelectionStyles();
        }
        const origins = selectedCardIds
          .map((key) => {
            if (key.startsWith(SKETCH_STROKE_PREFIX)) {
              const id = key.slice(SKETCH_STROKE_PREFIX.length),
                item = b.strokes?.find((x) => x.id === id);
              return (
                item && {
                  kind: "stroke",
                  id,
                  points: (item.points || []).map((p) => ({ x: p.x, y: p.y })),
                }
              );
            }
            const c = b.cards.find((x) => x.id === key);
            return c && { kind: "card", id: key, x: c.x, y: c.y };
          })
          .filter(Boolean);
        boardDrag = {
          kind: "card",
          startX: pt.x,
          startY: pt.y,
          origins,
          moved: false,
          pointerId: e.pointerId,
        };
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
        return;
      }
      const edgeEnd = e.target.closest("[data-edge-end]");
      if (edgeEnd) {
        selectedEdgeId = edgeEnd.dataset.edgeId;
        boardDrag = {
          kind: "edge-end",
          edgeId: selectedEdgeId,
          end: edgeEnd.dataset.edgeEnd,
          startX: pt.x,
          startY: pt.y,
          moved: false,
          pointerId: e.pointerId,
          captureTarget: edgeEnd,
        };
        try {
          edgeEnd.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
        return;
      }
      const edgeHit = e.target.closest("[data-edge-hit]");
      if (edgeHit) {
        selectedEdgeId = edgeHit.dataset.edgeHit;
        const edge = getBoard(currentBoardId)?.edges.find(
          (x) => x.id === selectedEdgeId,
        );
        if (edge) loadBoardLineSettings(edge);
        wireBoardLineTools($("#viewRoot"));
        drawEdges();
        e.preventDefault();
        return;
      }
      const card = e.target.closest("[data-card]");
      if (card && connectMode) {
        boardClickWasSelected = false;
        boardDrag = {
          kind: "connect",
          fromId: card.dataset.card,
          startX: pt.x,
          startY: pt.y,
          moved: false,
          pointerId: e.pointerId,
          captureTarget: card,
        };
        const source = getBoard(currentBoardId)?.cards.find(
            (x) => x.id === card.dataset.card,
          ),
          svg = $("#boardEdges");
        if (source && svg) {
          const preview = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line",
          );
          preview.id = "boardConnectPreview";
          preview.setAttribute("class", "board-edge-line selected");
          preview.setAttribute("x1", source.x + 109);
          preview.setAttribute("y1", source.y + 60.5);
          preview.setAttribute("x2", source.x + 109);
          preview.setAttribute("y2", source.y + 60.5);
          svg.append(preview);
        }
        try {
          card.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
        return;
      }
      if (card) {
        const id = card.dataset.card,
          b = getBoard(currentBoardId);
        boardClickWasSelected =
          selectedCardIds.includes(id) && card.classList.contains("selected");
        if (!b?.cards.some((x) => x.id === id)) return;
        if (!boardClickWasSelected) {
          boardDrag = null;
          selectedCard = id;
          selectedCardIds = [id];
          $$("[data-card]", world).forEach((el) =>
            el.classList.toggle("selected", el.dataset.card === id),
          );
          updateSelectedBoardUi();
          updateBoardSelectionStyles();
        }
        const origins = (selectedCardIds.includes(id) ? selectedCardIds : [id])
          .map((key) => {
            if (key.startsWith(SKETCH_STROKE_PREFIX)) {
              const stroke = b.strokes?.find(
                (x) => x.id === key.slice(SKETCH_STROKE_PREFIX.length),
              );
              return (
                stroke && {
                  kind: "stroke",
                  id: key.slice(SKETCH_STROKE_PREFIX.length),
                  points: (stroke.points || []).map((p) => ({
                    x: p.x,
                    y: p.y,
                  })),
                }
              );
            }
            const c = b.cards.find((x) => x.id === key);
            return c && { kind: "card", id: key, x: c.x, y: c.y };
          })
          .filter(Boolean);
        boardDrag = {
          kind: "card",
          startX: pt.x,
          startY: pt.y,
          origins,
          moved: false,
          pointerId: e.pointerId,
          captureTarget: card,
        };
        try {
          card.setPointerCapture(e.pointerId);
        } catch (_) {}
        e.preventDefault();
        return;
      }
      const r = wrap.getBoundingClientRect();
      boardDrag = {
        kind: "pending",
        startX: pt.x,
        startY: pt.y,
        localX: pt.x - r.left,
        localY: pt.y - r.top,
        wrapRect: r,
        moved: false,
        pointerId: e.pointerId,
      };
      try {
        wrap.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    },
    true,
  );
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!boardDrag || !["board", "boards"].includes(currentView)) return;
      const dx = e.clientX - boardDrag.startX,
        dy = e.clientY - boardDrag.startY,
        distance = Math.hypot(dx, dy);
      if (boardDrag.kind === "pending") {
        if (distance <= 4) return;
        const wrap = $("#boardWrap"),
          box = document.createElement("div");
        box.id = "boardSelectionBox";
        box.style.cssText =
          "position:absolute;border:1px solid #555;background:#1111;pointer-events:none;z-index:20";
        wrap?.append(box);
        boardDrag.kind = "marquee";
        boardDrag.moved = true;
      }
      if (distance > (boardDrag.kind === "card" ? 5 : 3) && !boardDrag.moved) {
        boardDrag.moved = true;
        if (["card", "sketch-stroke"].includes(boardDrag.kind))
          saveBoardHistory();
      }
      const world = $("#boardWorld");
      if (!world) return;
      if (boardDrag.kind === "connect" || boardDrag.kind === "edge-end") {
        const wrap = $("#boardWrap"),
          rect = wrap.getBoundingClientRect(),
          x = (e.clientX - rect.left - boardTransform.x) / boardTransform.scale,
          y = (e.clientY - rect.top - boardTransform.y) / boardTransform.scale;
        if (
          Math.hypot(
            e.clientX - boardDrag.startX,
            e.clientY - boardDrag.startY,
          ) > 3
        )
          boardDrag.moved = true;
        if (boardDrag.kind === "connect") {
          const preview = $("#boardConnectPreview");
          if (preview) {
            preview.setAttribute("x2", x);
            preview.setAttribute("y2", y);
          }
        } else {
          const line = $(
            '[data-edge-visible="' + CSS.escape(boardDrag.edgeId) + '"]',
            $("#boardEdges"),
          );
          const hit = $(
            '[data-edge-hit="' + CSS.escape(boardDrag.edgeId) + '"]',
            $("#boardEdges"),
          );
          const suffix = boardDrag.end === "from" ? "1" : "2";
          line?.setAttribute("x" + suffix, x);
          line?.setAttribute("y" + suffix, y);
          hit?.setAttribute("x" + suffix, x);
          hit?.setAttribute("y" + suffix, y);
        }
        return;
      }
      if (boardDrag.kind === "pan") {
        boardTransform.x = boardDrag.origX + dx;
        boardTransform.y = boardDrag.origY + dy;
        world.style.transform = `translate(${boardTransform.x}px,${boardTransform.y}px) scale(${boardTransform.scale})`;
      } else if (boardDrag.kind === "marquee") {
        const box = $("#boardSelectionBox");
        if (box) {
          const x = e.clientX - boardDrag.wrapRect.left,
            y = e.clientY - boardDrag.wrapRect.top;
          box.style.left = Math.min(boardDrag.localX, x) + "px";
          box.style.top = Math.min(boardDrag.localY, y) + "px";
          box.style.width = Math.abs(x - boardDrag.localX) + "px";
          box.style.height = Math.abs(y - boardDrag.localY) + "px";
        }
      } else if (boardDrag.kind === "card") {
        const b = getBoard(currentBoardId);
        let movedStrokes = false;
        for (const origin of boardDrag.origins || []) {
          if (origin.kind === "stroke") {
            const stroke = b?.strokes?.find((x) => x.id === origin.id);
            if (!stroke) continue;
            stroke.points = (origin.points || []).map((p) => ({
              x: p.x + dx / boardTransform.scale,
              y: p.y + dy / boardTransform.scale,
            }));
            movedStrokes = true;
            continue;
          }
          const c = b?.cards.find((x) => x.id === origin.id),
            node = $$("[data-card]", world).find(
              (el) => el.dataset.card === origin.id,
            );
          if (!c || !node) continue;
          c.x = Number(origin.x) + dx / boardTransform.scale;
          c.y = Number(origin.y) + dy / boardTransform.scale;
          node.style.left = c.x + "px";
          node.style.top = c.y + "px";
        }
        if (movedStrokes)
          renderBoardSketchStrokes($("#boardSketchSvg"), b.strokes);
        drawEdges();
      }
    },
    true,
  );
  const finishBoardDrag = (e) => {
    if (
      !boardDrag ||
      (e.pointerId !== undefined &&
        boardDrag.pointerId !== undefined &&
        e.pointerId !== boardDrag.pointerId)
    )
      return;
    const drag = boardDrag;
    boardDrag = null;
    $("#boardSelectionBox")?.remove();
    const wrap = $("#boardWrap"),
      world = $("#boardWorld"),
      captureTarget = drag.captureTarget || wrap;
    try {
      if (
        e.pointerId !== undefined &&
        captureTarget?.hasPointerCapture(e.pointerId)
      )
        captureTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (
      e.type === "pointercancel" &&
      (drag.kind === "connect" || drag.kind === "edge-end")
    ) {
      $("#boardConnectPreview")?.remove();
      drawEdges();
      return;
    }
    if (drag.kind === "connect") {
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("#boardWorld [data-card]");
      $("#boardConnectPreview")?.remove();
      const b = getBoard(currentBoardId);
      if (target && target.dataset.card !== drag.fromId && b) {
        saveBoardHistory();
        const edge = {
          id: uid(),
          from: drag.fromId,
          to: target.dataset.card,
          style: "solid",
          arrowDirection: boardLineArrowDirection,
          dashed: boardLineDashed,
        };
        b.edges.push(edge);
        selectedEdgeId = edge.id;
        b.updatedAt = now();
        persist(true);
        render();
        toast("요소를 연결했어요.");
      } else drawEdges();
      if (drag.moved) {
        suppressBoardCardClick = true;
        setTimeout(() => {
          suppressBoardCardClick = false;
        }, 500);
      }
      return;
    }
    if (drag.kind === "edge-end") {
      const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("#boardWorld [data-card]"),
        b = getBoard(currentBoardId),
        edge = b?.edges.find((x) => x.id === drag.edgeId);
      if (
        target &&
        edge &&
        target.dataset.card !== edge[drag.end === "from" ? "to" : "from"]
      ) {
        saveBoardHistory();
        edge[drag.end] = target.dataset.card;
        b.updatedAt = now();
        selectedEdgeId = edge.id;
        persist(true);
        render();
        toast("선 끝을 다른 요소에 연결했어요.");
      } else drawEdges();
      if (drag.moved) {
        suppressBoardCardClick = true;
        setTimeout(() => {
          suppressBoardCardClick = false;
        }, 500);
      }
      return;
    }
    if (drag.kind === "pending") {
      selectedCard = null;
      selectedCardIds = [];
      closeBoardToolMenus();
      if (world)
        $$("[data-card]", world).forEach((el) =>
          el.classList.remove("selected"),
        );
      updateSelectedBoardUi();
      updateBoardSelectionStyles();
      drawEdges();
      return;
    }
    if (drag.kind === "marquee") {
      const x1 = Math.min(drag.startX, e.clientX),
        x2 = Math.max(drag.startX, e.clientX),
        y1 = Math.min(drag.startY, e.clientY),
        y2 = Math.max(drag.startY, e.clientY);
      selectedCardIds = [];
      if (drag.moved && world) {
        $$("[data-card]", world).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right >= x1 && r.left <= x2 && r.bottom >= y1 && r.top <= y2)
            selectedCardIds.push(el.dataset.card);
        });
        const b = getBoard(currentBoardId),
          bounds = b?.drawingBounds,
          wr = wrap?.getBoundingClientRect();
        if (drag.moved && b && wr) {
          const sx1 = (x1 - wr.left - boardTransform.x) / boardTransform.scale,
            sx2 = (x2 - wr.left - boardTransform.x) / boardTransform.scale,
            sy1 = (y1 - wr.top - boardTransform.y) / boardTransform.scale,
            sy2 = (y2 - wr.top - boardTransform.y) / boardTransform.scale;
          b.strokes = b.strokes || [];
          b.strokes.forEach((stroke) => {
            const sb = boardStrokeBounds(stroke);
            if (
              sb &&
              sb.right >= sx1 &&
              sb.left <= sx2 &&
              sb.bottom >= sy1 &&
              sb.top <= sy2
            )
              selectedCardIds.push(SKETCH_STROKE_PREFIX + stroke.id);
          });
        }
        if (bounds && wr) {
          const left =
              wr.left + boardTransform.x + bounds.x * boardTransform.scale,
            top = wr.top + boardTransform.y + bounds.y * boardTransform.scale,
            right = left + bounds.width * boardTransform.scale,
            bottom = top + bounds.height * boardTransform.scale;
          if (right >= x1 && left <= x2 && bottom >= y1 && top <= y2)
            selectedCardIds.push(BOARD_DRAWING_ID);
        }
      }
      selectedCard = selectedCardIds[0] || null;
      if (world)
        $$("[data-card]", world).forEach((el) =>
          el.classList.toggle(
            "selected",
            selectedCardIds.includes(el.dataset.card),
          ),
        );
      updateSelectedBoardUi();
      updateBoardSelectionStyles();
      if (selectedCardIds.length)
        toast(`${selectedCardIds.length}개 요소를 선택했어요.`);
    } else if (drag.kind === "pan" && drag.moved) {
      saveBoardViewport();
    } else if (drag.kind === "sketch-stroke" && drag.moved) {
      const b = getBoard(currentBoardId);
      if (b) {
        b.updatedAt = now();
        persist(true);
      }
    } else if (drag.kind === "card" && drag.moved) {
      suppressBoardCardClick = true;
      setTimeout(() => {
        suppressBoardCardClick = false;
      }, 500);
      const b = getBoard(currentBoardId);
      if (b) {
        b.updatedAt = now();
        persist(true);
      }
    }
  };
  const finishBoardDragAndFlush = (e) => {
    const active = !!boardDrag;
    finishBoardDrag(e);
    if (active && pendingBoardRerender)
      setTimeout(() => {
        if (!boardDrag && pendingBoardRerender) {
          pendingBoardRerender = false;
          render();
        }
      }, 0);
  };
  window.addEventListener("pointerup", finishBoardDragAndFlush, true);
  window.addEventListener("pointercancel", finishBoardDragAndFlush, true);
  window.addEventListener("blur", () => {
    if (boardDrag) {
      boardDrag = null;
      $("#boardSelectionBox")?.remove();
    }
  });
  function zoomBoard(nextScale, clientX, clientY) {
    const wrap = $("#boardWrap"),
      world = $("#boardWorld");
    if (!wrap || !world) return;
    const scale = Math.max(0.25, Math.min(3, nextScale)),
      rect = wrap.getBoundingClientRect(),
      px = Number.isFinite(clientX) ? clientX : rect.left + rect.width / 2,
      py = Number.isFinite(clientY) ? clientY : rect.top + rect.height / 2,
      localX = px - rect.left,
      localY = py - rect.top,
      worldX = (localX - boardTransform.x) / boardTransform.scale,
      worldY = (localY - boardTransform.y) / boardTransform.scale;
    boardTransform.x = localX - worldX * scale;
    boardTransform.y = localY - worldY * scale;
    boardTransform.scale = scale;
    saveBoardViewport();
    world.style.transform = `translate(${boardTransform.x}px,${boardTransform.y}px) scale(${scale})`;
    const label = $(".zoom-label");
    if (label) label.textContent = Math.round(scale * 100) + "%";
  }
  function edgePoint(card, other, node, otherNode) {
    const width = node?.offsetWidth || (card.type === "link" ? 286 : 218),
      height = node?.offsetHeight || (card.type === "link" ? 220 : 121),
      otherWidth =
        otherNode?.offsetWidth || (other.type === "link" ? 286 : 218),
      otherHeight =
        otherNode?.offsetHeight || (other.type === "link" ? 220 : 121),
      cx = card.x + width / 2,
      cy = card.y + height / 2,
      ox = other.x + otherWidth / 2,
      oy = other.y + otherHeight / 2,
      dx = ox - cx,
      dy = oy - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const t = Math.min(
      dx ? width / 2 / Math.abs(dx) : Infinity,
      dy ? height / 2 / Math.abs(dy) : Infinity,
    );
    return { x: cx + dx * t, y: cy + dy * t };
  }
  function edgeMarkup(edges, cards) {
    const defs =
      '<defs><marker id="boardArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="#888"/></marker></defs>';
    const nodeFor = (id) =>
      $('#boardWorld [data-card="' + CSS.escape(id) + '"]');
    return (
      defs +
      edges
        .map((e) => {
          const a = cards.find((c) => c.id === e.from),
            b = cards.find((c) => c.id === e.to);
          if (!a || !b) return "";
          const p = edgePoint(a, b, nodeFor(a.id), nodeFor(b.id)),
            q = edgePoint(b, a, nodeFor(b.id), nodeFor(a.id)),
            id = escapeHtml(e.id),
            arrow =
              e.arrowDirection ??
              (e.style === "arrow"
                ? "forward"
                : e.style === "both"
                  ? "both"
                  : "none"),
            dashed = e.dashed ?? e.style === "dashed",
            start = ["reverse", "both"].includes(arrow)
              ? ' marker-start="url(#boardArrow)"'
              : "",
            end = ["forward", "both"].includes(arrow)
              ? ' marker-end="url(#boardArrow)"'
              : "",
            dash = dashed ? ' stroke-dasharray="6 5"' : "";
          return (
            '<line class="board-edge-hit" data-edge-hit="' +
            id +
            '" x1="' +
            p.x +
            '" y1="' +
            p.y +
            '" x2="' +
            q.x +
            '" y2="' +
            q.y +
            '"/><line class="board-edge-line' +
            (selectedEdgeId === e.id ? " selected" : "") +
            '" data-edge-visible="' +
            id +
            '" x1="' +
            p.x +
            '" y1="' +
            p.y +
            '" x2="' +
            q.x +
            '" y2="' +
            q.y +
            '"' +
            dash +
            start +
            end +
            "/>" +
            (selectedEdgeId === e.id
              ? '<circle class="board-edge-handle" data-edge-end="from" data-edge-id="' +
                id +
                '" cx="' +
                p.x +
                '" cy="' +
                p.y +
                '" r="7"/><circle class="board-edge-handle" data-edge-end="to" data-edge-id="' +
                id +
                '" cx="' +
                q.x +
                '" cy="' +
                q.y +
                '" r="7"/>'
              : "")
          );
        })
        .join("")
    );
  }
  function drawEdges() {
    const b = getBoard(currentBoardId),
      svg = $("#boardEdges");
    if (!b || !svg) return;
    svg.innerHTML = edgeMarkup(b.edges || [], b.cards || []);
  }
  $("#viewRoot").addEventListener(
    "wheel",
    (e) => {
      if (
        !["board", "boards"].includes(currentView) ||
        !e.target.closest("#boardWrap") ||
        e.target.closest(".board-document-panel")
      )
        return;
      e.preventDefault();
      zoomBoard(
        boardTransform.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08),
        e.clientX,
        e.clientY,
      );
    },
    { passive: false },
  );
  const mobileMenuButton = $("#mobileMenu"),
    mobileSidebar = $("#sidebar"),
    mobileShade = $("#mobileShade");
  function closeMobileMenu() {
    mobileSidebar?.classList.remove("open");
    mobileShade?.classList.remove("show");
    mobileMenuButton?.setAttribute("aria-expanded", "false");
  }
  mobileMenuButton?.addEventListener("click", () => {
    const opening = !mobileSidebar?.classList.contains("open");
    mobileSidebar?.classList.toggle("open", opening);
    mobileShade?.classList.toggle("show", opening);
    mobileMenuButton.setAttribute("aria-expanded", String(opening));
  });
  mobileShade?.addEventListener("click", closeMobileMenu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMobileMenu();
  });
  async function init() {
    try {
      db = await openDB();
      state = await dbGet();
    } catch (e) {
      db = null;
      try {
        const raw = localStorage.getItem(STORE);
        state = raw ? JSON.parse(raw) : null;
      } catch (_) {
        state = null;
      }
    }
    if (!state) {
      state = seed();
      try {
        await dbPut(state);
      } catch (e) {
        console.warn(e);
      }
    }
    if (!Array.isArray(state.docs)) state.docs = [];
    if (!Array.isArray(state.boards)) state.boards = [];
    if (!Array.isArray(state.links)) state.links = [];
    if (!Array.isArray(state.categories)) state.categories = [];
    state.boards.forEach((b) => {
      b.cards = b.cards || [];
      b.edges = b.edges || [];
      b.strokes = Array.isArray(b.strokes) ? b.strokes : [];
      b.edges.forEach((e) => {
        if (!e.id) e.id = uid();
      });
      b.cards.forEach((c) => {
        if (c.type === "link" && youtubeVideoId(c.url)) {
          c.previewImage = youtubeThumbnail(c.url);
          c.previewMetadataFetched = false;
        } else if (c.type === "link" && !c.previewImage)
          c.previewMetadataFetched = false;
      });
    });
    render();
    const blockLink = new URLSearchParams(location.hash.slice(1));
    if (blockLink.has("doc"))
      openDoc(blockLink.get("doc"), blockLink.get("block") || "");
  }
  init();
})();
