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
  // fill any remaining with 1.5
};

function getProminence(id) {
  return PROMINENCE[id] ?? 1.5;
}

// Prominence layout: faction-seeded force with size-weighted repulsion
function prominencePositions(nodes, edges, iters = 320) {
  if (nodes.length === 0) return {};
  const W = 2400, H = 1600;
  const DAMPING = 0.80;
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
        const minDist = ra + rb + 18;
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const REPULSION = minDist * minDist * 2.0;
        const mag = REPULSION / (dist * dist);
        const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
        force[ia].x += nx; force[ia].y += ny;
        force[ib].x -= nx; force[ib].y -= ny;
      }
    }

    // Edge springs
    const K = 95;
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
  PARTY:       { color: "#f59e0b", dim: "#78350f", label: "Carl's Party" },
  MEADOWLARK:  { color: "#34d399", dim: "#064e3b", label: "Meadow Lark" },
  CRAWLERS:    { color: "#e879f9", dim: "#4a044e", label: "Other Crawlers" },
  ANTAGONISTS: { color: "#f87171", dim: "#450a0a", label: "Antagonists" },
  SYSTEM:      { color: "#a78bfa", dim: "#3b0764", label: "System / Borant" },
  MEDIA:       { color: "#60a5fa", dim: "#1e3a5f", label: "Galactic Media" },
  NPCS:        { color: "#fb923c", dim: "#431407", label: "Dungeon NPCs/Elites" },
  BACKSTORY:   { color: "#94a3b8", dim: "#1e293b", label: "Pre-Dungeon" },
};

const EDGE_STYLE = {
  party:       { color: "#f59e0b" }, trains:      { color: "#fde68a" },
  allied:      { color: "#34d399" }, protected:   { color: "#34d399" },
  killed:      { color: "#f87171" }, antagonizes: { color: "#f87171" },
  hunts:       { color: "#f87171" }, controls:    { color: "#a78bfa" },
  employs:     { color: "#a78bfa" }, manages:     { color: "#60a5fa" },
  hosts:       { color: "#60a5fa" }, rescued:     { color: "#34d399" },
  companion:   { color: "#f59e0b" }, causes:      { color: "#fb923c" },
  exgf:        { color: "#94a3b8" }, leads:       { color: "#34d399" },
  puppet:      { color: "#f87171" }, connected:   { color: "#78716c" },
  quest:       { color: "#fb923c" }, joined:      { color: "#34d399" },
  brokers:     { color: "#60a5fa" }, coerces:     { color: "#f87171" },
  loved:       { color: "#fb923c" }, replaces:    { color: "#a78bfa" },
  tricks:      { color: "#f87171" }, mentors:     { color: "#fde68a" },
};

const ROLE_EMOJI = {
  "Crawler": "⚔️",  "Mage": "🔮",         "Healer": "💚",       "Trickster": "🃏",
  "Engineer": "⚙️", "Juggernaut": "🚛",    "Summoner": "🌸",     "Companion": "🐾",
  "Caretaker": "🧑‍⚕️","Resident": "👴",    "Player Killer": "🗡️","Boss": "💀",
  "Show Host": "📺", "Host/Boss": "👑",     "PR Agent": "📣",     "Admin": "🖥️",
  "Corp Entity": "🏢","Elite NPC": "✨",    "NPC": "🧙",          "Survivor": "🏃",
  "Pre-Dungeon": "💔","Aerialist": "🐐",   "Shepherd": "🌿",     "Antagonist": "⚡",
  "Medic": "🏥",     "Hunter": "🎯",       "Hunter Leader": "🪲","Country Boss": "👸",
  "Boss/Pet": "🐈",  "Pet/Ally": "🦕",     "Boss/Deity": "🕷️",  "Deity": "⛩️",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getNodeById(id) { return NODES.find(n => n.id === id); }

function computeArrow(from, to, r = 25) {
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
  const [layout, setLayout] = useState("manual");
  const [isComputing, setIsComputing] = useState(false);

  // Positions: manual uses data.js coords; others are computed
  const [positionsByLayout, setPositionsByLayout] = useState({
    manual: (() => { const m = {}; NODES.forEach(n => { m[n.id] = { x: n.x, y: n.y }; }); return m; })(),
    hierarchical: null,
    force: null,
    prominence: null,
  });

  // Per-layout user drag overrides
  const [userDrag, setUserDrag] = useState({ manual: {}, hierarchical: {}, force: {}, prominence: {} });

  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
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

  const switchLayout = useCallback((id) => {
    setLayout(id);
    setPan({ x: 0, y: 20 });
    setZoom(id === "hierarchical" ? 0.38 : id === "force" || id === "prominence" ? 0.55 : 0.72);
    setSelected(null);
  }, []);

  const DEFAULT_ZOOM = { manual: 0.72, hierarchical: 0.38, force: 0.58, prominence: 0.55 };

  return (
    <div style={{
      height: "100vh", width: "100%",
      background: "#06060c",
      backgroundImage: `
        radial-gradient(ellipse 60% 40% at 20% 15%, rgba(120,53,15,0.14) 0%, transparent 55%),
        radial-gradient(ellipse 40% 55% at 80% 80%, rgba(59,7,100,0.12) 0%, transparent 55%),
        radial-gradient(ellipse 30% 30% at 60% 10%, rgba(6,78,59,0.08) 0%, transparent 40%),
        repeating-linear-gradient(0deg,transparent,transparent 70px,rgba(255,255,255,0.011) 70px,rgba(255,255,255,0.011) 71px),
        repeating-linear-gradient(90deg,transparent,transparent 70px,rgba(255,255,255,0.011) 70px,rgba(255,255,255,0.011) 71px)
      `,
      fontFamily: "'Georgia','Times New Roman',serif",
      color: "#e2d9c8", display: "flex", flexDirection: "column",
      userSelect: "none", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", borderBottom: "1px solid rgba(245,158,11,0.18)",
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(14px)",
        zIndex: 50, flexShrink: 0, flexWrap: "wrap", gap: 8,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.06em", textShadow: "0 0 28px rgba(245,158,11,0.5)" }}>
            ⚔ DUNGEON CRAWLER CARL
          </span>
          <span style={{ marginLeft: 10, fontSize: 11, color: "#57534e" }}>Books 1–7 · Character DAG · {NODES.length} characters · {EDGES.length} edges</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {["ALL","1","2","3","4","5","6","7"].map(b => (
              <button key={b} onClick={() => { setFilterBook(b); setSelected(null); }}
                style={{
                  background: filterBook === b ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)",
                  border: filterBook === b ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: filterBook === b ? "#f59e0b" : "#78716c",
                  padding: "4px 10px", fontSize: 12, cursor: "pointer",
                }}>
                {b === "ALL" ? "All Books" : `Book ${b}`}
              </button>
            ))}
          </div>
          <select value={filterFaction} onChange={e => { setFilterFaction(e.target.value); setSelected(null); }}
            style={{ background: "#111", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, color: "#e2d9c8", padding: "4px 9px", fontSize: 12, cursor: "pointer" }}>
            <option value="ALL">All Groups</option>
            {Object.entries(FACTION_STYLE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={() => { setPan({ x: 0, y: 20 }); setZoom(DEFAULT_ZOOM[layout]); }}
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, color: "#f59e0b", padding: "4px 11px", fontSize: 12, cursor: "pointer" }}>
            Reset View
          </button>
          {selected && (
            <button onClick={() => setSelected(null)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#a8a29e", padding: "4px 11px", fontSize: 12, cursor: "pointer" }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Computing overlay */}
        {isComputing && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 100,
            background: "rgba(6,6,12,0.75)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontSize: 28, animation: "spin 1.2s linear infinite" }}>⬡</div>
            <div style={{ fontSize: 13, color: "#f59e0b", letterSpacing: "0.12em" }}>COMPUTING LAYOUT…</div>
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
                    fill={`rgba(245,158,11,0.04)`} stroke="rgba(245,158,11,0.1)" strokeWidth={1} />
                  <text x={200 + (b-1)*420} y={44} textAnchor="middle"
                    fontSize={13} fontWeight="700" fill="#f59e0b" opacity={0.7}
                    style={{ fontFamily: "Georgia,serif", letterSpacing: "0.08em" }}>
                    BOOK {b}
                  </text>
                  <text x={200 + (b-1)*420} y={62} textAnchor="middle"
                    fontSize={9} fill="#57534e" style={{ fontFamily: "monospace" }}>
                    {NODES.filter(n => n.book === b).length} characters
                  </text>
                </g>
              ))}
            </g>
          )}

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <rect x="-9999" y="-9999" width="22000" height="22000" fill="transparent" />
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
                    strokeWidth={active ? 2.2 : 1}
                    strokeOpacity={dimmed ? 0.05 : active ? 0.9 : 0.18}
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
              const baseR = layout === "prominence" ? Math.round(12 + getProminence(node.id) * 3.2) : 25;
              const R = isSel ? baseR + 8 : isHov ? baseR + 5 : baseR;
              const bookColor = node.book === 3 ? "#4ade80" : node.book === 2 ? "#a78bfa" : null;
              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : node.id); }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}>
                  {bookColor && !dimmed && (
                    <circle r={R + 5} fill="none" stroke={bookColor}
                      strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                  )}
                  {(isSel || isHov) && (
                    <circle r={R + 9} fill="none" stroke={fs.color}
                      strokeWidth={isSel ? 2 : 1} opacity={isSel ? 0.35 : 0.18}
                      filter="url(#glow)" />
                  )}
                  <circle r={R}
                    fill={isSel ? fs.dim : `${fs.dim}88`}
                    stroke={fs.color}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                    opacity={dimmed ? 0.12 : 1}
                    filter={isSel ? "url(#glow2)" : undefined}
                    style={{ transition: "all 0.14s ease" }}
                  />
                  <text y={-2} textAnchor="middle" fontSize={isSel ? 14 : 12}
                    opacity={dimmed ? 0.12 : 1} style={{ pointerEvents: "none" }}>
                    {ROLE_EMOJI[node.role] || "●"}
                  </text>
                  <text y={R + 14} textAnchor="middle"
                    fontSize={isSel ? 11 : 9.5} fontWeight={isSel ? "700" : "400"}
                    fill={fs.color} opacity={dimmed ? 0.12 : 1}
                    style={{ pointerEvents: "none", fontFamily: "Georgia,serif" }}>
                    {node.label}
                  </text>
                  <text y={R + 25} textAnchor="middle" fontSize="8"
                    fill={bookColor || "#57534e"} opacity={dimmed ? 0.08 : bookColor ? 0.75 : 0.3}
                    fontWeight={bookColor ? "700" : "400"}
                    style={{ pointerEvents: "none", fontFamily: "monospace" }}>
                    Bk {node.book}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Sidebar */}
        <div style={{
          width: selectedNode ? 315 : 0, minWidth: selectedNode ? 315 : 0,
          overflow: "hidden", transition: "all 0.27s cubic-bezier(.4,0,.2,1)",
          borderLeft: "1px solid rgba(245,158,11,0.12)",
          background: "rgba(4,4,10,0.95)", backdropFilter: "blur(20px)",
          flexShrink: 0,
        }}>
          {selectedNode && <Sidebar node={selectedNode} onSelect={setSelected} />}
        </div>

        {/* Legend + Layout switcher */}
        <div style={{
          position: "absolute", bottom: 14, left: 14,
          background: "rgba(0,0,0,0.82)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "11px 13px",
          minWidth: 168,
        }}>
          {/* Layout toggle */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 9, color: "#3c3834", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Layout</div>
            <div style={{ display: "flex", gap: 4 }}>
              {LAYOUTS.map(l => (
                <button key={l.id}
                  onClick={() => { if ((l.id === "force" || l.id === "prominence") && layout === l.id) reshuffleForce(); else switchLayout(l.id); }}
                  title={(l.id === "force" || l.id === "prominence") && layout === l.id ? "Click to reshuffle" : l.desc}
                  style={{
                    flex: 1, padding: "5px 4px", borderRadius: 6, cursor: "pointer",
                    background: layout === l.id ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                    border: layout === l.id ? "1px solid rgba(245,158,11,0.55)" : "1px solid rgba(255,255,255,0.08)",
                    color: layout === l.id ? "#f59e0b" : "#57534e",
                    fontSize: 9, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    transition: "all 0.15s",
                  }}>
                  <span style={{ fontSize: 13 }}>{l.icon}</span>
                  <span style={{ letterSpacing: "0.04em", fontFamily: "monospace" }}>{l.label}</span>
                </button>
              ))}
            </div>
            {(layout === "force" || layout === "prominence") && (
              <div style={{ fontSize: 9, color: "#44403c", textAlign: "center", marginTop: 5, fontFamily: "monospace" }}>
                click again to reshuffle
              </div>
            )}
          </div>

          {/* Faction legend */}
          <div style={{ fontSize: 9, color: "#3c3834", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>Groups</div>
          {Object.entries(FACTION_STYLE).map(([k, v]) => (
            <div key={k} onClick={() => setFilterFaction(filterFaction === k ? "ALL" : k)}
              style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, cursor: "pointer", opacity: filterFaction !== "ALL" && filterFaction !== k ? 0.3 : 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 10, color: "#a8a29e" }}>{v.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 6 }}>
            {[["#a78bfa","Book 2"],["#4ade80","Book 3"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 18, height: 9, borderRadius: "50%", border: `1px dashed ${c}`, opacity: 0.6 }} />
                <span style={{ fontSize: 9.5, color: "#78716c" }}>{l} character</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          position: "absolute", bottom: 14, right: selectedNode ? 329 : 14,
          background: "rgba(0,0,0,0.55)", borderRadius: 6,
          padding: "3px 9px", fontSize: 11, color: "#3c3834",
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          {Math.round(zoom * 100)}%
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Sidebar components ────────────────────────────────────────────────────

function Sidebar({ node, onSelect }) {
  const fs = FACTION_STYLE[node.faction];
  const outgoing = EDGES.filter(e => e.from === node.id);
  const incoming = EDGES.filter(e => e.to === node.id);
  const bookColor = node.book === 3 ? "#4ade80" : node.book === 2 ? "#a78bfa" : "#f59e0b";
  return (
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      <div style={{ paddingBottom: 15, borderBottom: `1px solid ${fs.color}22`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>{ROLE_EMOJI[node.role] || "●"}</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${bookColor}18`, color: bookColor, border: `1px solid ${bookColor}33`, fontFamily: "monospace" }}>Book {node.book}</span>
        </div>
        <h2 style={{ margin: "0 0 7px", fontSize: 19, color: fs.color, lineHeight: 1.2 }}>{node.label}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 11 }}>
          <Tag color={fs.color}>{fs.label}</Tag>
          <Tag color="#57534e">{node.role}</Tag>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.72, color: "#c4bcb2" }}>{node.desc}</p>
      </div>
      {outgoing.length > 0 && <EdgeGroup title="→ Connects to" edges={outgoing} dirKey="to" onSelect={onSelect} />}
      {incoming.length > 0 && <EdgeGroup title="← Connected by" edges={incoming} dirKey="from" onSelect={onSelect} />}
    </div>
  );
}

function EdgeGroup({ title, edges, dirKey, onSelect }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9.5, color: "#3c3834", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 7 }}>{title}</div>
      {edges.map((e, i) => {
        const targetId = e[dirKey];
        const targetNode = getNodeById(targetId);
        if (!targetNode) return null;
        const tfs = FACTION_STYLE[targetNode.faction];
        const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
        return (
          <div key={i} onClick={() => onSelect(targetId)}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 7, marginBottom: 4, background: "rgba(255,255,255,0.025)", border: `1px solid ${tfs.color}18`, cursor: "pointer" }}
            onMouseEnter={ev => ev.currentTarget.style.background = `${tfs.dim}44`}
            onMouseLeave={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.025)"}>
            <span style={{ fontSize: 13 }}>{ROLE_EMOJI[targetNode.role]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: tfs.color, fontWeight: 600 }}>{targetNode.label}</div>
              <div style={{ fontSize: 10, color: "#44403c" }}>
                <span style={{ color: es.color }}>{e.label}</span>{" · "}{tfs.label}
              </div>
            </div>
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, fontFamily: "monospace", background: targetNode.book === 3 ? "rgba(74,222,128,0.1)" : targetNode.book === 2 ? "rgba(167,139,250,0.1)" : "rgba(245,158,11,0.08)", color: targetNode.book === 3 ? "#4ade80" : targetNode.book === 2 ? "#a78bfa" : "#78716c" }}>B{targetNode.book}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 12, background: `${color}13`, color, border: `1px solid ${color}28` }}>{children}</span>
  );
}
