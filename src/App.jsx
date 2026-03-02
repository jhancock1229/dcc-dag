import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { NODES, EDGES } from "./data.js";

// ─── Layout engines ────────────────────────────────────────────────────────

function manualPositions(nodes) {
  const m = {};
  nodes.forEach(n => { m[n.id] = { x: n.x, y: n.y }; });
  return m;
}

function hierarchicalPositions(nodes) {
  const BOOKS = [1, 2, 3, 4, 5, 6];
  const FACTIONS = ["PARTY","MEADOWLARK","CRAWLERS","ANTAGONISTS","NPCS","SYSTEM","MEDIA","BACKSTORY"];
  // Each book column is wide enough for 2 sub-lanes
  const COL_W = 420;   // gap between book centres
  const LANE_W = 110;  // x offset between the two sub-lanes within a faction group
  const NODE_H = 72;   // vertical gap between nodes in the same sub-lane
  const FACTION_GAP = 56; // extra vertical gap between faction groups
  const PAD_X = 200, PAD_Y = 120;
  const m = {};
  BOOKS.forEach(book => {
    const inBook = nodes.filter(n => n.book === book);
    const byFaction = {};
    inBook.forEach(n => { (byFaction[n.faction] = byFaction[n.faction] || []).push(n); });
    let curY = PAD_Y;
    const colCX = PAD_X + (book - 1) * COL_W;
    FACTIONS.forEach(f => {
      const group = byFaction[f] || [];
      if (group.length === 0) return;
      // Split into two sub-lanes when group is large enough
      const useTwoLanes = group.length > 2;
      group.forEach((n, i) => {
        let x, y;
        if (useTwoLanes) {
          const col = i % 2;          // 0 = left lane, 1 = right lane
          const row = Math.floor(i / 2);
          x = colCX + (col === 0 ? -LANE_W / 2 : LANE_W / 2);
          y = curY + row * NODE_H;
        } else {
          // Single lane centred in column
          x = colCX;
          y = curY + i * NODE_H;
        }
        m[n.id] = { x, y };
      });
      // Advance Y by the rows used in this faction group
      const rows = useTwoLanes ? Math.ceil(group.length / 2) : group.length;
      curY += rows * NODE_H + FACTION_GAP;
    });
  });
  return m;
}

function forceDirectedPositions(nodes, edges, iters = 320) {
  if (nodes.length === 0) return {};
  const W = 2400, H = 1600;
  const K = Math.sqrt((W * H) / nodes.length) * 0.9;
  const REPULSION = K * K * 2.2;
  const SPRING = 0.009;
  const DAMPING = 0.80;
  const CX = W / 2, CY = H / 2;

  // Compute faction centroids from manual positions — this is the "gravity home"
  const factionCentroid = {};
  const factionCount = {};
  nodes.forEach(n => {
    if (!factionCentroid[n.faction]) { factionCentroid[n.faction] = { x: 0, y: 0 }; factionCount[n.faction] = 0; }
    factionCentroid[n.faction].x += n.x;
    factionCentroid[n.faction].y += n.y;
    factionCount[n.faction]++;
  });
  Object.keys(factionCentroid).forEach(f => {
    factionCentroid[f].x /= factionCount[f];
    factionCentroid[f].y /= factionCount[f];
  });

  // Seed positions near faction centroid with some jitter
  const pos = {}, vel = {};
  nodes.forEach(n => {
    const cx = factionCentroid[n.faction]?.x ?? CX;
    const cy = factionCentroid[n.faction]?.y ?? CY;
    pos[n.id] = { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 };
    vel[n.id] = { x: 0, y: 0 };
  });

  const ids = nodes.map(n => n.id);
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  for (let iter = 0; iter < iters; iter++) {
    const cooling = 1 - (iter / iters) * 0.88;
    const force = {};
    ids.forEach(id => { force[id] = { x: 0, y: 0 }; });

    // Node-node repulsion
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const ia = ids[a], ib = ids[b];
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const mag = REPULSION / (dist * dist);
        const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
        force[ia].x += nx; force[ia].y += ny;
        force[ib].x -= nx; force[ib].y -= ny;
      }
    }

    // Edge springs
    edges.forEach(e => {
      if (!pos[e.from] || !pos[e.to]) return;
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const mag = (dist - K) * SPRING;
      const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
      force[e.from].x += nx; force[e.from].y += ny;
      force[e.to].x  -= nx; force[e.to].y  -= ny;
    });

    // Faction-centroid gravity — pull each node toward its faction's home
    const FACTION_GRAVITY = 0.022 * (1 - cooling * 0.5); // weakens as sim cools
    ids.forEach(id => {
      const n = nodeMap[id];
      const fc = factionCentroid[n.faction];
      if (fc) {
        force[id].x += (fc.x - pos[id].x) * FACTION_GRAVITY;
        force[id].y += (fc.y - pos[id].y) * FACTION_GRAVITY;
      }
    });

    // Integrate
    ids.forEach(id => {
      vel[id].x = (vel[id].x + force[id].x) * DAMPING;
      vel[id].y = (vel[id].y + force[id].y) * DAMPING;
      const speed = Math.sqrt(vel[id].x ** 2 + vel[id].y ** 2);
      const maxSpeed = K * cooling * 0.5;
      if (speed > maxSpeed) { vel[id].x *= maxSpeed / speed; vel[id].y *= maxSpeed / speed; }
      pos[id].x = Math.max(60, Math.min(W - 60, pos[id].x + vel[id].x));
      pos[id].y = Math.max(60, Math.min(H - 60, pos[id].y + vel[id].y));
    });
  }
  return pos;
}

// ─── Prominence weights (appearance / narrative importance score) ──────────
// Scale 1–10. Carl=10, Donut=10. Scores approximate how often / centrally
// each character features across all 7 books.
export const PROMINENCE = {
  carl: 10, donut: 10, mordecai: 8, katia: 8, mongo: 7,
  samantha: 7, louis: 6, imani: 6, bautista: 5, britney: 5,
  juice_box: 5, zev: 5, odette: 5, li_jun: 4, li_na: 4,
  zhang: 4, prepotente: 5, miriam: 4, bianca: 3, angelo: 1,
  world_ai: 6, borant: 4, cascadia: 4, harbinger: 3,
  baroness_victory: 3, agatha: 4,
  signet: 4, quan: 3, lucia_mar: 4,
  florin: 3, ifechi: 2, tran: 2, osvaldo: 2,
  sister_ines: 3, paz_lo: 3, anton: 2,
  shi_maria: 5, heyzoos: 2, amayon: 3, ysalte: 3,
  ferdinand: 4, architect_houston: 4, d_nadia: 3, stockade: 3, eris: 4, eileithyia: 3,
  beatrice: 3, chris_andrews: 3,
  prince_stalwart: 3, maestro: 3, prince_gurgle: 2,
  remex: 3, drakea: 2, porthus: 2, herot: 2,
  rosetta_thagra: 2, milk: 2,
  epitome_tagg: 2,
  king_rust: 4, formidable: 3, porthus: 4,
  rosetta_thagra: 5, tipid: 3, milk: 3, justice_light: 4, volteeg: 3, vinata: 3,
  // fill any remaining with 1.5
};

function getProminence(id) {
  return PROMINENCE[id] ?? 1.5;
}

// Prominence layout: faction-seeded force with size-weighted repulsion
function prominencePositions(nodes, edges, iters = 380) {
  if (nodes.length === 0) return {};
  const W = 3800, H = 2600;
  const DAMPING = 0.78;
  const CX = W / 2, CY = H / 2;

  const factionCentroid = {};
  const factionCount = {};
  nodes.forEach(n => {
    if (!factionCentroid[n.faction]) { factionCentroid[n.faction] = { x: 0, y: 0 }; factionCount[n.faction] = 0; }
    factionCentroid[n.faction].x += n.x;
    factionCentroid[n.faction].y += n.y;
    factionCount[n.faction]++;
  });
  Object.keys(factionCentroid).forEach(f => {
    factionCentroid[f].x /= factionCount[f];
    factionCentroid[f].y /= factionCount[f];
  });

  const pos = {}, vel = {};
  nodes.forEach(n => {
    const cx = factionCentroid[n.faction]?.x ?? CX;
    const cy = factionCentroid[n.faction]?.y ?? CY;
    pos[n.id] = { x: cx + (Math.random() - 0.5) * 180, y: cy + (Math.random() - 0.5) * 180 };
    vel[n.id] = { x: 0, y: 0 };
  });

  const ids = nodes.map(n => n.id);
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  for (let iter = 0; iter < iters; iter++) {
    const cooling = 1 - (iter / iters) * 0.88;
    const force = {};
    ids.forEach(id => { force[id] = { x: 0, y: 0 }; });

    // Repulsion scaled by the sum of both node radii (bigger nodes push harder)
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const ia = ids[a], ib = ids[b];
        const ra = 14 + getProminence(ia) * 3.2;
        const rb = 14 + getProminence(ib) * 3.2;
        const minDist = ra + rb + 55;
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const REPULSION = minDist * minDist * 2.6;
        const mag = REPULSION / (dist * dist);
        const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
        force[ia].x += nx; force[ia].y += ny;
        force[ib].x -= nx; force[ib].y -= ny;
      }
    }

    // Edge springs
    const K = 130;
    edges.forEach(e => {
      if (!pos[e.from] || !pos[e.to]) return;
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const mag = (dist - K) * 0.01;
      const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
      force[e.from].x += nx; force[e.from].y += ny;
      force[e.to].x  -= nx; force[e.to].y  -= ny;
    });

    // Faction-centroid gravity
    const FACTION_GRAVITY = 0.024 * (1 - cooling * 0.4);
    ids.forEach(id => {
      const n = nodeMap[id];
      const fc = factionCentroid[n.faction];
      if (fc) {
        force[id].x += (fc.x - pos[id].x) * FACTION_GRAVITY;
        force[id].y += (fc.y - pos[id].y) * FACTION_GRAVITY;
      }
    });

    const K_base = Math.sqrt((W * H) / nodes.length) * 0.9;
    ids.forEach(id => {
      vel[id].x = (vel[id].x + force[id].x) * DAMPING;
      vel[id].y = (vel[id].y + force[id].y) * DAMPING;
      const speed = Math.sqrt(vel[id].x ** 2 + vel[id].y ** 2);
      const maxSpeed = K_base * cooling * 0.5;
      if (speed > maxSpeed) { vel[id].x *= maxSpeed / speed; vel[id].y *= maxSpeed / speed; }
      pos[id].x = Math.max(70, Math.min(W - 70, pos[id].x + vel[id].x));
      pos[id].y = Math.max(70, Math.min(H - 70, pos[id].y + vel[id].y));
    });
  }
  return pos;
}

const LAYOUTS = [
  { id: "manual",       label: "Manual",    icon: "✦", desc: "Hand-tuned" },
  { id: "hierarchical", label: "Story Arc", icon: "⟶", desc: "Books as columns" },
  { id: "force",        label: "Force",     icon: "⬡", desc: "Physics" },
  { id: "prominence",   label: "Prominence",icon: "◎", desc: "Sized by importance" },
];

// ─── Styles ────────────────────────────────────────────────────────────────

const FACTION_STYLE = {
  PARTY:       { color: "#8b2500", dim: "#fdf0e0", label: "Carl's Party" },
  MEADOWLARK:  { color: "#2d6a2d", dim: "#e8f5e8", label: "Meadow Lark" },
  CRAWLERS:    { color: "#5c2d8e", dim: "#f0e8f8", label: "Other Crawlers" },
  ANTAGONISTS: { color: "#6b0000", dim: "#fde8e8", label: "Antagonists" },
  SYSTEM:      { color: "#1a1a6e", dim: "#e8e8f8", label: "System / Borant" },
  MEDIA:       { color: "#1a4a6e", dim: "#e0eef8", label: "Galactic Media" },
  NPCS:        { color: "#7a3800", dim: "#f8ede0", label: "Dungeon NPCs/Elites" },
  BACKSTORY:   { color: "#3d3528", dim: "#f0ece4", label: "Pre-Dungeon" },
};

const EDGE_STYLE = {
  party:       { color: "#8b2500" }, trains:      { color: "#6b3800" },
  allied:      { color: "#2d6a2d" }, protected:   { color: "#2d6a2d" },
  killed:      { color: "#6b0000" }, antagonizes: { color: "#6b0000" },
  hunts:       { color: "#6b0000" }, controls:    { color: "#5c2d8e" },
  employs:     { color: "#5c2d8e" }, manages:     { color: "#1a4a6e" },
  hosts:       { color: "#1a4a6e" }, rescued:     { color: "#2d6a2d" },
  companion:   { color: "#8b2500" }, causes:      { color: "#7a3800" },
  exgf:        { color: "#6b5a3d" }, leads:       { color: "#2d6a2d" },
  puppet:      { color: "#6b0000" }, connected:   { color: "#8a7a65" },
  quest:       { color: "#7a3800" }, joined:      { color: "#2d6a2d" },
  brokers:     { color: "#1a4a6e" }, coerces:     { color: "#6b0000" },
  loved:       { color: "#7a3800" }, replaces:    { color: "#5c2d8e" },
  tricks:      { color: "#6b0000" }, mentors:     { color: "#6b3800" },
};

const ROLE_EMOJI = {
  "Crawler": "⚔️",  "Mage": "🔮",         "Healer": "💚",       "Trickster": "🃏",
  "Engineer": "⚙️", "Juggernaut": "🚛",    "Summoner": "🌸",     "Companion": "🐾",
  "Caretaker": "🧑‍⚕️","Resident": "👴",    "Player Killer": "🗡️","Boss": "💀",
  "Show Host": "📺", "Host/Boss": "👑",     "PR Agent": "📣",     "Admin": "🖥️",
  "Corp Entity": "🏢","Elite NPC": "✨",    "NPC": "🧙",          "Survivor": "🏃",
  "Pre-Dungeon": "💔","Aerialist": "🐐",   "Shepherd": "🌿",     "Antagonist": "⚡",
  "Medic": "🏥",     "Hunter": "🎯",       "Hunter Leader": "🪲","Country Boss": "👸",
  "Boss/Pet": "🐈",  "Pet/Ally": "🦕",  "Pet/Familiar": "🐾",     "Boss/Deity": "🕷️",  "Deity": "⛩️",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getNodeById(id) { return NODES.find(n => n.id === id); }

function computeArrow(from, to, r = 24) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const x1 = from.x + ux * r, y1 = from.y + uy * r;
  const x2 = to.x - ux * (r + 9), y2 = to.y - uy * (r + 9);
  const mx = (x1 + x2) / 2 - uy * 26, my = (y1 + y2) / 2 + ux * 26;
  return { x1, y1, x2, y2, mx, my };
}

// ─── Main component ────────────────────────────────────────────────────────

export default function DCCDag() {
  const svgRef = useRef(null);
  const [page, setPage] = useState("dag"); // "dag" | "cookbook"
  const [layout, setLayout] = useState("prominence");
  const [isComputing, setIsComputing] = useState(false);

  // Positions: manual uses data.js coords; others are computed
  const [positionsByLayout, setPositionsByLayout] = useState(() => ({
    manual: (() => { const m = {}; NODES.forEach(n => { m[n.id] = { x: n.x, y: n.y }; }); return m; })(),
    hierarchical: null,
    force: null,
    prominence: prominencePositions(NODES, EDGES),
  }));

  // Per-layout user drag overrides
  const [userDrag, setUserDrag] = useState({ manual: {}, hierarchical: {}, force: {}, prominence: {} });

  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  // Graph bounding box (manual layout) — computed once
  const GRAPH_BOUNDS = { minX: 0, maxX: 3800, minY: 0, maxY: 2600 };
  const [pan, setPan] = useState({ x: 0, y: 20 });
  const [zoom, setZoom] = useState(0.72);
  const [filterFaction, setFilterFaction] = useState("ALL");
  const [filterBook, setFilterBook] = useState("ALL");
  const dragging = useRef(null);
  const panStart = useRef(null);
  const isPanning = useRef(false);

  // Compute layout when switching
  useEffect(() => {
    if (positionsByLayout[layout] !== null) return;
    setIsComputing(true);
    // Run in a timeout so the UI can show "computing" first
    const tid = setTimeout(() => {
      let computed;
      const visNodes = NODES.filter(n => {
        if (filterFaction !== "ALL" && n.faction !== filterFaction) return false;
        if (filterBook !== "ALL" && n.book > Number(filterBook)) return false;
        return true;
      });
      if (layout === "hierarchical") computed = hierarchicalPositions(NODES);
      if (layout === "force")        computed = forceDirectedPositions(NODES, EDGES);
      if (layout === "prominence")   computed = prominencePositions(NODES, EDGES);
      setPositionsByLayout(prev => ({ ...prev, [layout]: computed }));
      setIsComputing(false);
    }, 40);
    return () => clearTimeout(tid);
  }, [layout]);

  // Center the graph once the SVG is actually sized in the DOM
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current) return;
    const el = svgRef.current;
    if (!el) return;
    const doCenter = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return false;
      const { minX, maxX, minY, maxY } = GRAPH_BOUNDS;
      const graphW = maxX - minX;
      const graphH = maxY - minY;
      const fitZoom = Math.min(width / graphW, height / graphH) * 0.85;
      const z = Math.min(0.82, Math.max(0.35, fitZoom));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setPan({ x: width / 2 - cx * z, y: height / 2 - cy * z });
      setZoom(z);
      return true;
    };
    if (!doCenter()) {
      // SVG not sized yet — observe until it is
      const ro = new ResizeObserver(() => {
        if (doCenter()) { ro.disconnect(); centeredRef.current = true; }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      centeredRef.current = true;
    }
  }, []);

  // Recompute force layout when re-requested (shuffle button)
  const reshuffleForce = useCallback(() => {
    setIsComputing(true);
    setPositionsByLayout(prev => ({ ...prev, [layout]: null }));
    setUserDrag(prev => ({ ...prev, [layout]: {} }));
  }, [layout]);

  // Merge computed base + user drag overrides
  const positions = useMemo(() => {
    const base = positionsByLayout[layout];
    if (!base) return {};
    const overrides = userDrag[layout] || {};
    const merged = { ...base };
    Object.entries(overrides).forEach(([id, pos]) => { merged[id] = pos; });
    return merged;
  }, [positionsByLayout, userDrag, layout]);

  const selectedNode = selected ? NODES.find(n => n.id === selected) : null;
  const activeId = hovered || selected;

  const visibleNodes = NODES.filter(n => {
    if (filterFaction !== "ALL" && n.faction !== filterFaction) return false;
    if (filterBook !== "ALL" && n.book > Number(filterBook)) return false;
    return true;
  });
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = EDGES.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

  const connectedIds = activeId
    ? new Set([activeId, ...visibleEdges.filter(e => e.from === activeId || e.to === activeId).map(e => e.from === activeId ? e.to : e.from)])
    : null;

  const onNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    const pos = positions[id];
    if (!pos) return;
    dragging.current = { id, startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y };
  }, [positions]);

  const onSvgMouseDown = useCallback((e) => {
    if (!dragging.current) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [pan]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        const { id, startX, startY, ox, oy } = dragging.current;
        const newPos = { x: ox + (e.clientX - startX) / zoom, y: oy + (e.clientY - startY) / zoom };
        setUserDrag(prev => ({
          ...prev,
          [layout]: { ...(prev[layout] || {}), [id]: newPos },
        }));
      } else if (isPanning.current && panStart.current) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    };
    const onUp = () => { dragging.current = null; isPanning.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom, layout]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.2, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const centerGraph = useCallback((targetZoom) => {
    const el = svgRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width === 0) return;
    const { minX, maxX, minY, maxY } = GRAPH_BOUNDS;
    const graphW = maxX - minX;
    const graphH = maxY - minY;
    const fitZoom = targetZoom ?? Math.min(width / graphW, height / graphH) * 0.88;
    const z = Math.min(0.82, Math.max(0.35, fitZoom));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setPan({ x: width / 2 - cx * z, y: height / 2 - cy * z });
    setZoom(z);
  }, []);

  const DEFAULT_ZOOM = { manual: null, hierarchical: 0.38, force: 0.55, prominence: 0.55 };

  const switchLayout = useCallback((id) => {
    setLayout(id);
    centerGraph(DEFAULT_ZOOM[id]);
    setSelected(null);
  }, [centerGraph]);

  return (
    <div style={{
      height: "100vh", width: "100%",
      background: "#f0e4c4",
      backgroundImage: `
        radial-gradient(ellipse 80% 60% at 15% 10%, rgba(101,47,0,0.09) 0%, transparent 55%),
        radial-gradient(ellipse 60% 70% at 88% 88%, rgba(60,20,0,0.07) 0%, transparent 55%),
        linear-gradient(160deg, #f5ead0 0%, #ecddb8 50%, #e8d5a8 100%)
      `,
      fontFamily: "'IM Fell English', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
      color: "#1a0d00", display: "flex", flexDirection: "column",
      userSelect: "none", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "linear-gradient(180deg, #2a1500 0%, #1a0c00 100%)",
        borderBottom: "3px solid #c9a84c",
        boxShadow: "0 3px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.2)",
        zIndex: 50, flexShrink: 0, gap: 8, minHeight: 48, overflow: "hidden",
      }}>
        <div style={{ flexShrink: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#c9a84c", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 0 20px rgba(201,168,76,0.5), 0 1px 3px rgba(0,0,0,0.8)", fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif" }}>
            ⚔ Dungeon Crawler Carl
          </span>
          <span className="dag-subtitle" style={{ marginLeft: 10, fontSize: 10, color: "rgba(201,168,76,0.45)", letterSpacing: "0.06em", fontFamily: "monospace" }}>Books 1–7 · Character DAG · {NODES.length} characters · {EDGES.length} edges</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {page === "dag" && <>
            <div style={{ display: "flex", gap: 3 }}>
              {["ALL","1","2","3","4","5","6","7"].map(b => (
                <button key={b} onClick={() => { setFilterBook(b); setSelected(null); }}
                  style={{
                    background: filterBook === b ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)",
                    border: filterBook === b ? "1px solid rgba(201,168,76,0.7)" : "1px solid rgba(201,168,76,0.2)",
                    borderRadius: 3, color: filterBook === b ? "#c9a84c" : "rgba(201,168,76,0.5)",
                    padding: "4px 8px", fontSize: 11, cursor: "pointer", minWidth: 28, textAlign: "center",
                    fontFamily: "'Cinzel', Georgia, serif",
                  }}>
                  {b === "ALL" ? "All" : b}
                </button>
              ))}
            </div>
            <select value={filterFaction} onChange={e => { setFilterFaction(e.target.value); setSelected(null); }}
              style={{ background: "#1a0c00", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 3, color: "#c9a84c", padding: "4px 9px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia, serif" }}>
              <option value="ALL">All Groups</option>
              {Object.entries(FACTION_STYLE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={() => centerGraph(DEFAULT_ZOOM[layout])}
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 3, color: "#c9a84c", padding: "4px 11px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: "0.04em" }}>
              ↺ Reset View
            </button>
            {selected && (
              <button onClick={() => setSelected(null)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: "rgba(201,168,76,0.5)", padding: "4px 11px", fontSize: 11, cursor: "pointer" }}>
                ✕ Clear
              </button>
            )}
          </>}
          <button onClick={() => setPage(p => p === "cookbook" ? "dag" : "cookbook")}
            style={{ background: page === "cookbook" ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)", border: page === "cookbook" ? "1px solid rgba(201,168,76,0.6)" : "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: page === "cookbook" ? "#c9a84c" : "rgba(201,168,76,0.5)", padding: "4px 12px", fontSize: 11, cursor: "pointer", letterSpacing: "0.06em", fontFamily: "Georgia, serif" }}>
            📖 Cookbook Authors
          </button>
        </div>
      </div>

      {page === "cookbook" && <CookbookPage />}
      {page === "dag" && <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Computing overlay */}
        {isComputing && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 100,
            background: "rgba(26,13,0,0.82)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontSize: 28, animation: "spin 1.2s linear infinite" }}>⬡</div>
            <div style={{ fontSize: 13, color: "#c9a84c", letterSpacing: "0.18em", fontFamily: "Cinzel, Georgia, serif" }}>⚔ Computing Layout…</div>
          </div>
        )}

        <svg ref={svgRef} style={{ flex: 1, display: "block", cursor: "grab" }}
          onMouseDown={onSvgMouseDown} onClick={() => setSelected(null)}>
          <defs>
            {Object.entries(EDGE_STYLE).map(([type, s]) => (
              <marker key={type} id={`arr-${type}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={s.color} opacity="0.9" />
              </marker>
            ))}
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="glow2"><feGaussianBlur stdDeviation="5.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {/* Story Arc column headers */}
          {layout === "hierarchical" && (
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {[1,2,3,4,5,6,7].map(b => (
                <g key={b}>
                  <rect x={200 + (b-1)*420 - 130} y={20} width={260} height={62} rx={8}
                    fill="rgba(26,13,0,0.06)" stroke="rgba(201,168,76,0.25)" strokeWidth={1} />
                  <text x={200 + (b-1)*420} y={44} textAnchor="middle"
                    fontSize={13} fontWeight="700" fill="#5c2800" opacity={0.9} fontFamily="Cinzel, Georgia, serif"
                    style={{ fontFamily: "Georgia,serif", letterSpacing: "0.08em" }}>
                    BOOK {b}
                  </text>
                  <text x={200 + (b-1)*420} y={62} textAnchor="middle"
                    fontSize={9} fill="#8a6a3a" style={{ fontFamily: "monospace" }}>
                    {NODES.filter(n => n.book === b).length} characters
                  </text>
                </g>
              ))}
            </g>
          )}

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <rect x="-9999" y="-9999" width="22000" height="22000" fill="rgba(210,185,130,0.0)" />
            {visibleEdges.map((e, i) => {
              const fn = positions[e.from], tn = positions[e.to];
              if (!fn || !tn) return null;
              const { x1, y1, x2, y2, mx, my } = computeArrow(fn, tn);
              const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
              const active = activeId && (e.from === activeId || e.to === activeId);
              const dimmed = connectedIds && !active;
              return (
                <g key={i}>
                  <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                    fill="none" stroke={es.color}
                    strokeWidth={active ? 2.2 : 0.9}
                    strokeOpacity={dimmed ? 0.04 : active ? 0.9 : 0.22}
                    markerEnd={`url(#arr-${e.type})`}
                    style={{ transition: "stroke-opacity 0.15s" }}
                  />
                  {active && (
                    <text x={mx} y={my - 7} fontSize="9" fill={es.color} opacity="0.88"
                      textAnchor="middle" pointerEvents="none"
                      style={{ fontFamily: "monospace", letterSpacing: "0.04em" }}>
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}
            {visibleNodes.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const fs = FACTION_STYLE[node.faction];
              const isSel = selected === node.id;
              const isHov = hovered === node.id;
              const dimmed = connectedIds && !connectedIds.has(node.id);
              const baseR = layout === "prominence" ? Math.round(12 + getProminence(node.id) * 3.0) : 24;
              const R = isSel ? baseR + 8 : isHov ? baseR + 5 : baseR;
              const bookColor = node.book === 3 ? "#2d6a2d" : node.book === 2 ? "#5c2d8e" : null;
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : node.id); }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}>

                  {(isSel || isHov) && (
                    <circle r={R + 9} fill="none" stroke={fs.color}
                      strokeWidth={isSel ? 2 : 1} opacity={isSel ? 0.45 : 0.18} />
                  )}
                  <circle r={R}
                    fill={isSel ? fs.dim : isHov ? "#fdf5e0" : "#f8efd4"}
                    stroke={fs.color}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                    opacity={dimmed ? 0.2 : 1}
                    style={{ transition: "all 0.14s ease", filter: isSel ? `drop-shadow(0 0 6px ${fs.color}66)` : "drop-shadow(0 1px 2px rgba(0,0,0,0.14))" }}
                  />

                  <text y={-2} textAnchor="middle" fontSize={isSel ? 16 : 14}
                    opacity={dimmed ? 0.1 : 0.85} style={{ pointerEvents: "none" }}>
                    {ROLE_EMOJI[node.role] || "●"}
                  </text>
                  {(isSel || isHov || getProminence(node.id) >= 4) && (
                    <text y={R + 16} textAnchor="middle"
                      fontSize={isSel ? 13 : isHov ? 12 : 11} fontWeight={isSel ? "700" : isHov ? "600" : "500"}
                      fill={isSel || isHov ? fs.color : "#3d2000"}
                      opacity={dimmed ? 0.12 : isSel || isHov ? 1 : 0.75}
                      style={{ pointerEvents: "none", fontFamily: "'IM Fell English', 'Palatino Linotype', Georgia, serif" }}>
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Sidebar */}
        <div style={{
          width: selectedNode ? 315 : 0, minWidth: selectedNode ? 315 : 0,
          overflow: "hidden", transition: "all 0.27s cubic-bezier(.4,0,.2,1)",
          borderLeft: "1px solid rgba(180,83,9,0.12)",
          background: "rgba(4,4,10,0.95)", backdropFilter: "blur(20px)",
          flexShrink: 0,
        }}>
          {selectedNode && <Sidebar node={selectedNode} onSelect={setSelected} />}
        </div>

        {/* Legend + Layout switcher */}
        <div style={{
          position: "absolute", bottom: 14, left: 14,
          background: "linear-gradient(170deg, #f5ead0 0%, #ecddb8 100%)",
          border: "1px solid rgba(139,105,20,0.45)",
          boxShadow: "2px 2px 10px rgba(0,0,0,0.18), inset 0 0 20px rgba(139,105,20,0.06)", borderRadius: 10, padding: "11px 13px",
          minWidth: 168, maxHeight: "calc(100vh - 80px)", overflowY: "auto",
        }}>
          {/* Layout toggle */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(139,105,20,0.3)" }}>
            <div style={{ fontSize: 9, color: "#6b4c1a", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6, fontFamily: "Cinzel, Georgia, serif" }}>Layout</div>
            <div style={{ display: "flex", gap: 4 }}>
              {LAYOUTS.map(l => (
                <button key={l.id}
                  onClick={() => { if ((l.id === "force" || l.id === "prominence") && layout === l.id) reshuffleForce(); else switchLayout(l.id); }}
                  title={(l.id === "force" || l.id === "prominence") && layout === l.id ? "Click to reshuffle" : l.desc}
                  style={{
                    flex: 1, padding: "5px 4px", borderRadius: 6, cursor: "pointer",
                    background: layout === l.id ? "rgba(139,105,20,0.2)" : "rgba(139,105,20,0.06)",
                    border: layout === l.id ? "1px solid rgba(139,105,20,0.6)" : "1px solid rgba(139,105,20,0.25)",
                    color: layout === l.id ? "#3d2000" : "#6b4c1a",
                    fontSize: 9, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    transition: "all 0.15s",
                  }}>
                  <span style={{ fontSize: 13 }}>{l.icon}</span>
                  <span style={{ letterSpacing: "0.04em", fontFamily: "monospace" }}>{l.label}</span>
                </button>
              ))}
            </div>
            {(layout === "force" || layout === "prominence") && (
              <div style={{ fontSize: 9, color: "#8b6914", textAlign: "center", marginTop: 5, fontFamily: "monospace", fontStyle: "italic" }}>
                click again to reshuffle
              </div>
            )}
          </div>

          {/* Faction legend */}
          <div style={{ fontSize: 9, color: "#6b4c1a", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7, fontFamily: "Cinzel, Georgia, serif" }}>Groups</div>
          {Object.entries(FACTION_STYLE).map(([k, v]) => (
            <div key={k} onClick={() => setFilterFaction(filterFaction === k ? "ALL" : k)}
              style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, cursor: "pointer", opacity: filterFaction !== "ALL" && filterFaction !== k ? 0.3 : 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 10, color: "#2a1500", fontFamily: "'IM Fell English', Georgia, serif" }}>{v.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(139,105,20,0.25)", paddingTop: 6 }}>
            {[["#5c2d8e","Book 2"],["#2d6a2d","Book 3"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 18, height: 9, borderRadius: "50%", border: `1px dashed ${c}`, opacity: 0.6 }} />
                <span style={{ fontSize: 9.5, color: "#6b4c1a" }}>{l} character</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 14, right: selectedNode ? 329 : 14,
          background: "rgba(245,230,200,0.92)", borderRadius: 3,
          padding: "3px 9px", fontSize: 10, color: "#6b4c1a",
          border: "1px solid rgba(139,105,20,0.3)", boxShadow: "1px 1px 4px rgba(0,0,0,0.15)", fontFamily: "monospace",
        }}>
          {Math.round(zoom * 100)}%
        </div>
      </div>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 600px) { .dag-subtitle { display: none; } }
        button { font-family: inherit; }
        select { font-family: inherit; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}

// ─── Cookbook Authors Page ─────────────────────────────────────────────────

const AUTHORS = [
  {
    ed: 1, suffix: "st", name: "[Unknown]", race: "Unknown", isUnknown: true,
    season: "Unknown — predates 15th season",
    contributions: "The first edition was seeded by the System AI and given to Porthus disguised as a blank sketchbook on Floor 9 during the 15th season. Porthus describes its contents as \"meager, mostly-useless recipes.\" No author is named.",
    status: "unknown", statusNote: "",
    whereabouts: "No record exists. The book may have been self-created by the System AI.",
    b7: false,
  },
  {
    ed: 2, suffix: "nd", name: "Dr. Porthus Hu", race: "High Elf (chosen)",
    season: "15th season of Dungeon Crawler World",
    contributions: "Chose High Elf race and Rogue class. Received the 1st edition as a blank sketchbook on Floor 9 and added to it before taking a 100-year indentured servitude Exit Deal at Floor 11. Wrote: \"I can only promise two things. Eventual death. And eventual justice.\"",
    status: "alive", statusNote: "Active OIPAN CEO as of Book 7",
    whereabouts: "Free post-indentureship. Founded OIPAN (Open Intellect Pacifist Action Network) and serves as CEO. Sponsored Carl's second slot on Floor 5, sent the Toraline and the legendary custom xistera extension. In Book 7, sponsors the entire cookbook-author cohort to enter Faction Wars for the Princess Posse.",
    b7: false,
  },
  {
    ed: 3, suffix: "rd", name: "Dante", race: "Crocodilian",
    season: "Unknown — post-15th season",
    contributions: "Kept his Crocodilian race on Floor 3. Trap specialist. Took an Exit Deal at the 11th Floor; became a Game Guide and Guildhall Instructor in the Trap Master Guild. Was forcibly reassigned — against his will — to ice castle guard duty alongside Justice Light (8th Edition) during a flightless mantid crawl.",
    status: "dead", statusNote: "Executed by Borant for insubordination",
    whereabouts: "Killed by administrative action for refusing orders during the ice castle reassignment. Died while still under indentureship.",
    b7: false,
  },
  {
    ed: 4, suffix: "th", name: "Tipid", race: "Crest",
    season: "Thousands of years ago",
    contributions: "Thousands of years ago. His defining entries document the trauma of descending a stairwell alone via the Mysterious Bone Key Benefit, leaving his best friend Horatio behind to die. Wrote only about survival, guilt, and loss. \"I always knew I would die in the dungeon. Even after I got out, I always knew.\" Took a 12th Floor Exit Deal; served as Poisoner Guild instructor.",
    status: "unknown", statusNote: "Fought in Faction Wars; fate unclear",
    whereabouts: "Observed Floor 8's end with Rosetta aboard the Homecoming Queen. In Book 7, entered Floor 9 as a Colonel in the Princess Posse army. Status after Faction Wars not confirmed.",
    b7: true,
  },
  {
    ed: 5, suffix: "th", name: "Everly", race: "Arthropod (likely — mentions \"chitin\")",
    season: "Thousands of cycles ago",
    contributions: "Member of the Desperado Club. Led a diverse party with paid mercenaries from the Merc Guild and a Club Vanquisher healer. Wrote extensively on hiring mercs, daily rates, and team dynamics. Her sponsor (Dictum Waystation Controls) earned her trust with one gift — then killed her with the next, a sabotaged Benefactor Box arriving on Floor 8. Drakea noted: \"She did not mention the manner in which she was set up, which is unfortunate.\"",
    status: "dead", statusNote: "Killed by a booby-trapped Benefactor Box",
    whereabouts: "Killed on Floor 8 by a sponsor-delivered trap. A cautionary tale for every author after her about trusting sponsors.",
    b7: false,
  },
  {
    ed: 6, suffix: "th", name: "Milk", race: "Half-frog / half-bat hybrid",
    season: "Unknown",
    contributions: "Primary expertise: portals, mapmaking, and ink recipes. Her entry on toraline-based ink was the key clue Rosetta tried to hint to Carl on Shadow Boxer. Drew still the most accurate map of Larracos (Floor 9) in the entire cookbook. Confirmed stairwell mechanics (validated by Herot). Responded to Rosetta's entries in agreement. Earned at least one player-killer skull.",
    status: "alive", statusNote: "Freed by Prepotente; present at Faction Wars",
    whereabouts: "Was trapped for 50+ seasons as unwilling Guildmaster of the Calligraphy and Cartography Guilds inside a hidden section of Club Vanquisher. In Book 7, Prepotente discovers and rescues her. She gives Carl the Adept's Fountain Pen. Present for Faction Wars.",
    b7: true,
  },
  {
    ed: 7, suffix: "th", name: "Volteeg", race: "Unknown (entered as a pet)",
    season: "Unknown",
    contributions: "One of the most haunting authors. Wrote only a single entry: \"I miss her. I miss her so goddamn much. Is it worth it? To survive this place with her gone? No. No, I don't think it is.\" The subject was Mistress Henspar, who brought Volteeg into the dungeon as a pet via an enhanced biscuit. Drakea: \"This is Volteeg's first, last, and only entry in the cookbook. Fuck everything about this place.\" Took a 10th Floor Exit Deal; worked as guard at the Rampart Guild.",
    status: "unknown", statusNote: "Fought for Operatic Collective; fate unclear",
    whereabouts: "Returned to Floor 9 in Book 7 as a mercenary for the Operatic Collective — fighting against the Princess Posse. Gets a full POV chapter. His actions had a very significant impact on the outcome of Faction Wars.",
    b7: true,
  },
  {
    ed: 8, suffix: "th", name: "Justice Light", race: "Skyfowl",
    season: "Unknown. Reached level 89",
    contributions: "Wrote extensively on traps, trap design, and trap shops. One of the most morally tortured authors — haunted by killing an NPC in anger: \"I have become what I hate.\" This experience drove his entire philosophy. Was assigned ice castle guard duty alongside Dante (3rd Edition); Dante was killed for refusing orders. Took an 11th Floor Exit Deal; became a Game Guide and Guildhall Instructor.",
    status: "dead", statusNote: "Sacrificed himself — triggered Scolopendra's awakening",
    whereabouts: "Returned in Book 7. Built elaborate defensive traps for the FUPA during Faction Wars. His final act: stayed behind on Floor 9 as others descended, and triggered his Legendary Trap. The resulting System Messages ended: \"Scolopendra has awakened.\"",
    b7: true,
  },
  {
    ed: 9, suffix: "th", name: "Rosetta Thagra", race: "Crest",
    season: "Two seasons before Mordecai's crawl",
    contributions: "\"Was a big fan of blowing things up.\" Wrote explosives recipes, fairy warnings, and extensive entries about systemic dungeon injustice. Responded to Milk's rants in agreement. After indentureship: created the documentary The Other Side of the Glass; hosts OIPAN-funded talk show Shadow Boxer. In Book 6, interviewed Carl and Donut and covertly steered Carl toward the toraline clue.",
    status: "unknown", statusNote: "Alive entering Faction Wars; fate post-parlay unclear",
    whereabouts: "Entered Floor 9 as a Crest Barnburner for the Princess Posse. Figured out the Naga Blood Sultanate's temple-escape pattern (Vinata). Her defining act: assassinated King Rust during his parlay with Carl — personal revenge for him killing her teammate by lassoing them through a portal. Status after the assassination unclear.",
    b7: true,
  },
  {
    ed: 10, suffix: "th", name: "York", race: "Unknown",
    season: "Unknown",
    contributions: "A poet. Wrote pages of rambling philosophical essays Carl could barely parse. Opened with: \"You are me. That is who this book finds.\" Fought a lifelong battle against emotional numbness he developed in the crawl — volunteering for horrific missions just to feel something. Blew up a ship of children (including the new orc king) in the chaos after Faction Wars without feeling anything. Took a 10th Floor Exit Deal; worked as Game Guide and Guildhall Instructor in the Poetry Guild.",
    status: "unknown", statusNote: "Last known: OIPAN Captain; no Book 7 appearance",
    whereabouts: "Exited the dungeon. Spent years in self-reflection. Became a Captain in the resistance organisation later known as OIPAN. No appearance in Book 7.",
    b7: false,
  },
  {
    ed: 11, suffix: "th", name: "Ikicha", race: "Yenk (castrated male)",
    season: "Unknown — icy Sixth Floor Hunting Grounds",
    contributions: "His season featured cold, icy Hunting Grounds. Known for philosophical writing, including the famous phrase Drakea later quoted: \"The burning Yenk needs only to embrace their enemies.\" His final entry, cryptic to other authors, almost certainly describes encountering a loved one resurrected as a dungeon Boss: \"The sight of him, twisted and changed, speaking with that same voice that once said such sweet words... It broke me.\"",
    status: "dead", statusNote: "Confirmed dead by Drakea",
    whereabouts: "Drakea confirms Ikicha died in the dungeon. Wrote a long memorial for him.",
    b7: false,
  },
  {
    ed: 12, suffix: "th", name: "Batbilge", race: "Unknown",
    season: "Unknown",
    contributions: "Very little is known. Allister (13th Edition) noted Batbilge's entry as their last, and warned future authors never to have the cookbook on their person while using the marketplace — strongly implying Batbilge was caught with it.",
    status: "dead", statusNote: "Likely killed — cookbook discovery suspected",
    whereabouts: "Presumed killed, possibly because the cookbook was discovered. Allister's cautionary note is the only record.",
    b7: false,
  },
  {
    ed: 13, suffix: "th", name: "Allister", race: "Unknown (uses T'Ghee cards for religion)",
    season: "Unknown",
    contributions: "The cookbook took the form of T'Ghee Cards for Allister, fitting his meditation-based religion. Wrote about backpacks, inventory mechanics, vampires (Floor 7), and most importantly: a detailed entry on the Semeru Dwarves of Floor 9 and their mysterious goddess (later confirmed as Ysalte). His backpack entry directly inspired Carl's design of Katia's Doppelgänger mass-boost backpack. Also wrote the single clearest description of Scolopendra and its nine-tier past attack on the 6th Floor world. Took an 11th Floor Exit Deal.",
    status: "unknown", statusNote: "Post-indentureship; no Book 7 appearance",
    whereabouts: "Post-indentureship fate unspecified. Likely free. No Book 7 appearance.",
    b7: false,
  },
  {
    ed: 14, suffix: "th", name: "Priestly", race: "Unknown",
    season: "Unknown",
    contributions: "Wrote what Drakea called the single best source of information about Floor 9 Faction Wars in the entire cookbook. Loved music and was enchanted by the beauty of Larracos. Was conscripted via a Bugbear Faction's Conscript Spell and forced to march against the Skull Empire. Watched the once-beautiful city he loved be leveled and fellow crawlers slaughtered. His mind broke.",
    status: "dead", statusNote: "Suicide — unable to endure the destruction of Larracos",
    whereabouts: "Drakea records that Priestly did not make it back to the battle after seeing what had been done to Larracos. He committed suicide before returning to the city.",
    b7: false,
  },
  {
    ed: 15, suffix: "th", name: "Sinjin", race: "Unknown (paw-bearing race)",
    season: "Unknown",
    contributions: "Wrote bomb-crafting entries: a level-3 sapper's table for bomb infusion; soaking a Hobgoblin Smoke Curtain in healing potion to mass-kill undead. Also wrote bitterly about worshipping the goddess Kuraokami, whose (male soother) sponsor treated Sinjin's devotion as if directed at him personally. \"Worst decision ever.\" Deity rules required touching every corpse with ice once a day.",
    status: "dead", statusNote: "Killed by Kuraokami for trying to leave the faith",
    whereabouts: "Killed by the dungeon goddess Kuraokami after attempting to abandon the faith.",
    b7: false,
  },
  {
    ed: 16, suffix: "th", name: "Herot", race: "Unknown alien",
    season: "Unknown",
    contributions: "Wrote a long, convoluted essay on NPCs — arguing self-awareness is contagious among them, and that quests become easier when you break the fourth wall. Wrote about the bellowing tall creatures of the 6th Floor Hunting Grounds. Hypothesized that fan interest shifts after Floor 9 toward the Ascendency Wars. Confirmed Milk's stairwell entries as still accurate. Note: pronouns for Herot shift between books — \"her\" (B3), \"he\" (B4), \"she\" (B5/B6) — the wiki uses they/them.",
    status: "unknown", statusNote: "",
    whereabouts: "No confirmed death. No Book 7 appearance. Fate unknown.",
    b7: false,
  },
  {
    ed: 17, suffix: "th", name: "Azin", race: "Unknown",
    season: "Unknown — kite birds on 6th Floor Hunting Grounds",
    contributions: "Described the kite birds flying overhead on the 6th Floor Hunting Grounds in their season. Wrote about berserking mechanics — specifically group berserking — which Carl references directly in Book 7 when explaining mantaur mob behavior. Also wrote about indestructible NPCs. Appears to have developed arachnophobia at some point, which Tin found funny until they didn't.",
    status: "unknown", statusNote: "",
    whereabouts: "No confirmed death. No Book 7 appearance. Fate unknown.",
    b7: false,
  },
  {
    ed: 18, suffix: "th", name: "Ossie", race: "Unknown",
    season: "Unknown",
    contributions: "Wrote philosophically about the dungeon as a \"reused canvas painted over and over again.\" Observed that all bopca NPCs share the same origin story — aliens offering their people a \"chance\" to live in the dungeon — and hypothesized their true station is higher than it appears. Also wrote practical entries on creating fear and confusion among enemy forces: \"If you want to create fright amongst an otherwise stalwart enemy, confusion is always the key.\"",
    status: "unknown", statusNote: "",
    whereabouts: "No confirmed death. No Book 7 appearance. Fate unknown.",
    b7: false,
  },
  {
    ed: 19, suffix: "th", name: "Coolie", race: "Unknown",
    season: "Dungeon Crawler World: Qurux — appeared on multiple Syndicate programs",
    contributions: "Popular crawler, appeared on multiple Syndicate programs during their crawl. Wrote extensively on gods, deity summonings (voluntary and involuntary), and production chamber security and forcefields. Described Eris and Apito as the \"big ones\" always sponsored in Ascendency Wars. Carl credits her directly in Book 7: \"Coolie. I know you can't read this, but I used your passage to plan the first step... I did it for you and for a little girl named Bonnie.\"",
    status: "dead", statusNote: "Killed attempting to assassinate two Dungeon Admins",
    whereabouts: "Killed in an assassination attempt against two Dungeon Admins. Her last view was of her home planet.",
    b7: false,
  },
  {
    ed: 20, suffix: "th", name: "Forkith", race: "Urgyle-seeded alien",
    season: "Unknown",
    contributions: "Entered the dungeon with his sister Barkith. Chose the Sapper class. Wrote detailed notes on the 6th Floor Hunting Grounds map, political landscape, and monster variability between seasons. Tested Rosetta's (9th Edition) unstable-bomb-backpack trick — it no longer worked. Barkith was killed in the resulting explosion. Left detailed instructions on how to properly append notes to cookbook entries, standardising the format for all future authors. Vowed to kill a god for Barkith.",
    status: "unknown", statusNote: "Reached 11th Floor; post-indentureship fate unclear",
    whereabouts: "Reached at least the 11th Floor. No confirmed death. No Book 7 appearance.",
    b7: false,
  },
  {
    ed: 21, suffix: "st", name: "Tin", race: "Unknown",
    season: "Unknown",
    contributions: "Made one of the most strategically important observations in the cookbook: gods are Soul Armor — when aliens inhabit a god's body they do so like armor, meaning they can theoretically be ejected by any spell designed to remove biological armor (e.g. \"Take That Shit Off\", \"Laundry Day Spell\"), reverting the god to its natural state. Also underwent a famous two-part arachnophobia arc: initial entry: \"I think they're cute\" — follow-up entry days later: \"Never mind. Holy shit, never mind. Fuck spiders.\"",
    status: "unknown", statusNote: "",
    whereabouts: "No confirmed death. No Book 7 appearance. Fate unknown.",
    b7: false,
  },
  {
    ed: 22, suffix: "nd", name: "Drakea", race: "Bune",
    season: "Last Naga-produced season, 250+ cycles ago",
    contributions: "Added more notes and annotations to the cookbook than any other author — responding to almost every entry, memorialising lost authors, and leaving guidance for future readers. Chose a rogue/magic class and a trap-focused subclass. Burned with hatred for the Naga from firsthand witness of their cruelty. Wrote Justice Light a letter of forgiveness for his NPC killing. Requested future authors document everything in detail.",
    status: "dead", statusNote: "Confirmed dead — Carl eulogises him in Book 7",
    whereabouts: "Dead. Confirmed by Carl in a Book 7 entry written directly to Drakea: \"I know that you're dead, Drakea, but I haven't forgotten how much you hated the naga... I hope you watched from the other side.\"",
    b7: false,
  },
  {
    ed: 23, suffix: "rd", name: "[Unknown]", race: "Unknown", isUnknown: true,
    season: "Unknown",
    contributions: "The 23rd edition exists — confirmed by the numbering gap between Drakea (22nd) and Rickard (24th) — but no author has been named or identified through Book 7.",
    status: "unknown", statusNote: "",
    whereabouts: "No record exists.",
    b7: false,
  },
  {
    ed: 24, suffix: "th", name: "Rickard", race: "Unknown",
    season: "Unknown",
    contributions: "Entered the dungeon with his pregnant wife. Almost nothing else is recorded about Rickard's contributions through Book 7. The emotional weight of this detail is left to the reader.",
    status: "unknown", statusNote: "",
    whereabouts: "No further information available through Book 7.",
    b7: false,
  },
  {
    ed: 25, suffix: "th", name: "Carl", race: "Human (Earth) → Changeling",
    season: "Earth's first (and last) season of Dungeon Crawler World",
    contributions: "The current edition and only human author. Took Drakea's advice to document everything — including full combat plans, floor strategies, personal reflections, and tributes to lost authors. Unique in openly weaponising the cookbook as a tool of active resistance. His entries span Books 3–7. Key entries: Loita assassination plan, the Butcher's Masquerade trap, Operation Ruin, Floor 9 preparation notes, Scolopendra observations.",
    status: "alive", statusNote: "Descended to Floor 10 — Book 8 forthcoming",
    whereabouts: "Alive. End of Book 7: descended to Floor 10 with Donut and the Princess Posse. Married (revealed by Eris). Pied Piper Spell made permanent. Scolopendra has awakened.",
    b7: true,
  },
];

const STATUS_CONFIG = {
  alive:   { label: "Alive",   color: "#22c55e", bg: "rgba(34,197,94,0.09)",   border: "rgba(34,197,94,0.28)" },
  dead:    { label: "Dead",    color: "#ef4444", bg: "rgba(239,68,68,0.09)",    border: "rgba(239,68,68,0.28)" },
  unknown: { label: "Unknown", color: "#78716c", bg: "rgba(120,113,108,0.09)", border: "rgba(120,113,108,0.28)" },
};

function CookbookPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [expanded, setExpanded] = useState(null);

  const filtered = AUTHORS.filter(a => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.contributions.toLowerCase().includes(q) || a.race.toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    alive: AUTHORS.filter(a => a.status === "alive").length,
    dead: AUTHORS.filter(a => a.status === "dead").length,
    unknown: AUTHORS.filter(a => a.status === "unknown").length,
    b7: AUTHORS.filter(a => a.b7).length,
  };

  return (
    <div className="cb-page" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "linear-gradient(160deg, #f5ead0 0%, #ecddb8 50%, #e8d5a8 100%)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 28px 80px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 26, paddingBottom: 20, borderBottom: "2px solid rgba(139,105,20,0.3)" }}>
          <div style={{ fontSize: 10, color: "#8b6914", letterSpacing: "0.18em", fontFamily: "Cinzel, Georgia, serif", textTransform: "uppercase", marginBottom: 8 }}>
            Reference
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 700, color: "#3d1a00", letterSpacing: "0.06em", textShadow: "1px 1px 0 rgba(139,105,20,0.3)", fontFamily: "Cinzel, 'Palatino Linotype', Georgia, serif" }}>
            ⚡ The Dungeon Anarchist's Cookbook
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "#4a2e00", lineHeight: 1.9, maxWidth: 700, fontFamily: "'IM Fell English', Palatino, Georgia, serif", fontStyle: "italic" }}>
            Created by the System AI in the 15th season. Passed to crawlers meeting unknown criteria.
            Neither audience nor production can see its contents. Disappears on death or retirement.
            25 known editions. Most of its authors did not survive.
          </p>
          {/* Stat row */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { label: "Editions",        val: 25,           col: "#8b2500" },
              { label: "Named Authors",   val: 23,           col: "#2a1500" },
              { label: "Confirmed Dead",  val: totals.dead,  col: "#6b0000" },
              { label: "Confirmed Alive", val: totals.alive, col: "#2d6a2d" },
              { label: "Active in B7",    val: totals.b7,    col: "#5c2d8e" },
            ].map(s => (
              <div key={s.label} style={{ background: "rgba(139,105,20,0.06)", border: `1px solid ${s.col}44`, borderRadius: 8, padding: "9px 18px", minWidth: 90, textAlign: "center" }}>
                <div className="cb-stat-val" style={{ fontSize: 24, fontWeight: 700, color: s.col, lineHeight: 1 }}>{s.val}</div>
                <div className="cb-stat-label" style={{ fontSize: 10, color: "#6b4c1a", marginTop: 4, fontFamily: "Cinzel, Georgia, serif", letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, race, contributions…"
            style={{
              flex: 1, minWidth: 200,
              background: "rgba(245,230,200,0.7)", border: "1px solid rgba(139,105,20,0.35)",
              borderRadius: 3, color: "#2a1500", padding: "7px 13px", fontSize: 13,
              outline: "none", fontFamily: "Georgia,'Times New Roman',serif",
            }}
          />
          {["ALL","alive","dead","unknown"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              background: filterStatus === s ? "rgba(139,105,20,0.18)" : "rgba(139,105,20,0.06)",
              border: filterStatus === s ? "1px solid rgba(139,105,20,0.55)" : "1px solid rgba(139,105,20,0.2)",
              borderRadius: 3, color: filterStatus === s ? "#3d2000" : "#6b4c1a",
              padding: "6px 14px", fontSize: 13, cursor: "pointer",
            }}>
              {s === "ALL" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span style={{ fontSize: 11, color: "#8b6914", marginLeft: 2 }}>{filtered.length}/{AUTHORS.length}</span>
        </div>

        {/* Author cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {filtered.map(a => {
            const sc = STATUS_CONFIG[a.status];
            const isOpen = expanded === a.ed;
            return (
              <div key={a.ed}
                style={{
                  background: isOpen ? "rgba(245,230,200,0.7)" : "rgba(139,105,20,0.04)",
                  border: `1px solid ${isOpen ? "rgba(139,105,20,0.45)" : "rgba(139,105,20,0.18)"}`,
                  borderLeft: isOpen ? `3px solid ${sc.color}` : "3px solid transparent",
                  borderRadius: 8, overflow: "hidden", transition: "background 0.15s, border-color 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "rgba(139,105,20,0.1)"; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "rgba(139,105,20,0.04)"; }}
                onClick={() => setExpanded(isOpen ? null : a.ed)}>

                {/* Collapsed row */}
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", alignItems: "center", gap: 16, padding: "13px 18px" }}>
                  {/* Edition badge */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#8b2500", lineHeight: 1, fontFamily: "Cinzel, Georgia, serif" }}>{a.ed}</div>
                    <div style={{ fontSize: 9, color: "#8b6914", letterSpacing: "0.08em", fontFamily: "monospace" }}>{a.suffix} ed.</div>
                  </div>

                  {/* Name + race */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="cb-name" style={{ fontSize: 15, fontWeight: 700, color: a.isUnknown ? "#8b6914" : "#2a1500", fontFamily: "'IM Fell English', Palatino, Georgia, serif", fontStyle: a.isUnknown ? "italic" : "normal" }}>
                        {a.name}
                      </span>
                      {a.b7 && (
                        <span style={{ fontSize: 10, background: "rgba(92,45,142,0.1)", color: "#5c2d8e", border: "1px solid rgba(92,45,142,0.35)", borderRadius: 2, fontFamily: "Cinzel, Georgia, serif", borderRadius: 4, padding: "1px 7px", letterSpacing: "0.06em" }}>
                          BOOK 7
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#6b4c1a", marginTop: 2, fontStyle: "italic", fontFamily: "'IM Fell English', Palatino, Georgia, serif" }}>
                      {a.race !== "Unknown" && <span>{a.race}</span>}
                      {a.race !== "Unknown" && a.season && <span style={{ color: "#44403c" }}> · </span>}
                      {a.season && <span style={{ fontStyle: "italic", color: "#6b4c1a" }}>{a.season}</span>}
                    </div>
                  </div>

                  {/* Status + chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 2, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}55`, fontFamily: "'IM Fell English', Georgia, serif" }}>
                        {sc.label}
                      </span>
                      {a.statusNote && (
                        <div style={{ fontSize: 10.5, color: sc.color, opacity: 0.8, marginTop: 3, fontStyle: "italic", maxWidth: 220, textAlign: "right" }}>
                          {a.statusNote}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 16, color: "#8b6914", display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>›</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(139,105,20,0.25)", padding: "18px 20px 20px", background: "rgba(0,0,0,0.02)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="cb-grid">
                      <div>
                        <div style={{ fontSize: 9, color: "#8b6914", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Cinzel, Georgia, serif" }}>
                          Contributions &amp; Crawl Notes
                        </div>
                        <p className="cb-body" style={{ margin: 0, fontSize: 13.5, color: "#2a1500", lineHeight: 1.85, fontFamily: "'IM Fell English', Palatino, Georgia, serif" }}>{a.contributions}</p>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#8b6914", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Cinzel, Georgia, serif" }}>
                          Whereabouts — End of Book 7
                        </div>
                        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.8, color: a.status === "dead" ? "#6b0000" : a.status === "alive" ? "#2d6a2d" : "#6b4c1a", opacity: 0.9 }}>
                          {a.whereabouts}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 32, padding: "14px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 7, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "#8b6914", lineHeight: 1.85, fontStyle: "italic", fontFamily: "'IM Fell English', Georgia, serif" }}>
          The 1st Edition has no confirmed author. The 23rd Edition exists (gap between Drakea's 22nd and Rickard's 24th) but its author is unnamed through Book 7.
          Status reflects known facts as of <em style={{ color: "#4a2e00" }}>This Inevitable Ruin</em> (Book 7).
        </div>
      </div>

      <style>{`
        .cb-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 700px) { .cb-grid { grid-template-columns: 1fr !important; } }
        input::placeholder { color: #8b6914; opacity: 0.7; }
        .cb-page { font-size: clamp(13px, 1.4vw, 16px); }
        .cb-page h1 { font-size: clamp(18px, 2.2vw, 28px) !important; }
        .cb-page .cb-name { font-size: clamp(13px, 1.2vw, 16px) !important; }
        .cb-page .cb-body { font-size: clamp(12px, 1.1vw, 14px) !important; }
        .cb-stat-val { font-size: clamp(18px, 2vw, 26px) !important; }
        .cb-stat-label { font-size: clamp(10px, 0.9vw, 12px) !important; }
      `}</style>
    </div>
  );
}

function Sidebar({ node, onSelect }) {
  const fs = FACTION_STYLE[node.faction];
  const outgoing = EDGES.filter(e => e.from === node.id);
  const incoming = EDGES.filter(e => e.to === node.id);
  const bookColor = node.book === 3 ? "#2d6a2d" : node.book === 2 ? "#5c2d8e" : "#8b2500";
  return (
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      <div style={{ paddingBottom: 15, borderBottom: `1px solid ${fs.color}44`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>{ROLE_EMOJI[node.role] || "●"}</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${bookColor}10`, color: bookColor, border: `1px solid ${bookColor}55`, fontFamily: "monospace", borderRadius: 2, fontFamily: "monospace" }}>Book {node.book}</span>
        </div>
        <h2 style={{ margin: "0 0 7px", fontSize: 18, color: fs.color, lineHeight: 1.2, fontFamily: "Cinzel, 'Palatino Linotype', Georgia, serif", letterSpacing: "0.04em" }}>{node.label}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 11 }}>
          <Tag color={fs.color}>{fs.label}</Tag>
          <Tag color="#57534e">{node.role}</Tag>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.72, color: "#2a1500", fontFamily: "'IM Fell English', Palatino, Georgia, serif", fontStyle: "italic" }}>{node.desc}</p>
      </div>
      {outgoing.length > 0 && <EdgeGroup title="→ Connects to" edges={outgoing} dirKey="to" onSelect={onSelect} />}
      {incoming.length > 0 && <EdgeGroup title="← Connected by" edges={incoming} dirKey="from" onSelect={onSelect} />}
    </div>
  );
}

function EdgeGroup({ title, edges, dirKey, onSelect }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, color: "#8b6914", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7, fontFamily: "Cinzel, Georgia, serif" }}>{title}</div>
      {edges.map((e, i) => {
        const targetId = e[dirKey];
        const targetNode = getNodeById(targetId);
        if (!targetNode) return null;
        const tfs = FACTION_STYLE[targetNode.faction];
        const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
        return (
          <div key={i} onClick={() => onSelect(targetId)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 3, marginBottom: 4, background: "rgba(139,105,20,0.05)", border: `1px solid ${tfs.color}44`, cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = `${tfs.dim}`}  // dim is already light tint
            onMouseLeave={ev => ev.currentTarget.style.background = "rgba(139,105,20,0.05)"}>
            <span style={{ fontSize: 13 }}>{ROLE_EMOJI[targetNode.role]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: tfs.color, fontWeight: 600 }}>{targetNode.label}</div>
              <div style={{ fontSize: 10, color: "#8b6914" }}>
                <span style={{ color: es.color }}>{e.label}</span>{" · "}{tfs.label}
              </div>
            </div>
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, fontFamily: "monospace", background: targetNode.book === 3 ? "rgba(5,150,105,0.1)" : targetNode.book === 2 ? "rgba(124,58,237,0.1)" : "rgba(180,83,9,0.08)", color: targetNode.book === 3 ? "#059669" : targetNode.book === 2 ? "#7c3aed" : "#92400e" }}>B{targetNode.book}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 2, background: `${color}12`, color, border: `1px solid ${color}55`, fontFamily: "Cinzel, Georgia, serif", letterSpacing: "0.06em" }}>{children}</span>
  );
}
