const state = {
  sessionId: "",
  baseAssetId: "",
  styleAssetId: "",
  maskAssetId: "",
  baseUrl: "",
  currentVersionId: "",
  currentSelectedVersionId: "",
  tool: "brush",
  nodeStateMap: new Map(),
  nodeDragging: null,
  nodeDraft: {
    nodes: [
      { id: "n_base", type: "asset_base", label: "底图", x: 24, y: 72 },
      { id: "n_prompt", type: "prompt", label: "提示词", x: 24, y: 18 },
      { id: "n_t2i", type: "text2img", label: "文生图", x: 204, y: 18 },
      { id: "n_mask", type: "mask", label: "蒙版", x: 204, y: 126 },
      { id: "n_inpaint", type: "inpaint", label: "局部重绘", x: 384, y: 72 },
      { id: "n_out", type: "output", label: "输出", x: 564, y: 72 }
    ],
    edges: [
      { from: "n_prompt", to: "n_t2i" },
      { from: "n_base", to: "n_inpaint" },
      { from: "n_mask", to: "n_inpaint" },
      { from: "n_t2i", to: "n_out" },
      { from: "n_inpaint", to: "n_out" }
    ]
  },
  viewport: {
    x: 0,
    y: 0,
    scale: 1,
    minScale: 0.1,
    maxScale: 4,
    panning: null
  },
  assets: new Map(),
  selection: {
    ids: new Set(),
    activeId: ""
  },
  assetDragging: null,
  nextPlacementIndex: 0,
  maskDraftByBaseAssetId: new Map(),
  maskDrawing: null
};

const el = {
  sessionId: document.getElementById("sessionId"),
  model: document.getElementById("model"),
  prompt: document.getElementById("prompt"),
  localPrompt: document.getElementById("localPrompt"),
  negativePrompt: document.getElementById("negativePrompt"),
  steps: document.getElementById("steps"),
  strength: document.getElementById("strength"),
  size: document.getElementById("size"),
  uploadBase: document.getElementById("uploadBase"),
  uploadStyle: document.getElementById("uploadStyle"),
  uploadFolder: document.getElementById("uploadFolder"),
  runText2Img: document.getElementById("runText2Img"),
  runInpaint: document.getElementById("runInpaint"),
  validateFlow: document.getElementById("validateFlow"),
  runFlow: document.getElementById("runFlow"),
  status: document.getElementById("status"),
  history: document.getElementById("history"),
  logOutput: document.getElementById("logOutput"),
  refreshLogs: document.getElementById("refreshLogs"),
  clearMask: document.getElementById("clearMask"),
  exportMask: document.getElementById("exportMask"),
  exportCurrent: document.getElementById("exportCurrent"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  zoomReset: document.getElementById("zoomReset"),
  brushSize: document.getElementById("brushSize"),
  toolBrush: document.getElementById("toolBrush"),
  toolEraser: document.getElementById("toolEraser"),
  templateSelect: document.getElementById("templateSelect"),
  loadTemplates: document.getElementById("loadTemplates"),
  applyTemplate: document.getElementById("applyTemplate"),
  saveTemplate: document.getElementById("saveTemplate"),
  flowNodes: document.getElementById("flowNodes"),
  flowEdges: document.getElementById("flowEdges"),
  nodeEditor: document.getElementById("nodeEditor"),
  stage: document.getElementById("stage"),
  world: document.getElementById("world"),
  setAsBase: document.getElementById("setAsBase"),
  setAsStyle: document.getElementById("setAsStyle")
};

function setStatus(text) {
  el.status.textContent = text;
}

function formatAction(action) {
  if (action === "text2img") return "文生图";
  if (action === "inpaint") return "局部重绘";
  if (action === "flow_execute") return "流程执行";
  return action;
}

function formatStatus(status) {
  if (status === "success") return "成功";
  if (status === "failed") return "失败";
  return status;
}

function clampScale(scale) {
  return Math.max(state.viewport.minScale, Math.min(state.viewport.maxScale, scale));
}

function setZoomLabel() {
  el.zoomReset.textContent = `${Math.round(state.viewport.scale * 100)}%`;
}

function applyViewportTransform() {
  el.world.style.transform = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  setZoomLabel();
}

function setZoom(nextScale, anchorScreenPoint) {
  const prev = state.viewport.scale;
  const scale = clampScale(nextScale);
  if (scale === prev) {
    return;
  }

  if (anchorScreenPoint) {
    const stageRect = el.stage.getBoundingClientRect();
    const sx = anchorScreenPoint.x - stageRect.left;
    const sy = anchorScreenPoint.y - stageRect.top;
    const worldX = (sx - state.viewport.x) / prev;
    const worldY = (sy - state.viewport.y) / prev;
    state.viewport.x = sx - worldX * scale;
    state.viewport.y = sy - worldY * scale;
  }

  state.viewport.scale = scale;
  applyViewportTransform();
}

function screenToWorld(clientX, clientY) {
  const rect = el.stage.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: (sx - state.viewport.x) / state.viewport.scale,
    y: (sy - state.viewport.y) / state.viewport.scale
  };
}

function worldCenterPoint() {
  const rect = el.stage.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  return {
    x: (centerX - state.viewport.x) / state.viewport.scale,
    y: (centerY - state.viewport.y) / state.viewport.scale
  };
}

function fileNameFromUrl(url) {
  try {
    const cleaned = url.split("?")[0];
    const parts = cleaned.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "image");
  } catch {
    return "image";
  }
}

function upsertAsset(asset) {
  state.assets.set(asset.assetId, asset);
}

function normalizeAssetFromUpload(asset, roleTag) {
  const point = nextPlacementPoint();
  return {
    assetId: asset.assetId,
    url: asset.publicUrl,
    kind: asset.kind,
    roleTag: roleTag || "",
    source: "upload",
    x: point.x,
    y: point.y,
    width: 240,
    height: 180,
    folderPath: "",
    name: fileNameFromUrl(asset.publicUrl),
    versionId: ""
  };
}

function normalizeAssetFromAigc(input) {
  const point = nextPlacementPoint();
  return {
    assetId: input.assetId,
    url: input.url,
    kind: "generated",
    roleTag: "生成图",
    source: input.source,
    x: point.x,
    y: point.y,
    width: 320,
    height: 320,
    folderPath: "",
    name: fileNameFromUrl(input.url),
    versionId: input.versionId || ""
  };
}

function nextPlacementPoint() {
  const center = worldCenterPoint();
  const idx = state.nextPlacementIndex;
  const cols = 4;
  const gapX = 280;
  const gapY = 220;
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  state.nextPlacementIndex += 1;
  return {
    x: Math.round(center.x + col * gapX - gapX),
    y: Math.round(center.y + row * gapY - gapY / 2)
  };
}

function clearSelection() {
  state.selection.ids.clear();
  state.selection.activeId = "";
}

function selectAsset(assetId, append) {
  if (!append) {
    clearSelection();
  }

  if (append && state.selection.ids.has(assetId)) {
    state.selection.ids.delete(assetId);
    if (state.selection.activeId === assetId) {
      state.selection.activeId = "";
    }
  } else {
    state.selection.ids.add(assetId);
    state.selection.activeId = assetId;
  }

  const selected = state.assets.get(state.selection.activeId);
  if (selected) {
    setStatus(`已选中素材: ${selected.name} (${selected.assetId})`);
  }
  renderAssets();
}

function selectedAsset() {
  if (!state.selection.activeId) {
    return null;
  }
  return state.assets.get(state.selection.activeId) || null;
}

function setSelectedAsBase() {
  const asset = selectedAsset();
  if (!asset) {
    throw new Error("请先选中素材");
  }
  state.baseAssetId = asset.assetId;
  state.baseUrl = asset.url;
  setStatus(`已设为底图: ${asset.assetId}`);
  renderAssets();
}

function setSelectedAsStyle() {
  const asset = selectedAsset();
  if (!asset) {
    throw new Error("请先选中素材");
  }
  state.styleAssetId = asset.assetId;
  setStatus(`已设为风格图: ${asset.assetId}`);
  renderAssets();
}

function setSelectedAsMask() {
  const asset = selectedAsset();
  if (!asset) {
    throw new Error("请先选中素材");
  }
  state.maskAssetId = asset.assetId;
  setStatus(`已设为蒙版: ${asset.assetId}`);
  renderAssets();
}

function clearMaskSelection() {
  if (!state.baseAssetId) {
    state.maskAssetId = "";
    setStatus("蒙版已清空");
    renderAssets();
    return;
  }

  state.maskDraftByBaseAssetId.delete(state.baseAssetId);
  state.maskAssetId = "";
  setStatus("当前底图的蒙版草稿已清空");
  renderAssets();
}

function roleTags(asset) {
  return {
    base: asset.assetId === state.baseAssetId,
    style: asset.assetId === state.styleAssetId,
    mask: asset.assetId === state.maskAssetId
  };
}

function ensureMaskDraft(assetId, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const existing = state.maskDraftByBaseAssetId.get(assetId);

  if (existing && existing.width === w && existing.height === h) {
    return existing;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("无法创建蒙版画布上下文");
  }

  if (existing) {
    ctx.drawImage(existing.canvas, 0, 0, w, h);
  }

  const draft = { canvas, width: w, height: h };
  state.maskDraftByBaseAssetId.set(assetId, draft);
  return draft;
}

function maskCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return { x, y };
}

function drawMaskDot(ctx, point) {
  const size = Math.max(1, Number(el.brushSize.value || 24));
  if (state.tool === "brush") {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
  } else {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
  }

  ctx.beginPath();
  ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
  ctx.fill();
}

function paintMaskCanvasToOverlay(overlay, draft) {
  const overlayCtx = overlay.getContext("2d");
  if (!overlayCtx) {
    return;
  }
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  overlayCtx.globalAlpha = 0.55;
  overlayCtx.drawImage(draft.canvas, 0, 0, overlay.width, overlay.height);
  overlayCtx.globalAlpha = 1;
}

function attachMaskOverlay(card, asset) {
  if (asset.assetId !== state.baseAssetId) {
    return;
  }

  const draft = ensureMaskDraft(asset.assetId, asset.width, asset.height);
  const overlay = document.createElement("canvas");
  overlay.className = "mask-layer";
  overlay.width = draft.width;
  overlay.height = draft.height;
  overlay.style.left = "0";
  overlay.style.top = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.cursor = "crosshair";

  paintMaskCanvasToOverlay(overlay, draft);

  overlay.addEventListener("pointerdown", (ev) => {
    ev.stopPropagation();
    const p = maskCanvasPoint(ev, overlay);
    const ctx = draft.canvas.getContext("2d");
    if (!ctx) return;
    drawMaskDot(ctx, p);
    paintMaskCanvasToOverlay(overlay, draft);

    state.maskDrawing = {
      baseAssetId: asset.assetId,
      pointerId: ev.pointerId,
      overlay,
      draft
    };

    overlay.setPointerCapture(ev.pointerId);
  });

  overlay.addEventListener("pointermove", (ev) => {
    if (!state.maskDrawing || state.maskDrawing.pointerId !== ev.pointerId) {
      return;
    }
    const p = maskCanvasPoint(ev, overlay);
    const ctx = draft.canvas.getContext("2d");
    if (!ctx) return;
    drawMaskDot(ctx, p);
    paintMaskCanvasToOverlay(overlay, draft);
  });

  overlay.addEventListener("pointerup", (ev) => {
    if (!state.maskDrawing || state.maskDrawing.pointerId !== ev.pointerId) {
      return;
    }
    state.maskDrawing = null;
    state.maskAssetId = "";
    setStatus("蒙版已更新，点击“提交蒙版”后可进行局部重绘");
  });

  card.appendChild(overlay);
}

function renderEmptyHint() {
  const hint = document.createElement("div");
  hint.className = "asset-card";
  hint.style.left = "80px";
  hint.style.top = "60px";
  hint.style.width = "420px";
  hint.style.height = "140px";
  hint.style.padding = "14px";
  hint.style.cursor = "default";

  const title = document.createElement("div");
  title.style.fontSize = "15px";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  title.textContent = "画布已启动：请导入图片开始";

  const tip = document.createElement("div");
  tip.style.fontSize = "12px";
  tip.style.lineHeight = "1.6";
  tip.style.color = "#cbd5e1";
  tip.textContent = "可用方式：左侧上传底图/风格图、导入文件夹、拖拽到画布、Ctrl+V 粘贴截图。";

  hint.appendChild(title);
  hint.appendChild(tip);
  el.world.appendChild(hint);
}

function renderAssets() {
  const entries = [...state.assets.values()];
  el.world.innerHTML = "";

  if (entries.length === 0) {
    renderEmptyHint();
    return;
  }

  for (const asset of entries) {
    const card = document.createElement("div");
    card.className = "asset-card";
    if (state.selection.ids.has(asset.assetId)) {
      card.classList.add("selected");
    }

    card.style.left = `${asset.x}px`;
    card.style.top = `${asset.y}px`;
    card.style.width = `${asset.width}px`;
    card.style.height = `${asset.height}px`;
    card.dataset.assetId = asset.assetId;

    const img = document.createElement("img");
    img.src = asset.url;
    img.alt = asset.name;
    card.appendChild(img);

    const badge = document.createElement("div");
    badge.className = "asset-badge";
    badge.textContent = `${asset.name}`;
    card.appendChild(badge);

    const role = document.createElement("div");
    role.className = "asset-role";
    const flags = roleTags(asset);
    const mk = (text, on) => {
      const span = document.createElement("span");
      span.textContent = text;
      if (on) span.classList.add("on");
      return span;
    };
    role.appendChild(mk("B", flags.base));
    role.appendChild(mk("S", flags.style));
    role.appendChild(mk("M", flags.mask));
    card.appendChild(role);

    attachMaskOverlay(card, asset);

    card.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      selectAsset(asset.assetId, ev.shiftKey || ev.ctrlKey || ev.metaKey);

      const point = screenToWorld(ev.clientX, ev.clientY);
      const targets = [...state.selection.ids]
        .map((id) => state.assets.get(id))
        .filter(Boolean)
        .map((it) => ({ id: it.assetId, x: it.x, y: it.y }));

      state.assetDragging = {
        pointerId: ev.pointerId,
        startX: point.x,
        startY: point.y,
        targets
      };

      card.setPointerCapture(ev.pointerId);
    });

    card.addEventListener("pointermove", (ev) => {
      if (!state.assetDragging || state.assetDragging.pointerId !== ev.pointerId) {
        return;
      }

      const point = screenToWorld(ev.clientX, ev.clientY);
      const dx = point.x - state.assetDragging.startX;
      const dy = point.y - state.assetDragging.startY;

      for (const target of state.assetDragging.targets) {
        const current = state.assets.get(target.id);
        if (!current) continue;
        current.x = Math.round(target.x + dx);
        current.y = Math.round(target.y + dy);
      }

      renderAssets();
    });

    card.addEventListener("pointerup", () => {
      state.assetDragging = null;
    });

    el.world.appendChild(card);
  }
}

function flowPayload() {
  return {
    nodes: state.nodeDraft.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label })),
    edges: state.nodeDraft.edges.map((e) => ({ from: e.from, to: e.to }))
  };
}

function nodeById(id) {
  return state.nodeDraft.nodes.find((n) => n.id === id);
}

function drawEdges() {
  const width = el.nodeEditor.clientWidth;
  const height = el.nodeEditor.clientHeight;
  el.flowEdges.setAttribute("viewBox", `0 0 ${width} ${height}`);
  el.flowEdges.innerHTML = "";

  for (const edge of state.nodeDraft.edges) {
    const from = nodeById(edge.from);
    const to = nodeById(edge.to);
    if (!from || !to) {
      continue;
    }

    const x1 = from.x + 128;
    const y1 = from.y + 24;
    const x2 = to.x;
    const y2 = to.y + 24;
    const c1x = x1 + 38;
    const c2x = x2 - 38;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`);
    path.setAttribute("stroke", "#4b5563");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    el.flowEdges.appendChild(path);
  }
}

function renderFlowNodes() {
  el.flowNodes.innerHTML = "";

  for (const node of state.nodeDraft.nodes) {
    const item = document.createElement("div");
    const stateInfo = state.nodeStateMap.get(node.id) || { state: "idle", attempts: 0 };
    item.className = `flow-node ${stateInfo.state}`;
    item.textContent = `${node.label}\n${stateInfo.state}${stateInfo.attempts ? ` #${stateInfo.attempts}` : ""}`;
    item.style.left = `${node.x}px`;
    item.style.top = `${node.y}px`;
    item.dataset.nodeId = node.id;

    item.addEventListener("pointerdown", (ev) => {
      state.nodeDragging = {
        nodeId: node.id,
        startX: ev.clientX,
        startY: ev.clientY,
        originX: node.x,
        originY: node.y
      };
      item.setPointerCapture(ev.pointerId);
    });

    item.addEventListener("pointermove", (ev) => {
      if (!state.nodeDragging || state.nodeDragging.nodeId !== node.id) {
        return;
      }

      const dx = ev.clientX - state.nodeDragging.startX;
      const dy = ev.clientY - state.nodeDragging.startY;
      node.x = Math.max(0, state.nodeDragging.originX + dx);
      node.y = Math.max(0, state.nodeDragging.originY + dy);
      item.style.left = `${node.x}px`;
      item.style.top = `${node.y}px`;
      drawEdges();
    });

    item.addEventListener("pointerup", () => {
      state.nodeDragging = null;
    });

    el.flowNodes.appendChild(item);
  }

  drawEdges();
}

function setNodeStates(nodes) {
  state.nodeStateMap.clear();
  for (const one of nodes || []) {
    state.nodeStateMap.set(one.nodeId, {
      state: one.state,
      attempts: one.attempts,
      errorMessage: one.errorMessage
    });
  }
  renderFlowNodes();
}

async function ensureSession() {
  if (state.sessionId) {
    return state.sessionId;
  }

  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "创建会话失败");
  }

  state.sessionId = json.data.sessionId;
  el.sessionId.value = state.sessionId;
  return state.sessionId;
}

function ingestSessionAssets(session) {
  const list = session.assets || [];
  state.assets.clear();
  state.nextPlacementIndex = 0;

  for (const asset of list) {
    const point = nextPlacementPoint();
    upsertAsset({
      assetId: asset.assetId,
      url: asset.publicUrl,
      kind: asset.kind,
      roleTag: "",
      source: "session",
      x: point.x,
      y: point.y,
      width: 240,
      height: 180,
      folderPath: "",
      name: fileNameFromUrl(asset.publicUrl),
      versionId: asset.createdByVersionId || ""
    });
  }

  renderAssets();
}

async function fetchSession() {
  if (!state.sessionId) return;
  const res = await fetch(`/api/sessions/${state.sessionId}`);
  const json = await res.json();
  if (!json.ok) {
    return;
  }

  const session = json.data;
  const list = session.versions || [];
  el.history.innerHTML = "";

  if (session.currentVersionId) {
    state.currentVersionId = session.currentVersionId;
  }

  ingestSessionAssets(session);

  const currentVersion = list.find((v) => v.versionId === state.currentVersionId) || list[list.length - 1];
  if (currentVersion?.baseAssetId) {
    state.baseAssetId = currentVersion.baseAssetId;
  }
  if (currentVersion?.maskAssetId) {
    state.maskAssetId = currentVersion.maskAssetId;
  }

  for (const v of list) {
    const li = document.createElement("li");
    li.textContent = `${v.versionId} | ${formatAction(v.action)} | ${formatStatus(v.status)} | ${v.model}`;
    li.dataset.versionId = v.versionId;

    if (v.versionId === state.currentSelectedVersionId || (!state.currentSelectedVersionId && v.versionId === state.currentVersionId)) {
      li.classList.add("active");
    }

    li.addEventListener("click", () => {
      state.currentSelectedVersionId = v.versionId;
      state.currentVersionId = v.versionId;
      if (v.baseAssetId) {
        state.baseAssetId = v.baseAssetId;
      }
      if (v.maskAssetId) {
        state.maskAssetId = v.maskAssetId;
      }

      if (v.selectedOutputAssetId) {
        selectAsset(v.selectedOutputAssetId, false);
      }

      renderAssets();
      fetchSession();
    });

    el.history.appendChild(li);
  }

  renderAssets();
}

async function uploadAssetFile(file, roleTag = "base") {
  const sessionId = await ensureSession();
  const form = new FormData();
  form.append("file", file);
  form.append("kind", roleTag === "style" ? "reference" : roleTag === "mask" ? "mask" : "base");
  form.append("roleTag", roleTag === "style" ? "风格图" : roleTag === "mask" ? "蒙版" : "底图");
  form.append("sessionId", sessionId);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "上传失败");
  }

  const { asset } = json.data;
  const local = normalizeAssetFromUpload(asset, roleTag);
  local.name = file.name || local.name;
  local.folderPath = file.webkitRelativePath || "";
  upsertAsset(local);

  if (roleTag === "style") {
    state.styleAssetId = asset.assetId;
  }
  if (roleTag === "base") {
    state.baseAssetId = asset.assetId;
    state.baseUrl = asset.publicUrl;
  }
  if (roleTag === "mask") {
    state.maskAssetId = asset.assetId;
  }

  renderAssets();
  return asset;
}

async function importFiles(files, roleTag) {
  const valid = [...files].filter((f) => f.type.startsWith("image/"));
  if (valid.length === 0) {
    throw new Error("没有可导入的图片文件");
  }

  const results = [];
  for (let i = 0; i < valid.length; i += 1) {
    const file = valid[i];
    setStatus(`导入中 ${i + 1}/${valid.length}: ${file.name}`);
    const asset = await uploadAssetFile(file, roleTag || "base");
    results.push(asset);
  }

  if (results[0]) {
    selectAsset(results[0].assetId, false);
  }

  const roleText = roleTag === "style" ? "风格图" : roleTag === "mask" ? "蒙版" : "素材";
  setStatus(`${roleText}导入完成，共 ${results.length} 张`);
  await fetchSession();
}

function buildRunParams() {
  return {
    steps: Number(el.steps.value || 30),
    strength: Number(el.strength.value || 0.5),
    size: el.size.value.trim() || "1024x1024"
  };
}

function currentSelectionPayload() {
  return undefined;
}

function ingestAigcOutputs(outputs, source, versionId) {
  const created = [];
  for (const one of outputs || []) {
    const local = normalizeAssetFromAigc({
      assetId: one.assetId,
      url: one.url,
      source,
      versionId
    });
    upsertAsset(local);
    created.push(local);
  }

  if (created[0]) {
    state.baseAssetId = created[0].assetId;
    state.baseUrl = created[0].url;
    selectAsset(created[0].assetId, false);
  }

  renderAssets();
}

async function runText2Img() {
  const model = el.model.value.trim();
  const prompt = el.prompt.value.trim();
  if (!model || !prompt) {
    throw new Error("模型和提示词必填");
  }

  const sessionId = await ensureSession();
  const payload = {
    sessionId,
    model,
    prompt,
    negativePrompt: el.negativePrompt.value.trim() || undefined,
    params: buildRunParams()
  };

  const res = await fetch("/api/text2img", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "文生图失败");
  }

  const outputs = json.data.outputAssets || [];
  if (!outputs[0]) {
    throw new Error("没有生成结果图");
  }

  state.currentVersionId = json.data.versionId;
  state.currentSelectedVersionId = json.data.versionId;
  ingestAigcOutputs(outputs, "text2img", json.data.versionId);
  await fetchSession();
}

async function uploadMaskDataUrl(dataUrl) {
  const sessionId = await ensureSession();
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("file", new File([blob], "mask.png", { type: "image/png" }));
  form.append("kind", "mask");
  form.append("roleTag", "蒙版");
  form.append("sessionId", sessionId);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "蒙版上传失败");
  }

  const { asset } = json.data;
  upsertAsset({
    assetId: asset.assetId,
    url: asset.publicUrl,
    kind: asset.kind,
    roleTag: "mask",
    source: "upload",
    x: nextPlacementPoint().x,
    y: nextPlacementPoint().y,
    width: 220,
    height: 160,
    folderPath: "",
    name: `mask-${fileNameFromUrl(asset.publicUrl)}`,
    versionId: ""
  });

  state.maskAssetId = asset.assetId;
  renderAssets();
  return asset.assetId;
}

async function exportCurrentBaseMask() {
  if (!state.baseAssetId) {
    throw new Error("请先选中并设为底图");
  }

  const draft = state.maskDraftByBaseAssetId.get(state.baseAssetId);
  if (!draft) {
    throw new Error("当前底图还没有蒙版笔迹");
  }

  const dataUrl = draft.canvas.toDataURL("image/png");
  const maskAssetId = await uploadMaskDataUrl(dataUrl);
  setStatus(`蒙版已提交: ${maskAssetId}`);
  await fetchSession();
}

async function runInpaint() {
  if (!state.baseAssetId) {
    throw new Error("请先选中或上传底图");
  }

  if (!state.maskAssetId) {
    throw new Error("请先绘制并提交蒙版，或选中现有蒙版素材");
  }

  const model = el.model.value.trim();
  const prompt = el.prompt.value.trim();
  if (!model || !prompt) {
    throw new Error("模型和提示词必填");
  }

  const sessionId = await ensureSession();

  const payload = {
    sessionId,
    parentVersionId: state.currentVersionId || undefined,
    baseAssetId: state.baseAssetId,
    maskAssetId: state.maskAssetId,
    model,
    prompt,
    negativePrompt: el.negativePrompt.value.trim() || undefined,
    params: buildRunParams(),
    selection: currentSelectionPayload()
  };

  const res = await fetch("/api/inpaint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "局部重绘失败");
  }

  const outputs = json.data.outputAssets || [];
  if (!outputs[0]) {
    throw new Error("没有生成结果图");
  }

  state.currentVersionId = json.data.versionId;
  state.currentSelectedVersionId = json.data.versionId;
  ingestAigcOutputs(outputs, "inpaint", json.data.versionId);
  await fetchSession();
}

async function validateFlow() {
  const res = await fetch("/api/flows/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flow: flowPayload() })
  });

  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "流程校验失败");
  }

  if (json.data.valid) {
    setStatus(`流程校验通过，执行顺序: ${json.data.order.join(" -> ")}`);
  } else {
    setStatus(`流程校验失败: ${json.data.errors.join("; ")}`);
  }
}

async function runFlow() {
  const model = el.model.value.trim();
  const prompt = el.prompt.value.trim();
  if (!model || !prompt) {
    throw new Error("模型和提示词必填");
  }

  const sessionId = await ensureSession();

  const run = {
    model,
    prompt,
    negativePrompt: el.negativePrompt.value.trim() || undefined,
    params: buildRunParams(),
    parentVersionId: state.currentVersionId || undefined,
    baseAssetId: state.baseAssetId || undefined,
    styleAssetId: state.styleAssetId || undefined,
    maskAssetId: state.maskAssetId || undefined,
    selection: currentSelectionPayload()
  };

  const res = await fetch("/api/flows/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      flow: flowPayload(),
      run
    })
  });

  const json = await res.json();
  if (!json.ok) {
    setNodeStates(json.data?.nodes || []);
    throw new Error(json.error || "流程执行失败");
  }

  setNodeStates(json.data.nodes || []);

  if (json.data.output?.url && json.data.output?.assetId) {
    state.currentVersionId = json.data.versionId;
    state.currentSelectedVersionId = json.data.versionId;
    ingestAigcOutputs([
      {
        assetId: json.data.output.assetId,
        url: json.data.output.url
      }
    ], "flow", json.data.versionId);
  }

  await fetchSession();
}

async function refreshLogs() {
  const qs = new URLSearchParams();
  if (state.sessionId) {
    qs.set("sessionId", state.sessionId);
  }
  qs.set("limit", "30");
  const res = await fetch(`/api/logs?${qs.toString()}`);
  const json = await res.json();
  el.logOutput.textContent = JSON.stringify(json.data || json, null, 2);
}

async function loadTemplates() {
  const res = await fetch("/api/templates");
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "加载模板失败");
  }

  el.templateSelect.innerHTML = "";
  for (const t of json.data) {
    const option = document.createElement("option");
    option.value = t.name;
    option.textContent = t.name;
    option.dataset.prompt = t.prompt;
    option.dataset.negativePrompt = t.negativePrompt || "";
    el.templateSelect.appendChild(option);
  }
}

function applyTemplate() {
  const selected = el.templateSelect.selectedOptions[0];
  if (!selected) return;
  el.prompt.value = selected.dataset.prompt || "";
  el.negativePrompt.value = selected.dataset.negativePrompt || "";
}

async function saveTemplate() {
  const name = prompt("模板名");
  if (!name) return;

  const payload = {
    name,
    prompt: el.prompt.value.trim(),
    negativePrompt: el.negativePrompt.value.trim() || undefined
  };

  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.error || "保存模板失败");
  }

  await loadTemplates();
}

function exportCurrentImage() {
  const asset = selectedAsset();
  const targetUrl = asset?.url || state.baseUrl;
  if (!targetUrl) {
    throw new Error("当前没有可导出的结果图");
  }

  const a = document.createElement("a");
  a.href = targetUrl;
  const name = `${state.currentSelectedVersionId || state.currentVersionId || "current"}.png`;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function extractImageFilesFromClipboard(event) {
  const items = event.clipboardData?.items || [];
  const files = [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

function pickImageFilesFromDrop(event) {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return [];
  }

  return [...files].filter((file) => file.type.startsWith("image/"));
}

async function readEntryAsFile(entry) {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

async function readAllImageFilesFromEntry(entry, output) {
  if (!entry) {
    return;
  }

  if (entry.isFile) {
    const file = await readEntryAsFile(entry);
    if (file && file.type.startsWith("image/")) {
      output.push(file);
    }
    return;
  }

  if (!entry.isDirectory) {
    return;
  }

  const reader = entry.createReader();

  while (true) {
    const children = await new Promise((resolve) => {
      reader.readEntries(
        (entries) => resolve(entries || []),
        () => resolve([])
      );
    });

    if (!children.length) {
      break;
    }

    for (const child of children) {
      await readAllImageFilesFromEntry(child, output);
    }
  }
}

async function pickImageFilesOrFoldersFromDrop(event) {
  const direct = pickImageFilesFromDrop(event);
  if (direct.length > 0) {
    return direct;
  }

  const items = [...(event.dataTransfer?.items || [])];
  const entries = items
    .map((item) => {
      if (typeof item.webkitGetAsEntry === "function") {
        return item.webkitGetAsEntry();
      }
      return null;
    })
    .filter(Boolean);

  if (entries.length === 0) {
    return [];
  }

  const output = [];
  for (const entry of entries) {
    await readAllImageFilesFromEntry(entry, output);
  }
  return output;
}

function resetToolButtons() {
  el.toolBrush.classList.remove("active");
  el.toolEraser.classList.remove("active");
}

el.toolBrush.addEventListener("click", () => {
  state.tool = "brush";
  resetToolButtons();
  el.toolBrush.classList.add("active");
  setStatus("当前工具：画笔（在底图上直接绘制蒙版）");
});

el.toolEraser.addEventListener("click", () => {
  state.tool = "eraser";
  resetToolButtons();
  el.toolEraser.classList.add("active");
  setStatus("当前工具：橡皮（擦除底图上的蒙版）");
});

el.clearMask.addEventListener("click", () => {
  clearMaskSelection();
});

el.exportMask.addEventListener("click", async () => {
  try {
    await exportCurrentBaseMask();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.exportCurrent.addEventListener("click", () => {
  try {
    exportCurrentImage();
    setStatus("当前结果图已导出");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.zoomOut.addEventListener("click", () => setZoom(state.viewport.scale - 0.1));
el.zoomIn.addEventListener("click", () => setZoom(state.viewport.scale + 0.1));
el.zoomReset.addEventListener("click", () => {
  state.viewport.x = 0;
  state.viewport.y = 0;
  setZoom(1);
});

el.stage.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  setZoom(state.viewport.scale + delta, { x: e.clientX, y: e.clientY });
}, { passive: false });

el.stage.addEventListener("pointerdown", (e) => {
  if (e.target !== el.stage && e.target !== el.world) {
    return;
  }

  clearSelection();
  renderAssets();

  state.viewport.panning = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originX: state.viewport.x,
    originY: state.viewport.y
  };
  el.stage.classList.add("panning");
  el.stage.setPointerCapture(e.pointerId);
});

el.stage.addEventListener("pointermove", (e) => {
  if (!state.viewport.panning || state.viewport.panning.pointerId !== e.pointerId) {
    return;
  }

  const dx = e.clientX - state.viewport.panning.startX;
  const dy = e.clientY - state.viewport.panning.startY;
  state.viewport.x = state.viewport.panning.originX + dx;
  state.viewport.y = state.viewport.panning.originY + dy;
  applyViewportTransform();
});

el.stage.addEventListener("pointerup", () => {
  state.viewport.panning = null;
  el.stage.classList.remove("panning");
});

el.uploadBase.addEventListener("change", async (e) => {
  const files = e.target.files || [];
  if (files.length === 0) return;
  try {
    await importFiles(files, "base");
  } catch (error) {
    setStatus(error.message || String(error));
  } finally {
    e.target.value = "";
  }
});

el.uploadStyle.addEventListener("change", async (e) => {
  const files = e.target.files || [];
  if (files.length === 0) return;
  try {
    await importFiles(files, "style");
  } catch (error) {
    setStatus(error.message || String(error));
  } finally {
    e.target.value = "";
  }
});

el.uploadFolder?.addEventListener("change", async (e) => {
  const files = e.target.files || [];
  if (files.length === 0) return;
  try {
    await importFiles(files, "base");
  } catch (error) {
    setStatus(error.message || String(error));
  } finally {
    e.target.value = "";
  }
});

el.setAsBase?.addEventListener("click", () => {
  try {
    setSelectedAsBase();
    setStatus(`底图已设置: ${state.baseAssetId}`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.setAsStyle?.addEventListener("click", () => {
  try {
    setSelectedAsStyle();
    setStatus(`风格图已设置: ${state.styleAssetId}`);
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.runText2Img.addEventListener("click", async () => {
  try {
    setStatus("文生图处理中...");
    await runText2Img();
    setStatus("文生图完成");
    await refreshLogs();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.runInpaint.addEventListener("click", async () => {
  try {
    setStatus("局部重绘处理中...");
    await runInpaint();
    setStatus("局部重绘完成");
    await refreshLogs();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.validateFlow.addEventListener("click", async () => {
  try {
    await validateFlow();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.runFlow.addEventListener("click", async () => {
  try {
    setStatus("流程执行中...");
    await runFlow();
    setStatus("流程执行完成");
    await refreshLogs();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.refreshLogs.addEventListener("click", async () => {
  await refreshLogs();
});

el.loadTemplates.addEventListener("click", async () => {
  try {
    await loadTemplates();
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.applyTemplate.addEventListener("click", applyTemplate);
el.saveTemplate.addEventListener("click", async () => {
  try {
    await saveTemplate();
    setStatus("模板已保存");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

el.sessionId.addEventListener("change", async () => {
  state.sessionId = el.sessionId.value.trim();
  if (!state.sessionId) return;
  await fetchSession();
  await refreshLogs();
});

el.stage.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.stage.classList.add("dragover");
});

el.stage.addEventListener("dragleave", () => {
  el.stage.classList.remove("dragover");
});

el.stage.addEventListener("drop", async (e) => {
  e.preventDefault();
  el.stage.classList.remove("dragover");

  const files = await pickImageFilesOrFoldersFromDrop(e);
  if (files.length === 0) {
    setStatus("拖拽内容里没有可导入的图片");
    return;
  }

  try {
    await importFiles(files, "base");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

window.addEventListener("paste", async (e) => {
  const files = extractImageFilesFromClipboard(e);
  if (files.length === 0) {
    return;
  }

  try {
    await importFiles(files, "base");
  } catch (error) {
    setStatus(error.message || String(error));
  }
});

window.addEventListener("resize", () => {
  drawEdges();
  applyViewportTransform();
});

(async () => {
  renderFlowNodes();
  applyViewportTransform();
  setStatus("就绪");
  await loadTemplates().catch(() => {});
  await refreshLogs().catch(() => {});
})();
