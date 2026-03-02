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
  const W = 2400, H = 1600;
  const K = Math.sqrt((W * H) / Math.max(nodes.length, 1)) * 0.7;
  const REPULSION = K * K * 1.8;
  const SPRING = 0.012;
  const DAMPING = 0.78;
  const pos = {}, vel = {};
  const pinned = new Set();

  nodes.forEach(n => {
    if (existingPositions[n.id]) {
      pos[n.id] = { ...existingPositions[n.id] };
      pinned.add(n.id);
    } else {
      const ce = edges.find(e =>
        (e.from === n.id && existingPositions[e.to]) ||
        (e.to === n.id && existingPositions[e.from])
      );
      if (ce) {
        const nid = ce.from === n.id ? ce.to : ce.from;
        const np = existingPositions[nid];
        pos[n.id] = { x: np.x + (Math.random() - 0.5) * 160, y: np.y + (Math.random() - 0.5) * 160 };
      } else {
        pos[n.id] = { x: centerX + (Math.random() - 0.5) * 300, y: centerY + (Math.random() - 0.5) * 300 };
      }
    }
    vel[n.id] = { x: 0, y: 0 };
  });

  const ids = nodes.map(n => n.id);
  const relEdges = edges.filter(e => pos[e.from] && pos[e.to]);

  for (let iter = 0; iter < iters; iter++) {
    const cooling = 1 - (iter / iters) * 0.92;
    const force = {};
    ids.forEach(id => { force[id] = { x: 0, y: 0 }; });
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
    relEdges.forEach(e => {
      const dx = pos[e.to].x - pos[e.from].x, dy = pos[e.to].y - pos[e.from].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const mag = (dist - K * 0.6) * SPRING;
      const nx = (dx / dist) * mag, ny = (dy / dist) * mag;
      force[e.from].x += nx; force[e.from].y += ny;
      force[e.to].x -= nx; force[e.to].y -= ny;
    });
    ids.forEach(id => {
      force[id].x += (centerX - pos[id].x) * 0.0008;
      force[id].y += (centerY - pos[id].y) * 0.0008;
    });
    ids.forEach(id => {
      const df = pinned.has(id) ? 0.15 : 1.0;
      vel[id].x = (vel[id].x + force[id].x * df) * DAMPING;
      vel[id].y = (vel[id].y + force[id].y * df) * DAMPING;
      const speed = Math.sqrt(vel[id].x ** 2 + vel[id].y ** 2);
      const maxSpeed = K * cooling * 0.45;
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
  const [addedIds, setAddedIds] = useState(new Set());
  const [positions, setPositions] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [rosterSearch, setRosterSearch] = useState("");
  const [hovered, setHovered] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const dragging = useRef(null);
  const panStart = useRef(null);
  const isPanning = useRef(false);
  const addCountRef = useRef(0);

  const visibleIds = useMemo(() => {
    const vis = new Set(addedIds);
    EDGES.forEach(e => {
      if (addedIds.has(e.from) || addedIds.has(e.to)) { vis.add(e.from); vis.add(e.to); }
    });
    return vis;
  }, [addedIds]);

  const visibleEdges = useMemo(() => EDGES.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to)), [visibleIds]);

  const centerView = useCallback((posOverride) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    const p = posOverride || positions;
    const arr = Object.values(p);
    if (arr.length === 0) { setPan({ x: 0, y: 0 }); setZoom(1.0); return; }
    const minX = Math.min(...arr.map(v => v.x)) - 100;
    const maxX = Math.max(...arr.map(v => v.x)) + 100;
    const minY = Math.min(...arr.map(v => v.y)) - 100;
    const maxY = Math.max(...arr.map(v => v.y)) + 100;
    const z = Math.min(1.8, Math.max(0.15, Math.min(rect.width / (maxX - minX || 1), rect.height / (maxY - minY || 1)) * 0.85));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setPan({ x: rect.width / 2 - cx * z, y: rect.height / 2 - cy * z });
    setZoom(z);
  }, [positions]);

  const addCharacter = useCallback((id) => {
    setAddedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      const newVis = new Set(next);
      EDGES.forEach(e => { if (next.has(e.from) || next.has(e.to)) { newVis.add(e.from); newVis.add(e.to); } });
      const relEdges = EDGES.filter(e => newVis.has(e.from) && newVis.has(e.to));
      const el = svgRef.current;
      let cx = 600, cy = 400;
      if (el) { const r = el.getBoundingClientRect(); cx = (r.width / 2 - pan.x) / zoom; cy = (r.height / 2 - pan.y) / zoom; }
      setPositions(prevPos => {
        const np = runForceLayout([...newVis], relEdges, prevPos, cx, cy, Object.keys(prevPos).length > 0 ? 120 : 200);
        addCountRef.current++;
        if (addCountRef.current <= 3) setTimeout(() => centerView(np), 30);
        return np;
      });
      return next;
    });
    setSelectedIds(prev => { const s = new Set(prev); s.add(id); return s; });
  }, [pan, zoom, centerView]);

  const removeCharacter = useCallback((id) => {
    setAddedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      if (next.size === 0) { setPositions({}); setSelectedIds(new Set()); addCountRef.current = 0; return next; }
      const newVis = new Set(next);
      EDGES.forEach(e => { if (next.has(e.from) || next.has(e.to)) { newVis.add(e.from); newVis.add(e.to); } });
      const relEdges = EDGES.filter(e => newVis.has(e.from) && newVis.has(e.to));
      const el = svgRef.current;
      let cx = 600, cy = 400;
      if (el) { const r = el.getBoundingClientRect(); cx = (r.width / 2 - pan.x) / zoom; cy = (r.height / 2 - pan.y) / zoom; }
      setPositions(prevPos => {
        const kept = {};
        newVis.forEach(nid => { if (prevPos[nid]) kept[nid] = prevPos[nid]; });
        return runForceLayout([...newVis], relEdges, kept, cx, cy, 80);
      });
      return next;
    });
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }, [pan, zoom]);

  const toggleRoster = useCallback((id) => {
    if (!addedIds.has(id)) addCharacter(id);
    else setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }, [addedIds, addCharacter]);

  const clearAll = useCallback(() => {
    setAddedIds(new Set()); setSelectedIds(new Set()); setPositions({}); addCountRef.current = 0;
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
    const R = 26;
    return {
      x1: fp.x + ux * R, y1: fp.y + uy * R,
      x2: tp.x - ux * (R + 8), y2: tp.y - uy * (R + 8),
      mx: (fp.x + tp.x) / 2 - uy * 22, my: (fp.y + tp.y) / 2 + ux * 22,
    };
  }, []);

  const connectedToSelected = useMemo(() => {
    if (selectedIds.size === 0 && !hovered) return null;
    const active = new Set([...selectedIds, ...(hovered ? [hovered] : [])]);
    const conn = new Set(active);
    visibleEdges.forEach(e => { if (active.has(e.from) || active.has(e.to)) { conn.add(e.from); conn.add(e.to); } });
    return conn;
  }, [selectedIds, hovered, visibleEdges]);

  const visibleNodesList = useMemo(() => [...visibleIds].map(id => getNodeById(id)).filter(Boolean), [visibleIds]);

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
          <span style={{ fontSize: 15, fontWeight: 700, color: "#c9a84c", letterSpacing: "0.12em", textTransform: "uppercase", textShadow: "0 0 20px rgba(201,168,76,0.5), 0 1px 3px rgba(0,0,0,0.8)", fontFamily: "'Cinzel', 'Palatino Linotype', Georgia, serif" }}>
            ⚔ Dungeon Crawler Carl
          </span>
          <span className="dag-subtitle" style={{ marginLeft: 10, fontSize: 10, color: "rgba(201,168,76,0.45)", letterSpacing: "0.06em", fontFamily: "monospace" }}>
            Books 1–7 · Character DAG · {NODES.length} characters · {EDGES.length} edges
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {page === "dag" && addedIds.size > 0 && <>
            <button onClick={() => centerView()} style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 3, color: "#c9a84c", padding: "4px 11px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia, serif" }}>⊞ Fit View</button>
            <button onClick={clearAll} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: "rgba(201,168,76,0.5)", padding: "4px 11px", fontSize: 11, cursor: "pointer" }}>✕ Clear All</button>
          </>}
          <button onClick={() => setPage(p => p === "cookbook" ? "dag" : "cookbook")}
            style={{ background: page === "cookbook" ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)", border: page === "cookbook" ? "1px solid rgba(201,168,76,0.6)" : "1px solid rgba(201,168,76,0.2)", borderRadius: 3, color: page === "cookbook" ? "#c9a84c" : "rgba(201,168,76,0.5)", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "Georgia, serif" }}>
            📖 Cookbook Authors
          </button>
        </div>
      </div>

      {page === "cookbook" && <CookbookPage />}
      {page === "dag" && <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>

        {/* ── Left Roster ── */}
        <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #1e0e00 0%, #160900 100%)", borderRight: "2px solid #8b6914", boxShadow: "3px 0 16px rgba(0,0,0,0.35)", zIndex: 10 }}>
          <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
            <div style={{ fontSize: 9, color: "rgba(201,168,76,0.5)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "Cinzel, Georgia, serif", marginBottom: 6 }}>Click characters to build graph</div>
            <input value={rosterSearch} onChange={e => setRosterSearch(e.target.value)} placeholder="Search…"
              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 3, color: "#e8d5a3", padding: "5px 9px", fontSize: 12, outline: "none", fontFamily: "'IM Fell English', Georgia, serif", boxSizing: "border-box" }} />
            {addedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
                <span style={{ fontSize: 10, color: "rgba(201,168,76,0.6)", fontFamily: "monospace" }}>{visibleIds.size} on graph · {addedIds.size} pinned</span>
                <button onClick={clearAll} style={{ fontSize: 10, color: "rgba(201,168,76,0.45)", background: "none", border: "none", cursor: "pointer", padding: "1px 4px" }}>clear</button>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {Object.entries(FACTION_STYLE).map(([fk, fStyle]) => {
              const fn = NODES.filter(n => n.faction === fk && (!rosterSearch || n.label.toLowerCase().includes(rosterSearch.toLowerCase())));
              if (fn.length === 0) return null;
              return (
                <div key={fk}>
                  <div style={{ padding: "5px 12px 3px", fontSize: 8.5, letterSpacing: "0.14em", textTransform: "uppercase", color: fStyle.color, fontFamily: "Cinzel, Georgia, serif", opacity: 0.7 }}>{fStyle.label}</div>
                  {fn.sort((a, b) => a.book - b.book || a.label.localeCompare(b.label)).map(node => {
                    const isAdded = addedIds.has(node.id);
                    const isOnCanvas = visibleIds.has(node.id);
                    const isHov = hovered === node.id;
                    return (
                      <div key={node.id} onClick={() => toggleRoster(node.id)} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)}
                        style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 12px",
                          background: isAdded ? fStyle.color + "22" : isOnCanvas ? fStyle.color + "0d" : isHov ? "rgba(255,255,255,0.05)" : "transparent",
                          borderLeft: isAdded ? "3px solid " + fStyle.color : isOnCanvas ? "3px solid " + fStyle.color + "55" : "3px solid transparent",
                          cursor: "pointer", transition: "background 0.1s" }}>
                        <span style={{ fontSize: 13 }}>{ROLE_EMOJI[node.role] || "●"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: isAdded ? fStyle.color : isOnCanvas ? fStyle.color + "cc" : "#c9a87a", fontWeight: isAdded ? 700 : isOnCanvas ? 500 : 400, fontFamily: "'IM Fell English', Georgia, serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}</div>
                          <div style={{ fontSize: 9.5, color: "rgba(201,168,76,0.35)", fontFamily: "monospace" }}>Bk {node.book}</div>
                        </div>
                        {isAdded && <span onClick={(e) => { e.stopPropagation(); removeCharacter(node.id); }} style={{ fontSize: 9, color: "rgba(201,168,76,0.4)", padding: "2px 4px", cursor: "pointer" }} title="Remove from graph">✕</span>}
                        {!isAdded && isOnCanvas && <span style={{ fontSize: 8, color: "rgba(201,168,76,0.3)", fontFamily: "monospace" }}>linked</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SVG Canvas ── */}
        <svg ref={svgRef} style={{ flex: 1, display: "block", cursor: visibleIds.size > 0 ? "grab" : "default" }}
          onMouseDown={onSvgMouseDown} onClick={() => { if (selectedIds.size > 0) setSelectedIds(new Set()); }}>
          <defs>
            {Object.entries(EDGE_STYLE).map(([type, s]) => (
              <marker key={type} id={"arr-" + type} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill={s.color} opacity="0.9" />
              </marker>
            ))}
            <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>

          {visibleIds.size === 0 && (
            <g>
              <text x="50%" y="42%" textAnchor="middle" fontSize="22" fill="#8b6914" opacity="0.5" style={{ fontFamily: "'Cinzel', Georgia, serif", letterSpacing: "0.08em" }}>⚔ Select Characters to Build the Graph</text>
              <text x="50%" y="49%" textAnchor="middle" fontSize="13" fill="#8b6914" opacity="0.35" style={{ fontFamily: "'IM Fell English', Georgia, serif" }}>Click characters in the left panel — their connections appear automatically</text>
              <text x="50%" y="55%" textAnchor="middle" fontSize="11" fill="#8b6914" opacity="0.25" style={{ fontFamily: "monospace" }}>Try starting with Carl or Princess Donut</text>
            </g>
          )}

          <g transform={"translate(" + pan.x + "," + pan.y + ") scale(" + zoom + ")"}>
            {/* Edges */}
            {visibleEdges.map((e, i) => {
              const fn = positions[e.from], tn = positions[e.to];
              if (!fn || !tn) return null;
              const { x1, y1, x2, y2, mx, my } = computeEdgePath(fn, tn);
              const es = EDGE_STYLE[e.type] || EDGE_STYLE.connected;
              const isActive = connectedToSelected && (selectedIds.has(e.from) || selectedIds.has(e.to) || hovered === e.from || hovered === e.to);
              const isDim = connectedToSelected && !isActive;
              return (
                <g key={e.from + "-" + e.to + "-" + i}>
                  <path d={"M" + x1 + "," + y1 + " Q" + mx + "," + my + " " + x2 + "," + y2}
                    fill="none" stroke={es.color} strokeWidth={isActive ? 2.2 : 1.0}
                    strokeOpacity={isDim ? 0.08 : isActive ? 0.85 : 0.3}
                    markerEnd={"url(#arr-" + e.type + ")"}
                    style={{ transition: "stroke-opacity 0.15s, stroke-width 0.15s" }} />
                  {isActive && <text x={mx} y={my - 7} fontSize="9" fill={es.color} opacity="0.85" textAnchor="middle" pointerEvents="none" style={{ fontFamily: "monospace" }}>{e.label}</text>}
                </g>
              );
            })}

            {/* Nodes */}
            {visibleNodesList.map(node => {
              const pos = positions[node.id];
              if (!pos) return null;
              const fs = FACTION_STYLE[node.faction];
              const isAdded = addedIds.has(node.id);
              const isSel = selectedIds.has(node.id);
              const isHov = hovered === node.id;
              const isDim = connectedToSelected && !connectedToSelected.has(node.id);
              const baseR = Math.round(14 + getProminence(node.id) * 2.0);
              const R = isSel ? baseR + 6 : isHov ? baseR + 4 : baseR;
              return (
                <g key={node.id} transform={"translate(" + pos.x + "," + pos.y + ")"}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); if (dragging.current && dragging.current.moved) return; if (!isAdded) addCharacter(node.id); else setSelectedIds(prev => { const s = new Set(prev); s.has(node.id) ? s.delete(node.id) : s.add(node.id); return s; }); }}
                  onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                  {(isSel || isHov) && <circle r={R + 8} fill="none" stroke={fs.color} strokeWidth={isSel ? 2 : 1} opacity={isSel ? 0.45 : 0.18} />}
                  {isAdded && !isSel && !isHov && <circle r={R + 4} fill="none" stroke={fs.color} strokeWidth={1} opacity={0.2} strokeDasharray="3,3" />}
                  <circle r={R} fill={isSel ? fs.dim : isHov ? "#fdf5e0" : isAdded ? fs.dim : "#f8efd4"} stroke={fs.color}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : isAdded ? 2 : 1.2} opacity={isDim ? 0.2 : 1}
                    style={{ transition: "all 0.12s ease", filter: isSel || isHov ? "drop-shadow(0 0 6px " + fs.color + "66)" : "drop-shadow(0 1px 2px rgba(0,0,0,0.14))" }} />
                  <text y={-1} textAnchor="middle" fontSize={isSel ? 15 : 13} opacity={isDim ? 0.15 : 0.85} style={{ pointerEvents: "none" }}>{ROLE_EMOJI[node.role] || "●"}</text>
                  {(isSel || isHov || isAdded || getProminence(node.id) >= 4) && (
                    <text y={R + 15} textAnchor="middle" fontSize={isSel ? 13 : isHov ? 12 : 11}
                      fontWeight={isSel ? "700" : isHov ? "600" : isAdded ? "600" : "500"}
                      fill={isSel || isHov || isAdded ? fs.color : "#3d2000"}
                      opacity={isDim ? 0.12 : isSel || isHov || isAdded ? 1 : 0.65}
                      style={{ pointerEvents: "none", fontFamily: "'IM Fell English', Georgia, serif" }}>{node.label}</text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 14, right: 60, background: "linear-gradient(170deg, #f5ead0 0%, #ecddb8 100%)", border: "1px solid rgba(139,105,20,0.45)", boxShadow: "2px 2px 10px rgba(0,0,0,0.18), inset 0 0 20px rgba(139,105,20,0.06)", borderRadius: 10, padding: "11px 13px", minWidth: 168, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
          <div style={{ fontSize: 9, color: "#6b4c1a", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 7, fontFamily: "Cinzel, Georgia, serif" }}>Groups</div>
          {Object.entries(FACTION_STYLE).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} />
              <span style={{ fontSize: 10, color: "#2a1500", fontFamily: "'IM Fell English', Georgia, serif" }}>{v.label}</span>
            </div>
          ))}
          {visibleIds.size > 0 && <div style={{ marginTop: 8, borderTop: "1px solid rgba(139,105,20,0.25)", paddingTop: 6, fontSize: 9, color: "#6b4c1a", fontFamily: "monospace" }}>{visibleIds.size} nodes · {visibleEdges.length} edges</div>}
        </div>

        {/* Zoom */}
        <div style={{ position: "absolute", bottom: 14, right: 14, background: "rgba(245,230,200,0.92)", borderRadius: 3, padding: "3px 9px", fontSize: 10, color: "#6b4c1a", border: "1px solid rgba(139,105,20,0.3)", fontFamily: "monospace" }}>{Math.round(zoom * 100)}%</div>

        {/* Hover tooltip */}
        {hovered && (() => {
          const hn = getNodeById(hovered);
          if (!hn) return null;
          const hfs = FACTION_STYLE[hn.faction];
          const he = EDGES.filter(e => e.from === hovered || e.to === hovered);
          const onCanvas = visibleIds.has(hovered);
          return (
            <div style={{ position: "absolute", bottom: 60, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(160deg, #2a1500 0%, #1a0c00 100%)", border: "1px solid " + hfs.color + "66", boxShadow: "0 4px 20px rgba(0,0,0,0.5)", borderRadius: 6, padding: "11px 16px", minWidth: 200, maxWidth: 340, pointerEvents: "none", zIndex: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{ROLE_EMOJI[hn.role] || "●"}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: hfs.color, fontFamily: "Cinzel, Georgia, serif" }}>{hn.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(201,168,76,0.5)", fontFamily: "monospace" }}>{hfs.label} · Bk {hn.book} · {hn.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#c9a87a", lineHeight: 1.7, fontFamily: "'IM Fell English', Georgia, serif", fontStyle: "italic", marginBottom: 6 }}>
                {hn.desc ? hn.desc.slice(0, 140) + (hn.desc.length > 140 ? "…" : "") : ""}
              </div>
              <div style={{ fontSize: 10, color: "rgba(201,168,76,0.4)", fontFamily: "monospace" }}>
                {he.length} relationship{he.length !== 1 ? "s" : ""} · {!onCanvas ? "click to add" : addedIds.has(hovered) ? "click to select" : "click to expand"}
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


