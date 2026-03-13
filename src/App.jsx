import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { NODES, EDGES } from "./data.js";

// ─── Prominence weights ──────────────────────────────────────────────────
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
  remex: 3, drakea: 2, herot: 2, epitome_tagg: 2,
  king_rust: 4, formidable: 3, porthus: 4,
  rosetta_thagra: 5, tipid: 3, milk: 3, justice_light: 4, volteeg: 3, vinata: 3,
};
function getProminence(id) { return PROMINENCE[id] ?? 1.5; }

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
  party: { color: "#8b2500" }, trains: { color: "#6b3800" },
  allied: { color: "#2d6a2d" }, protected: { color: "#2d6a2d" },
  killed: { color: "#6b0000" }, antagonizes: { color: "#6b0000" },
  hunts: { color: "#6b0000" }, controls: { color: "#5c2d8e" },
  employs: { color: "#5c2d8e" }, manages: { color: "#1a4a6e" },
  hosts: { color: "#1a4a6e" }, rescued: { color: "#2d6a2d" },
  companion: { color: "#8b2500" }, causes: { color: "#7a3800" },
  exgf: { color: "#6b5a3d" }, leads: { color: "#2d6a2d" },
  puppet: { color: "#6b0000" }, connected: { color: "#8a7a65" },
  quest: { color: "#7a3800" }, joined: { color: "#2d6a2d" },
  brokers: { color: "#1a4a6e" }, coerces: { color: "#6b0000" },
  loved: { color: "#7a3800" }, replaces: { color: "#5c2d8e" },
  tricks: { color: "#6b0000" }, mentors: { color: "#6b3800" },
};
const ROLE_EMOJI = {
  "Crawler": "⚔️", "Mage": "🔮", "Healer": "💚", "Trickster": "🃏",
  "Engineer": "⚙️", "Juggernaut": "🚛", "Summoner": "🌸", "Companion": "🐾",
  "Caretaker": "🧑‍⚕️", "Resident": "👴", "Player Killer": "🗡️", "Boss": "💀",
  "Show Host": "📺", "Host/Boss": "👑", "PR Agent": "📣", "Admin": "🖥️",
  "Corp Entity": "🏢", "Elite NPC": "✨", "NPC": "🧙", "Survivor": "🏃",
  "Pre-Dungeon": "💔", "Aerialist": "🐐", "Shepherd": "🌿", "Antagonist": "⚡",
  "Medic": "🏥", "Hunter": "🎯", "Hunter Leader": "🪲", "Country Boss": "👸",
  "Boss/Pet": "🐈", "Pet/Ally": "🦕", "Pet/Familiar": "🐾", "Boss/Deity": "🕷️", "Deity": "⛩️",
};

function getNodeById(id) { return NODES.find(n => n.id === id); }

// ─── Incremental force simulation ──────────────────────────────────────────
function runForceLayout(nodeIds, edges, existingPositions, centerX, centerY, iters = 180) {
  const nodes = nodeIds.map(id => getNodeById(id)).filter(Boolean);
  if (nodes.length === 0) return {};

  const N = Math.max(nodes.length, 1);
  const K = 90 + 300 / Math.sqrt(N); // adaptive ideal distance
  const REPULSION_BASE = K * K;
  const SPRING = 0.03;
  const DAMPING = 0.75;
  const pos = {}, vel = {};
  const pinned = new Set();
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = n; });

  // Group new nodes by faction, assign each faction a cluster angle
  const factions = {};
  nodes.forEach(n => { if (!factions[n.faction]) factions[n.faction] = []; factions[n.faction].push(n); });
  const factionKeys = Object.keys(factions);
  const factionAngle = {};
  factionKeys.forEach((fk, i) => { factionAngle[fk] = (i / factionKeys.length) * Math.PI * 2; });

  // Seed positions: existing stay, new go near faction cluster
  nodes.forEach(n => {
    if (existingPositions[n.id]) {
      pos[n.id] = { ...existingPositions[n.id] };
      pinned.add(n.id);
    } else {
      // Find a same-faction neighbor that already has a position
      const factionMate = nodes.find(m => m.id !== n.id && m.faction === n.faction && (existingPositions[m.id] || pos[m.id]));
      const connectedExisting = edges.find(e =>
        (e.from === n.id && existingPositions[e.to]) || (e.to === n.id && existingPositions[e.from])
      );
      if (factionMate && (existingPositions[factionMate.id] || pos[factionMate.id])) {
        const mp = existingPositions[factionMate.id] || pos[factionMate.id];
        pos[n.id] = { x: mp.x + (Math.random() - 0.5) * 60, y: mp.y + (Math.random() - 0.5) * 60 };
      } else if (connectedExisting) {
        const nid = connectedExisting.from === n.id ? connectedExisting.to : connectedExisting.from;
        const np = existingPositions[nid];
        // Place along the faction's angular direction from the connected node
        const a = factionAngle[n.faction] || 0;
        const r = 80 + Math.random() * 80;
        pos[n.id] = { x: np.x + Math.cos(a) * r + (Math.random() - 0.5) * 40, y: np.y + Math.sin(a) * r + (Math.random() - 0.5) * 40 };
      } else {
        // Fresh graph — place factions in distinct regions
        const a = factionAngle[n.faction] || 0;
        const r = 120 + Math.random() * 100;
        pos[n.id] = { x: centerX + Math.cos(a) * r + (Math.random() - 0.5) * 50, y: centerY + Math.sin(a) * r + (Math.random() - 0.5) * 50 };
      }
    }
    vel[n.id] = { x: 0, y: 0 };
  });

  const ids = nodes.map(n => n.id);
  const relEdges = edges.filter(e => pos[e.from] && pos[e.to]);

  // Build adjacency for multi-hop awareness
  const neighbors = {};
  ids.forEach(id => { neighbors[id] = new Set(); });
  relEdges.forEach(e => { if (neighbors[e.from]) neighbors[e.from].add(e.to); if (neighbors[e.to]) neighbors[e.to].add(e.from); });

  for (let iter = 0; iter < iters; iter++) {
    const t = iter / iters;
    const cooling = 1 - t * 0.9;
    const force = {};
    ids.forEach(id => { force[id] = { x: 0, y: 0 }; });

    // Repulsion: much weaker for same-faction, stronger for cross-faction
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        const ia = ids[a], ib = ids[b];
        const na = nodeMap[ia], nb = nodeMap[ib];
        const sameFaction = na && nb && na.faction === nb.faction;
        const connected = neighbors[ia] && neighbors[ia].has(ib);
        // Same-faction nodes barely repel; connected nodes repel even less
        let repMult = 1.0;
        if (connected && sameFaction) repMult = 0.1;
        else if (connected) repMult = 0.2;
        else if (sameFaction) repMult = 0.15;
        const rep = REPULSION_BASE * repMult;
        const dx = pos[ia].x - pos[ib].x, dy = pos[ia].y - pos[ib].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        // Cap repulsion at short distances to prevent explosion
        const effectiveDist = Math.max(dist, 30);
        const mag = rep / (effectiveDist * effectiveDist);
        const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
        force[ia].x += nx; force[ia].y += ny;
        force[ib].x -= nx; force[ib].y -= ny;
      }
    }

    // Edge springs: pull connected nodes together with short rest length
    relEdges.forEach(e => {
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const restLen = K * 0.35;
      const mag = (dist - restLen) * SPRING;
      const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
      force[e.from].x += nx; force[e.from].y += ny;
      force[e.to].x -= nx; force[e.to].y -= ny;
    });

    // Faction clustering: pull toward faction centroid
    const centroids = {};
    factionKeys.forEach(fk => {
      let sx = 0, sy = 0, cnt = 0;
      factions[fk].forEach(n => { if (pos[n.id]) { sx += pos[n.id].x; sy += pos[n.id].y; cnt++; } });
      if (cnt > 0) centroids[fk] = { x: sx / cnt, y: sy / cnt };
    });
    const CLUSTER_PULL = 0.02;
    ids.forEach(id => {
      const n = nodeMap[id];
      if (!n || !centroids[n.faction]) return;
      const c = centroids[n.faction];
      force[id].x += (c.x - pos[id].x) * CLUSTER_PULL * cooling;
      force[id].y += (c.y - pos[id].y) * CLUSTER_PULL * cooling;
    });

    // Very gentle gravity
    ids.forEach(id => {
      force[id].x += (centerX - pos[id].x) * 0.0004;
      force[id].y += (centerY - pos[id].y) * 0.0004;
    });

    // Integrate
    ids.forEach(id => {
      const df = pinned.has(id) ? 0.08 : 1.0;
      vel[id].x = (vel[id].x + force[id].x * df) * DAMPING;
      vel[id].y = (vel[id].y + force[id].y * df) * DAMPING;
      const speed = Math.sqrt(vel[id].x ** 2 + vel[id].y ** 2);
      const maxSpeed = K * cooling * 0.5;
      if (speed > maxSpeed) { vel[id].x *= maxSpeed / speed; vel[id].y *= maxSpeed / speed; }
      pos[id].x += vel[id].x;
      pos[id].y += vel[id].y;
    });
  }
  return pos;
}

// ─── Main component ────────────────────────────────────────────────────────
export default function DCCDag() {
  const svgRef = useRef(null);
  const [page, setPage] = useState("dag");
  const [positions, setPositions] = useState({});
  const [focusedIds, setFocusedIds] = useState(new Set()); // characters user clicked to highlight
  const [rosterSearch, setRosterSearch] = useState("");
  const [hovered, setHovered] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [layoutReady, setLayoutReady] = useState(false);
  const dragging = useRef(null);
  const panStart = useRef(null);
  const isPanning = useRef(false);

  // All nodes and edges are always visible
  const visibleIds = useMemo(() => new Set(NODES.map(n => n.id)), []);
  const visibleEdges = useMemo(() => EDGES, []);

  // Nodes/edges connected to focused characters (1-hop)
  const focusedConnected = useMemo(() => {
    if (focusedIds.size === 0 && !hovered) return null;
    const active = new Set([...focusedIds, ...(hovered ? [hovered] : [])]);
    const conn = new Set(active);
    EDGES.forEach(e => {
      if (active.has(e.from) || active.has(e.to)) { conn.add(e.from); conn.add(e.to); }
    });
    return conn;
  }, [focusedIds, hovered]);

  // Run layout once on mount
  useEffect(() => {
    const el = svgRef.current;
    let cx = 1200, cy = 800;
    if (el) { const r = el.getBoundingClientRect(); cx = r.width / 2; cy = r.height / 2; }
    const allIds = NODES.map(n => n.id);
    const np = runForceLayout(allIds, EDGES, {}, cx, cy, 300);
    setPositions(np);
    setLayoutReady(true);
  }, []);

  // Auto-fit after layout
  useEffect(() => {
    if (!layoutReady) return;
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const arr = Object.values(positions);
    if (arr.length === 0) return;
    const pad = 80;
    const minX = Math.min(...arr.map(v => v.x)) - pad;
    const maxX = Math.max(...arr.map(v => v.x)) + pad;
    const minY = Math.min(...arr.map(v => v.y)) - pad;
    const maxY = Math.max(...arr.map(v => v.y)) + pad;
    const z = Math.min(1.0, Math.max(0.1, Math.min(rect.width / (maxX - minX || 1), rect.height / (maxY - minY || 1)) * 0.9));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setPan({ x: rect.width / 2 - cx * z, y: rect.height / 2 - cy * z });
    setZoom(z);
  }, [layoutReady, positions]);

  const centerView = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const arr = Object.values(positions);
    if (arr.length === 0) return;
    const pad = 80;
    const minX = Math.min(...arr.map(v => v.x)) - pad;
    const maxX = Math.max(...arr.map(v => v.x)) + pad;
    const minY = Math.min(...arr.map(v => v.y)) - pad;
    const maxY = Math.max(...arr.map(v => v.y)) + pad;
    const z = Math.min(1.0, Math.max(0.1, Math.min(rect.width / (maxX - minX || 1), rect.height / (maxY - minY || 1)) * 0.9));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setPan({ x: rect.width / 2 - cx * z, y: rect.height / 2 - cy * z });
    setZoom(z);
  }, [positions]);

  const toggleFocus = useCallback((id) => {
    setFocusedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedIds(new Set());
  }, []);

  // ─── Pan & Zoom ──────────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    const p = positions[id]; if (!p) return;
    dragging.current = { id, startX: e.clientX, startY: e.clientY, ox: p.x, oy: p.y, moved: false };
  }, [positions]);

  const onSvgMouseDown = useCallback((e) => {
    if (!dragging.current) { isPanning.current = true; panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }
  }, [pan]);

  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) {
        const { id, startX, startY, ox, oy } = dragging.current;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragging.current.moved = true;
        setPositions(prev => ({ ...prev, [id]: { x: ox + dx / zoom, y: oy + dy / zoom } }));
      } else if (isPanning.current && panStart.current) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
    };
    const onUp = () => { dragging.current = null; isPanning.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [zoom]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const el = svgRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const nz = Math.min(3.0, Math.max(0.15, zoom - e.deltaY * 0.001));
    const wx = (mx - pan.x) / zoom, wy = (my - pan.y) / zoom;
    setPan({ x: mx - wx * nz, y: my - wy * nz });
    setZoom(nz);
  }, [zoom, pan]);

  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const computeEdgePath = useCallback((fp, tp) => {
    const dx = tp.x - fp.x, dy = tp.y - fp.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    const R = 32;
    return {
      x1: fp.x + ux * R, y1: fp.y + uy * R,
      x2: tp.x - ux * (R + 10), y2: tp.y - uy * (R + 10),
      mx: (fp.x + tp.x) / 2 - uy * 20, my: (fp.y + tp.y) / 2 + ux * 20,
    };
  }, []);

  const connectedToSelected = focusedConnected;

  const visibleNodesList = useMemo(() => NODES, []);

  // Compute faction cluster regions for background blobs
  const factionRegions = useMemo(() => {
    const regions = {};
    visibleNodesList.forEach(node => {
      const p = positions[node.id];
      if (!p) return;
      if (!regions[node.faction]) regions[node.faction] = [];
      regions[node.faction].push(p);
    });
    const result = {};
    Object.entries(regions).forEach(([fk, pts]) => {
      if (pts.length < 2) return;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const maxDist = Math.max(60, ...pts.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)));
      result[fk] = { cx, cy, r: maxDist + 55 };
    });
    return result;
  }, [visibleNodesList, positions]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh", width: "100%", background: "#f0e4c4",
      backgroundImage: "radial-gradient(ellipse 80% 60% at 15% 10%, rgba(101,47,0,0.09) 0%, transparent 55%), radial-gradient(ellipse 60% 70% at 88% 88%, rgba(60,20,0,0.07) 0%, transparent 55%), linear-gradient(160deg, #f5ead0 0%, #ecddb8 50%, #e8d5a8 100%)",
      fontFamily: "'IM Fell English', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
      color: "#1a0d00", display: "flex", flexDirection: "column", userSelect: "none", overflow: "hidden",
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px",
        background: "linear-gradient(180deg, #2a1500 0%, #1a0c00 100%)", borderBottom: "3px solid #c9a84c",
        boxShadow: "0 3px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.2)",
        zIndex: 50, flexShrink: 0, gap: 8, minHeight: 48, overflow: "hidden",
      }}>
        <div style={{ flexShrink: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: "#c9a84c", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 0 20px rgba(201,168,76,0.5), 0 1px 3px rgba(0,0,0,0.8)", fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif" }}>
            ⚔ Dungeon Crawler Carl
          </span>
          <span className="dag-subtitle" style={{ marginLeft: 10, fontSize: 12, color: "rgba(201,168,76,0.55)", letterSpacing: "0.06em", fontFamily: "monospace" }}>
            Books 1–7 · Character DAG · {NODES.length} characters · {EDGES.length} edges
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {page === "dag" && <>
            <button onClick={() => centerView()} style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 3, color: "#c9a84c", padding: "5px 13px", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" }}>⊞ Fit View</button>
            {focusedIds.size > 0 && <button onClick={clearFocus} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: "rgba(201,168,76,0.5)", padding: "5px 13px", fontSize: 13, cursor: "pointer" }}>✕ Clear Focus</button>}
          </>}
          <button onClick={() => setPage(p => p === "cookbook" ? "dag" : "cookbook")}
            style={{ background: page === "cookbook" ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)", border: page === "cookbook" ? "1px solid rgba(201,168,76,0.6)" : "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: page === "cookbook" ? "#c9a84c" : "rgba(201,168,76,0.5)", padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif" }}>
            📖 Cookbook Authors
          </button>
        </div>
      </div>

      {page === "cookbook" && <CookbookPage />}
      {page === "dag" && <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Left Roster ── */}
        <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #1e0e00 0%, #160900 100%)", borderRight: "2px solid #8b6914", boxShadow: "3px 0 16px rgba(0,0,0,0.35)", zIndex: 10 }}>
          <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
            <div style={{ fontSize: 11, color: "rgba(201,168,76,0.65)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "Cinzel, Georgia, serif", marginBottom: 6 }}>Click to focus characters</div>
            <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search…"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 3, color: "#e8d5a3", padding: "7px 10px", fontSize: 14, outline: "none", fontFamily: "'IM Fell English', Georgia, serif", boxSizing: "border-box" }} />
            {focusedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
                <span style={{ fontSize: 12, color: "rgba(201,168,76,0.7)", fontFamily: "monospace" }}>{focusedIds.size} focused</span>
                <button onClick={clearFocus} style={{ fontSize: 12, color: "rgba(201,168,76,0.55)", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}>clear</button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {Object.entries(FACTION_STYLE).map(([fk, fStyle]) => {
              const fn = NODES.filter(n => n.faction === fk && (!rosterSearch || n.label.toLowerCase().includes(rosterSearch.toLowerCase())));
              if (fn.length === 0) return null;
              return (
                <div key={fk}>
                  <div style={{ padding: "5px 12px 3px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: fStyle.color, fontFamily: "Cinzel, Georgia, serif", opacity: 0.8 }}>{fStyle.label}</div>
                  {fn.sort((a, b) => a.book - b.book || a.label.localeCompare(b.label)).map(node => {
                    const isFocused = focusedIds.has(node.id);
                    const isConn = focusedConnected && focusedConnected.has(node.id);
                    const isHov = hovered === node.id;
                    return (
                      <div key={node.id} onClick={() => toggleFocus(node.id)} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
                          background: isFocused ? fStyle.color + "33" : isConn ? fStyle.color + "15" : isHov ? "rgba(255,255,255,0.05)" : "transparent",
                          borderLeft: isFocused ? "3px solid " + fStyle.color : "3px solid transparent",
                          cursor: "pointer", transition: "background 0.1s" }}>
                        <span style={{ fontSize: 16 }}>{ROLE_EMOJI[node.role] || "●"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, color: isFocused ? fStyle.color : isConn ? fStyle.color + "cc" : "#c9a87a", fontWeight: isFocused ? 700 : 400, fontFamily: "'IM Fell English', Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</div>
                          <div style={{ fontSize: 12, color: "rgba(201,168,76,0.45)", fontFamily: "monospace" }}>Bk {node.book}</div>
                        </div>
                        {isFocused && <span onClick={(e) => { e.stopPropagation(); toggleFocus(node.id); }} style={{ fontSize: 12, color: "rgba(201,168,76,0.5)", padding: "2px 6px", cursor: "pointer" }}>✕</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SVG Canvas ── */}
        <svg ref={svgRef} style={{ flex: 1, display: "block", cursor: "grab" }}
          onMouseDown={onSvgMouseDown} onClick={() => { if (focusedIds.size > 0) setFocusedIds(new Set()); }}>
          <defs>
            {Object.entries(EDGE_STYLE).map(([type, s]) => (
              <marker key={type} id={"arr-" + type} markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto">
                <path d="M0,0 L0,8 L10,4 z" fill={s.color} opacity="0.85" />
              </marker>
            ))}
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          <g transform={"translate(" + pan.x + "," + pan.y + ") scale(" + zoom + ")"}>
            {/* Faction background regions */}
            {Object.entries(factionRegions).map(([fk, reg]) => {
              const fs = FACTION_STYLE[fk];
              if (!fs) return null;
              return (
                <g key={"region-" + fk}>
                  <circle cx={reg.cx} cy={reg.cy} r={reg.r} fill={fs.color} opacity={0.06} />
                  <circle cx={reg.cx} cy={reg.cy} r={reg.r} fill="none" stroke={fs.color} strokeWidth={1} opacity={0.12} strokeDasharray="8,6" />
                  <text x={reg.cx} y={reg.cy - reg.r + 16} textAnchor="middle" fontSize="11" fill={fs.color} opacity={0.35}
                    style={{ fontFamily: "Cinzel, Georgia, serif", letterSpacing: "0.1em", textTransform: "uppercase", pointerEvents: "none" }}>{fs.label}</text>
                </g>
              );
            })}

            {/* Edges */}
            {visibleEdges.map((e, i) => {
              const fn = positions[e.from], tn = positions[e.to];
              if (!fn || !tn) return null;
              const { x1, y1, x2, y2, mx, my } = computeEdgePath(fn, tn);
              const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
              const isActive = connectedToSelected && (focusedIds.has(e.from) || focusedIds.has(e.to) || hovered === e.from || hovered === e.to);
              const isEdgeHov = hoveredEdge === i;
              const isDim = connectedToSelected && !isActive && !isEdgeHov;
              const pathD = "M" + x1 + "," + y1 + " Q" + mx + "," + my + " " + x2 + "," + y2;
              return (
                <g key={e.from + "-" + e.to + "-" + i}
                  onMouseEnter={() => setHoveredEdge(i)} onMouseLeave={() => setHoveredEdge(null)}>
                  {/* Fat invisible hit area */}
                  <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" style={{ cursor: "pointer" }} />
                  <path d={pathD}
                    fill="none" stroke={es.color}
                    strokeWidth={isEdgeHov ? 3.5 : isActive ? 2.2 : 1.2}
                    strokeOpacity={isDim ? 0.08 : isEdgeHov ? 0.95 : isActive ? 0.7 : 0.25}
                    markerEnd={"url(#arr-" + e.type + ")"}
                    style={{ transition: "stroke-opacity 0.15s, stroke-width 0.15s", pointerEvents: "none" }} />
                </g>
              );
            })}

            {/* Nodes */}
            {visibleNodesList.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const fs = FACTION_STYLE[node.faction];
              const isFocused = focusedIds.has(node.id);
              const isConn = focusedConnected && focusedConnected.has(node.id);
              const isHov = hovered === node.id;
              const isDim = connectedToSelected && !connectedToSelected.has(node.id);
              const baseR = Math.round(28 + getProminence(node.id) * 2.5);
              const R = isFocused ? baseR + 5 : isHov ? baseR + 3 : baseR;
              const nameParts = node.label.split(" ");
              const line1 = nameParts.length <= 2 ? node.label : nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(" ");
              const line2 = nameParts.length <= 2 ? null : nameParts.slice(Math.ceil(nameParts.length / 2)).join(" ");
              const textSize = R > 40 ? 12 : R > 34 ? 11 : 10;
              return (
                <g key={node.id} transform={"translate(" + pos.x + "," + pos.y + ")"}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); if (dragging.current && dragging.current.moved) return; toggleFocus(node.id); }}
                  onMouseEnter={() => { setHovered(node.id); setHoveredEdge(null); }} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                  {(isFocused || isHov) && <circle r={R + 8} fill="none" stroke={fs.color} strokeWidth={isFocused ? 3 : 1.5} opacity={isFocused ? 0.6 : 0.25} />}
                  <circle r={R}
                    fill={isFocused ? fs.dim : isHov ? "#fdf5e0" : isConn ? fs.dim : "#f5ead0"}
                    stroke={fs.color}
                    strokeWidth={isFocused ? 3.5 : isHov ? 2.5 : isConn ? 2 : 1.5}
                    opacity={isDim ? 0.12 : 1}
                    style={{ transition: "all 0.15s ease", filter: isFocused ? "drop-shadow(0 0 12px " + fs.color + "88)" : isHov ? "drop-shadow(0 0 8px " + fs.color + "44)" : "drop-shadow(0 1px 2px rgba(0,0,0,0.1))" }} />
                  <text y={line2 ? -4 : 1} textAnchor="middle" fontSize={isFocused ? textSize + 2 : textSize}
                    fontWeight={isFocused ? "700" : isHov ? "600" : "500"}
                    fill={isDim ? "#aaa" : isFocused || isHov ? fs.color : "#2a1500"}
                    opacity={isDim ? 0.15 : 1}
                    style={{ pointerEvents: "none", fontFamily: "'IM Fell English', Georgia, serif" }}>{line1}</text>
                  {line2 && <text y={(isFocused ? textSize + 2 : textSize) + 1} textAnchor="middle" fontSize={isFocused ? textSize + 2 : textSize}
                    fontWeight={isFocused ? "700" : isHov ? "600" : "500"}
                    fill={isDim ? "#aaa" : isFocused || isHov ? fs.color : "#2a1500"}
                    opacity={isDim ? 0.15 : 1}
                    style={{ pointerEvents: "none", fontFamily: "'IM Fell English', Georgia, serif" }}>{line2}</text>}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 14, right: 60, background: "linear-gradient(170deg, #f5ead0 0%, #ecddb8 100%)", border: "1px solid rgba(139,105,20,0.45)", boxShadow: "2px 2px 10px rgba(0,0,0,0.18), inset 0 0 20px rgba(139,105,20,0.06)", borderRadius: 10, padding: "11px 13px", minWidth: 190, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: "#6b4c1a", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Cinzel, Georgia, serif" }}>Groups</div>
          {Object.entries(FACTION_STYLE).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 13, color: "#2a1500", fontFamily: "'IM Fell English', Georgia, serif" }}>{v.label}</span>
            </div>
          ))}
          {visibleIds.size > 0 && <div style={{ marginTop: 8, borderTop: "1px solid rgba(139,105,20,0.25)", paddingTop: 6, fontSize: 12, color: "#6b4c1a", fontFamily: "monospace" }}>{visibleIds.size} nodes · {visibleEdges.length} edges</div>}
        </div>

        {/* Zoom */}
        <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(245,230,200,0.92)", borderRadius: 3, padding: "3px 9px", fontSize: 12, color: "#6b4c1a", border: "1px solid rgba(139,105,20,0.3)", fontFamily: "monospace" }}>{Math.round(zoom * 100)}%</div>

        {/* Hover tooltip — edge or node */}
        {hoveredEdge !== null && (() => {
          const e = visibleEdges[hoveredEdge];
          if (!e) return null;
          const fromNode = getNodeById(e.from);
          const toNode = getNodeById(e.to);
          if (!fromNode || !toNode) return null;
          const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
          const fromFs = FACTION_STYLE[fromNode.faction];
          const toFs = FACTION_STYLE[toNode.faction];
          return (
            <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(160deg, #2a1500 0%, #1a0c00 100%)", border: "1px solid " + es.color + "88", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", borderRadius: 6, padding: "12px 18px", minWidth: 240, maxWidth: 400, pointerEvents: "none", zIndex: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: fromFs.color, fontFamily: "Cinzel, Georgia, serif" }}>{fromNode.label}</span>
                <span style={{ fontSize: 11, color: es.color, fontFamily: "monospace" }}>→</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: toFs.color, fontFamily: "Cinzel, Georgia, serif" }}>{toNode.label}</span>
              </div>
              <div style={{ fontSize: 13, color: "#e8d5a3", lineHeight: 1.6, fontFamily: "'IM Fell English', Georgia, serif", marginBottom: 6 }}>{e.label}</div>
              <div style={{ fontSize: 10, color: es.color, fontFamily: "monospace", opacity: 0.7 }}>{e.type}</div>
            </div>
          );
        })()}
        {hovered && hoveredEdge === null && (() => {
          const hn = getNodeById(hovered);
          if (!hn) return null;
          const hfs = FACTION_STYLE[hn.faction];
          const he = EDGES.filter(e => e.from === hovered || e.to === hovered);
          const visHe = he.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
          const onCanvas = visibleIds.has(hovered);
          return (
            <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(160deg, #2a1500 0%, #1a0c00 100%)", border: "1px solid " + hfs.color + "66", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", borderRadius: 6, padding: "12px 18px", minWidth: 240, maxWidth: 420, pointerEvents: "none", zIndex: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{ROLE_EMOJI[hn.role] || "●"}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: hfs.color, fontFamily: "Cinzel, Georgia, serif", letterSpacing: "0.04em" }}>{hn.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(201,168,76,0.5)", fontFamily: "monospace" }}>{hfs.label} · Book {hn.book} · {hn.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: "#c9a87a", lineHeight: 1.75, fontFamily: "'IM Fell English', Georgia, serif", fontStyle: "italic", marginBottom: 8 }}>
                {hn.desc ? hn.desc.slice(0, 220) + (hn.desc.length > 220 ? "…" : "") : ""}
              </div>
              {visHe.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(201,168,76,0.15)", paddingTop: 6 }}>
                  {visHe.slice(0, 5).map((re, ri) => {
                    const other = re.from === hovered ? getNodeById(re.to) : getNodeById(re.from);
                    const dir = re.from === hovered ? "→" : "←";
                    const efs = other ? FACTION_STYLE[other.faction] : null;
                    return (
                      <div key={ri} style={{ fontSize: 11, color: "#c9a87a", marginBottom: 3, fontFamily: "monospace" }}>
                        <span style={{ color: "rgba(201,168,76,0.4)" }}>{dir}</span>{" "}
                        <span style={{ color: efs ? efs.color : "#c9a87a", fontWeight: 600 }}>{other ? other.label : "?"}</span>{" "}
                        <span style={{ color: "rgba(201,168,76,0.35)", fontSize: 10 }}>{re.label}</span>
                      </div>
                    );
                  })}
                  {visHe.length > 5 && <div style={{ fontSize: 10, color: "rgba(201,168,76,0.3)", fontFamily: "monospace" }}>+{visHe.length - 5} more</div>}
                </div>
              )}
              <div style={{ fontSize: 10, color: "rgba(201,168,76,0.35)", fontFamily: "monospace", marginTop: 6 }}>
                {he.length} total relationship{he.length !== 1 ? "s" : ""} · {focusedIds.has(hovered) ? "click to unfocus" : "click to focus"}
              </div>
            </div>
          );
        })()}
      </div>}

      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');\
        @media (max-width: 600px) { .dag-subtitle { display: none; } }\
        button { font-family: inherit; } select { font-family: inherit; } * { box-sizing: border-box; }\
        input::placeholder { color: #8b6914; opacity: 0.6; }\
      "}</style>
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

  const C = {
    bg: "linear-gradient(160deg, #f5ead0 0%, #ecddb8 50%, #e8d5a8 100%)",
    ink: "#1e0f00",
    dim: "#6b4c1a",
    gold: "#8b6914",
    border: "rgba(139,105,20,0.25)",
    rowHover: "rgba(139,105,20,0.08)",
    rowOpen: "rgba(255,248,230,0.9)",
    cinzel: "Cinzel, 'Palatino Linotype', Georgia, serif",
    fell: "'IM Fell English', 'Palatino Linotype', Georgia, serif",
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", background: C.bg, fontFamily: C.fell, color: C.ink }}>

      {/* ── Header ── */}
      <div style={{ padding: "32px 40px 20px", borderBottom: `2px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.gold, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: C.cinzel, marginBottom: 8 }}>
          Reference Compendium
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 28, fontWeight: 700, fontFamily: C.cinzel, color: "#2a0f00", letterSpacing: "0.05em" }}>
          The Dungeon Anarchist's Cookbook
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.85, color: "#3d2000", maxWidth: 680, fontStyle: "italic" }}>
          Created by the System AI in the 15th season. Passed to crawlers meeting unknown criteria —
          neither audience nor production can see its contents. Disappears on death or retirement.
          25 known editions. Most of its authors did not survive.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { val: 25,           label: "Editions",       col: "#5c1a00" },
            { val: totals.dead,  label: "Confirmed Slain", col: "#6b0000" },
            { val: totals.alive, label: "Living",          col: "#1a4a1a" },
            { val: totals.b7,    label: "Active in Bk 7",  col: "#3a1a6e" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center", minWidth: 80, padding: "10px 18px", background: "rgba(139,105,20,0.08)", border: `1px solid ${s.col}33`, borderRadius: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: C.cinzel, color: s.col, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10.5, color: C.gold, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: C.cinzel }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", gap: 8, padding: "14px 40px", alignItems: "center", borderBottom: `1px solid ${C.border}`, background: "rgba(139,105,20,0.04)" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, race, or contributions…"
          style={{ flex: 1, minWidth: 200, maxWidth: 360, background: "rgba(255,248,230,0.8)", border: `1px solid ${C.border}`, borderRadius: 3, color: C.ink, padding: "7px 12px", fontSize: 14, outline: "none", fontFamily: C.fell }} />
        {["ALL","alive","dead","unknown"].map(s => {
          const labels = { ALL:"All Authors", alive:"Living", dead:"Slain", unknown:"Unknown" };
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              background: active ? "rgba(139,105,20,0.18)" : "transparent",
              border: active ? `1px solid rgba(139,105,20,0.5)` : `1px solid ${C.border}`,
              borderRadius: 3, color: active ? "#2a0f00" : C.dim,
              padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.fell,
            }}>{labels[s]}</button>
          );
        })}
        <span style={{ fontSize: 12, color: C.gold, marginLeft: 4, fontFamily: "monospace" }}>{filtered.length} / {AUTHORS.length}</span>
      </div>

      {/* ── Table ── */}
      <div style={{ padding: "0 40px 60px" }}>
        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 180px 110px 90px 28px", gap: 0, padding: "12px 16px 10px", borderBottom: `2px solid ${C.border}`, marginTop: 16 }}>
          {["Ed.", "Author", "Race", "Status", "Book 7?", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 10, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: C.cinzel }}>{h}</div>
          ))}
        </div>

        {filtered.map(a => {
          const sc = STATUS_CONFIG[a.status];
          const isOpen = expanded === a.ed;
          return (
            <div key={a.ed} style={{ borderBottom: `1px solid ${C.border}` }}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(isOpen ? null : a.ed)}
                style={{
                  display: "grid", gridTemplateColumns: "52px 1fr 180px 110px 90px 28px",
                  gap: 0, padding: "13px 16px", cursor: "pointer",
                  background: isOpen ? C.rowOpen : "transparent",
                  transition: "background 0.12s",
                  borderLeft: isOpen ? `3px solid ${sc.color}` : "3px solid transparent",
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = C.rowHover; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}>

                {/* Ed number */}
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: C.cinzel, color: "#5c1a00", lineHeight: 1.2 }}>
                  {a.ed}<span style={{ fontSize: 9, color: C.gold, marginLeft: 1, fontFamily: "monospace" }}>{a.suffix}</span>
                </div>

                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: a.isUnknown ? 400 : 600, color: a.isUnknown ? C.dim : C.ink, fontStyle: a.isUnknown ? "italic" : "normal" }}>
                    {a.name}
                  </span>
                  {a.b7 && <span style={{ fontSize: 9.5, background: "rgba(58,26,110,0.1)", color: "#3a1a6e", border: "1px solid rgba(58,26,110,0.3)", borderRadius: 2, padding: "1px 6px", letterSpacing: "0.06em", fontFamily: C.cinzel }}>BK 7</span>}
                </div>

                {/* Race */}
                <div style={{ fontSize: 13.5, color: C.dim, fontStyle: "italic", paddingRight: 8, lineHeight: 1.3 }}>{a.race !== "Unknown" ? a.race : "—"}</div>

                {/* Status */}
                <div>
                  <span style={{ fontSize: 12.5, padding: "3px 10px", borderRadius: 2, background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44`, fontFamily: C.cinzel, letterSpacing: "0.04em" }}>
                    {sc.label}
                  </span>
                </div>

                {/* Book 7 active */}
                <div style={{ fontSize: 13, color: a.b7 ? "#3a1a6e" : C.border, textAlign: "center" }}>
                  {a.b7 ? "✦" : "·"}
                </div>

                {/* Chevron */}
                <div style={{ fontSize: 14, color: C.gold, textAlign: "right", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}>›</div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: "20px 20px 24px 68px", background: C.rowOpen, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }} className="cb-grid">
                    <div>
                      <div style={{ fontSize: 9.5, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: C.cinzel, marginBottom: 10 }}>Contributions & Crawl Notes</div>
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.9, color: "#2a1000" }}>{a.contributions}</p>
                    </div>
                    <div>
                      <div style={{ fontSize: 9.5, color: C.gold, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: C.cinzel, marginBottom: 10 }}>Whereabouts — End of Book 7</div>
                      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.9, color: a.status === "dead" ? "#5a0000" : a.status === "alive" ? "#0f3a0f" : C.dim }}>{a.whereabouts}</p>
                      {a.season && <p style={{ margin: "12px 0 0", fontSize: 12, color: C.gold, fontStyle: "italic" }}>{a.season}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p style={{ marginTop: 24, fontSize: 12.5, color: C.gold, fontStyle: "italic", lineHeight: 1.8 }}>
          The 1st Edition has no confirmed author. The 23rd Edition (between Drakea's 22nd and Rickard's 24th) exists but its author is unnamed through Book 7.
          All status reflects <em>This Inevitable Ruin</em> (Book 7).
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&display=swap');
        .cb-grid { grid-template-columns: 1fr 1fr; }
        @media (max-width: 720px) { .cb-grid { grid-template-columns: 1fr !important; } }
        input::placeholder { color: #8b6914; opacity: 0.6; }
      `}</style>
    </div>
  );
}


