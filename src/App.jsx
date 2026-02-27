import { useState, useRef, useEffect, useCallback } from "react";
import { NODES, EDGES } from "./data.js";

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
  party:       { color: "#f59e0b" },
  trains:      { color: "#fde68a" },
  allied:      { color: "#34d399" },
  protected:   { color: "#34d399" },
  killed:      { color: "#f87171" },
  antagonizes: { color: "#f87171" },
  hunts:       { color: "#f87171" },
  controls:    { color: "#a78bfa" },
  employs:     { color: "#a78bfa" },
  manages:     { color: "#60a5fa" },
  hosts:       { color: "#60a5fa" },
  rescued:     { color: "#34d399" },
  companion:   { color: "#f59e0b" },
  causes:      { color: "#fb923c" },
  exgf:        { color: "#94a3b8" },
  leads:       { color: "#34d399" },
  puppet:      { color: "#f87171" },
  connected:   { color: "#78716c" },
  quest:       { color: "#fb923c" },
  joined:      { color: "#34d399" },
  brokers:     { color: "#60a5fa" },
  coerces:     { color: "#f87171" },
  loved:       { color: "#fb923c" },
  replaces:    { color: "#a78bfa" },
  tricks:      { color: "#f87171" },
  mentors:     { color: "#fde68a" },
};

const ROLE_EMOJI = {
  "Crawler": "⚔️", "Mage": "🔮", "Healer": "💚", "Trickster": "🃏",
  "Engineer": "⚙️", "Juggernaut": "🚛", "Summoner": "🌸", "Companion": "🐾",
  "Caretaker": "🧑‍⚕️", "Resident": "👴", "Player Killer": "🗡️", "Boss": "💀",
  "Show Host": "📺", "Host/Boss": "👑", "PR Agent": "📣", "Admin": "🖥️",
  "Corp Entity": "🏢", "Elite NPC": "✨", "NPC": "🧙", "Survivor": "🏃",
  "Pre-Dungeon": "💔", "Aerialist": "🐐", "Shepherd": "🌿", "Antagonist": "⚡",
  "Medic": "🏥", "Hunter": "🎯", "Hunter Leader": "🪲", "Country Boss": "👸",
  "Boss/Pet": "🐈", "Pet/Ally": "🦕", "Boss/Deity": "🕷️", "Deity": "⛩️",
};

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

export default function DCCDag() {
  const svgRef = useRef(null);
  const [positions, setPositions] = useState(() => {
    const m = {};
    NODES.forEach(n => { m[n.id] = { x: n.x, y: n.y }; });
    return m;
  });
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 20 });
  const [zoom, setZoom] = useState(0.72);
  const [filterFaction, setFilterFaction] = useState("ALL");
  const [filterBook, setFilterBook] = useState("ALL");
  const dragging = useRef(null);
  const panStart = useRef(null);
  const isPanning = useRef(false);

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
    dragging.current = { id, startX: e.clientX, startY: e.clientY, ox: positions[id].x, oy: positions[id].y };
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
        setPositions(p => ({ ...p, [id]: { x: ox + (e.clientX - startX) / zoom, y: oy + (e.clientY - startY) / zoom } }));
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
    setZoom(z => Math.min(2.5, Math.max(0.2, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

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
          <span style={{ marginLeft: 10, fontSize: 11, color: "#57534e" }}>Books 1–6 · Character DAG · {NODES.length} characters · {EDGES.length} edges</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {["ALL","1","2","3","4","5","6"].map(b => (
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
          <button onClick={() => { setPan({ x: 0, y: 20 }); setZoom(0.72); }}
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
              const fs = FACTION_STYLE[node.faction];
              const isSel = selected === node.id;
              const isHov = hovered === node.id;
              const dimmed = connectedIds && !connectedIds.has(node.id);
              const R = isSel ? 33 : isHov ? 30 : 25;
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

        {/* Legend */}
        <div style={{
          position: "absolute", bottom: 14, left: 14,
          background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "11px 13px",
        }}>
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
    </div>
  );
}

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
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 10,
            background: `${bookColor}18`, color: bookColor,
            border: `1px solid ${bookColor}33`, fontFamily: "monospace",
          }}>Book {node.book}</span>
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
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 9px", borderRadius: 7, marginBottom: 4,
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${tfs.color}18`, cursor: "pointer",
            }}
            onMouseEnter={ev => ev.currentTarget.style.background = `${tfs.dim}44`}
            onMouseLeave={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.025)"}
          >
            <span style={{ fontSize: 13 }}>{ROLE_EMOJI[targetNode.role]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: tfs.color, fontWeight: 600 }}>{targetNode.label}</div>
              <div style={{ fontSize: 10, color: "#44403c" }}>
                <span style={{ color: es.color }}>{e.label}</span>{" · "}{tfs.label}
              </div>
            </div>
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 8, fontFamily: "monospace",
              background: targetNode.book === 3 ? "rgba(74,222,128,0.1)" : targetNode.book === 2 ? "rgba(167,139,250,0.1)" : "rgba(245,158,11,0.08)",
              color: targetNode.book === 3 ? "#4ade80" : targetNode.book === 2 ? "#a78bfa" : "#78716c",
            }}>B{targetNode.book}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tag({ color, children }) {
  return (
    <span style={{
      fontSize: 9.5, padding: "2px 7px", borderRadius: 12,
      background: `${color}13`, color, border: `1px solid ${color}28`,
    }}>{children}</span>
  );
}
