import { useState, useRef, useEffect, useCallback } from "react";

// ── Palette ────────────────────────────────────────────────────────────────
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
  party:       { color: "#f59e0b", label: "Party" },
  trains:      { color: "#fde68a", label: "Trains/Manages" },
  allied:      { color: "#34d399", label: "Allied" },
  protected:   { color: "#34d399", label: "Protects" },
  killed:      { color: "#f87171", label: "Kills" },
  antagonizes: { color: "#f87171", label: "Antagonizes" },
  hunts:       { color: "#f87171", label: "Hunts" },
  controls:    { color: "#a78bfa", label: "Controls" },
  employs:     { color: "#a78bfa", label: "Employs" },
  manages:     { color: "#60a5fa", label: "PR manages" },
  hosts:       { color: "#60a5fa", label: "Hosts" },
  rescued:     { color: "#34d399", label: "Rescued" },
  companion:   { color: "#f59e0b", label: "Companion" },
  causes:      { color: "#fb923c", label: "Causes event" },
  exgf:        { color: "#94a3b8", label: "Ex-girlfriend of" },
  leads:       { color: "#34d399", label: "Leads" },
  puppet:      { color: "#f87171", label: "Mind-controls" },
  connected:   { color: "#78716c", label: "Connected" },
  quest:       { color: "#fb923c", label: "Quest link" },
  joined:      { color: "#34d399", label: "Joins party" },
  brokers:     { color: "#60a5fa", label: "Brokers deal" },
  coerces:     { color: "#f87171", label: "Coerces" },
  loved:       { color: "#fb923c", label: "Loved (past)" },
};

const ROLE_EMOJI = {
  "Crawler":        "⚔️",
  "Mage":           "🔮",
  "Healer":         "💚",
  "Trickster":      "🃏",
  "Engineer":       "⚙️",
  "Juggernaut":     "🚛",
  "Summoner":       "🌸",
  "Companion":      "🐾",
  "Caretaker":      "🧑‍⚕️",
  "Resident":       "👴",
  "Player Killer":  "🗡️",
  "Boss":           "💀",
  "Show Host":      "📺",
  "Host/Boss":      "👑",
  "PR Agent":       "📣",
  "Admin":          "🖥️",
  "Corp Entity":    "🏢",
  "Elite NPC":      "✨",
  "NPC":            "🧙",
  "Survivor":       "🏃",
  "Pre-Dungeon":    "💔",
};

// ── NODES ──────────────────────────────────────────────────────────────────
const NODES = [
  // ── BOOK 1 PARTY ──
  { id: "carl",       label: "Carl",              book: 1, faction: "PARTY",       role: "Crawler",       x: 500, y: 310,
    desc: "Coast Guard vet, 27. Partners with his ex's cat through the dungeon. Chooses Primal race / Compensated Anarchist class. Specialist in explosives and improvisation. Earns catchphrase 'Goddamnit, Donut.' Becomes political thorn in the Skull Empire's side." },
  { id: "donut",      label: "Princess Donut",    book: 1, faction: "PARTY",       role: "Mage",          x: 360, y: 190,
    desc: "Carl's ex's prize show cat. Absurdly high Charisma. Chooses Former Child Actor class — secretly following Odette's advice, which makes Mordecai her permanent manager. Her crown places her in Blood Sultanate succession. Becomes a galactic celebrity." },
  { id: "mordecai",   label: "Mordecai",          book: 1, faction: "PARTY",       role: "Trickster",     x: 220, y: 310,
    desc: "Racetrack Changeling NPC. Floor 1 guide, becomes manager after Donut's class choice. Shifts to Incubus form on Floor 3. Deeply knowledgeable, keeps secrets. Has complicated history with Odette. Furious (but loyal) about being roped into managing." },
  { id: "mongo",      label: "Mongo",             book: 1, faction: "PARTY",       role: "Companion",     x: 220, y: 160,
    desc: "Donut's velociraptor — chosen as a pet reward at end of Book 1. Looks like a skinless chicken at first. Ferociously loyal. Donut can Clockwork Triplicate him into 3 copies (one real, two mechanical) starting Book 2." },

  // ── BOOK 2 NEW PARTY ──
  { id: "katia",      label: "Katia Grim",        book: 2, faction: "PARTY",       role: "Juggernaut",    x: 640, y: 190,
    desc: "Icelandic art professor. Doppelganger race / Monster Truck Driver class. Constitution spikes with speed. Can shapeshift but struggles with faces. Originally in Hekla's Brynhild's Daughters group. Separated and rescued by Carl. Ten levels behind when she joins, but rapidly catches up." },

  // ── MEADOW LARK (Book 1) ──
  { id: "brandon",    label: "Brandon Andrews",   book: 1, faction: "MEADOWLARK",  role: "Survivor",      x: 750, y: 270,
    desc: "Meadow Lark maintenance worker. Natural leader. Refuses to abandon the elderly. Has a giant magical hammer. Later dies heroically holding off a monster horde." },
  { id: "chris",      label: "Chris Andrews",     book: 1, faction: "MEADOWLARK",  role: "Survivor",      x: 850, y: 340,
    desc: "Brandon's brother. Also maintenance at Meadow Lark. Helps build the Floor 2 wheelchair centipede transport. Survives into Book 2." },
  { id: "imani",      label: "Imani",             book: 1, faction: "MEADOWLARK",  role: "Healer",        x: 760, y: 390,
    desc: "Meadow Lark caretaker. 12 player-kills — claims mercy killings. One of Carl's most trusted allies. Healer class. Also named 'Grace Bautista's anklet' is found by Donut in Book 2 — hinting at a family connection to Bautista." },
  { id: "yolanda",    label: "Yolanda Martinez",  book: 1, faction: "MEADOWLARK",  role: "Caretaker",     x: 870, y: 430,
    desc: "Meadow Lark caretaker. Tries to stop Jack. Shoots Jack (too late). Dies in the Rage Elemental chaos on Floor 2. The guild is later named 'Safehome Yolanda' in her memory." },
  { id: "elle",       label: "Elle McGibbons",    book: 1, faction: "MEADOWLARK",  role: "Resident",      x: 960, y: 270,
    desc: "99-year-old Meadow Lark resident. Hits on Carl. Gets race/class on Floor 3, transforms into a powerful Frost Maiden." },
  { id: "jack",       label: "Jack",              book: 1, faction: "MEADOWLARK",  role: "Resident",      x: 960, y: 380,
    desc: "Elderly resident with dementia. Urinates in the dungeon corridor despite warnings, summoning a Level 93 Rage Elemental. Dies in the aftermath." },
  { id: "agatha",     label: "Agatha",            book: 1, faction: "MEADOWLARK",  role: "Survivor",      x: 860, y: 490,
    desc: "Mysterious homeless woman. Set fire to Meadow Lark's kitchen, inadvertently forcing the evacuation before the Transformation. Descends alone. Her true nature is heavily hinted at in later books." },

  // ── OTHER CRAWLERS (Book 1) ──
  { id: "li_jun",     label: "Li Jun",            book: 1, faction: "CRAWLERS",    role: "Crawler",       x: 500, y: 165,
    desc: "Asian crawler. Trapped on Prince Maestro's show in a life-or-death game. Carl defies Maestro to save the whole group without the Skull Empire's 'help.' Goes on to become a capable fighter in later books." },
  { id: "li_na",      label: "Li Na",             book: 1, faction: "CRAWLERS",    role: "Crawler",       x: 610, y: 130,
    desc: "Crawler in Li Jun's group. Also saved by Carl on Maestro's show. Grows into a strong fighter across the series." },
  { id: "zhang",      label: "Zhang",             book: 1, faction: "CRAWLERS",    role: "Crawler",       x: 720, y: 130,
    desc: "Third member of the Asian crawler group. The group's manager figure. All three are rescued from near-death by Carl's intervention." },

  // ── OTHER CRAWLERS (Book 2) ──
  { id: "hekla",      label: "Hekla",             book: 2, faction: "CRAWLERS",    role: "Crawler",       x: 720, y: 65,
    desc: "Leader of Brynhild's Daughters, a powerful all-female crawler group. Contacts Carl on an interview show asking him to adopt Katia, who was separated from her party. Appears in the leaderboard top 2 at end of Book 2 (ranked #2). Her arc becomes much darker in later books." },
  { id: "lucia",      label: "Lucia Mar",         book: 2, faction: "CRAWLERS",    role: "Crawler",       x: 620, y: 65,
    desc: "Ranked #1 on the leaderboard at end of Book 2. Chose Lajabless race — beautiful by day, skull-faced monster by night. Enters the Desperado Club early and dominates. Places a mark on Carl and Donut's backs during the recap show, signaling future consequences. A complex, major character from Book 2 onward." },
  { id: "quan",       label: "Quan CH",           book: 2, faction: "CRAWLERS",    role: "Crawler",       x: 500, y: 65,
    desc: "A crawler who opens his celestial loot box just before Borant uses their VETO to negate 83 celestial boxes (to avoid bankruptcy). Calls everyone 'fucking assholes' about it. Notable for the timing that saves him from the VETO." },

  // ── ANTAGONISTS (Book 1) ──
  { id: "frank",      label: "Frank Q",           book: 1, faction: "ANTAGONISTS", role: "Player Killer", x: 340, y: 500,
    desc: "Player killer couple with Maggie. Attacks Carl in a safe room. Revealed to be under Maggie's mind control — aware of everything but helpless. Broken after Carl's dynamite trap injures their daughter Yvette." },
  { id: "maggie",     label: "Maggie My",         book: 1, faction: "ANTAGONISTS", role: "Player Killer", x: 220, y: 470,
    desc: "The real threat. Mind-controls Frank Q like a puppet. Strangles their daughter Yvette on live air after Carl's trap injures her. A moment of pure villainy that defines her character." },
  { id: "yvette",     label: "Yvette",            book: 1, faction: "ANTAGONISTS", role: "Pre-Dungeon",   x: 110, y: 510,
    desc: "Frank and Maggie's daughter. Injured by Carl's dynamite trap. Killed by her mother Maggie on live broadcast during Prince Maestro's show." },
  { id: "maestro",    label: "Prince Maestro",    book: 1, faction: "ANTAGONISTS", role: "Host/Boss",     x: 480, y: 490,
    desc: "Second son of the Skull Empire emperor. Hosts Death Watch Extreme Dungeon Mayhem. Carl humiliates him on air. A fake AI video of him goes viral. Holds a dangerous political grudge throughout the series." },

  // ── ANTAGONISTS (Book 2) ──
  { id: "stalwart",   label: "Prince Stalwart",   book: 2, faction: "ANTAGONISTS", role: "Antagonist",    x: 360, y: 590,
    desc: "Maestro's brother. Attempts to bomb Carl and Donut's production trailer from space in retaliation for Carl's anti-Skull Empire speech. Accidentally destroys the trailer of famous pop star Manasa instead, killing her. A galactic incident." },
  { id: "miss_quill", label: "Miss Quill",        book: 2, faction: "ANTAGONISTS", role: "NPC",           x: 600, y: 500,
    desc: "A secretary-disguised necromancer and the true power behind the Over City's government. She's been secretly running the city while the actual Magistrate Featherfall has been dead the whole time. A serial killer responsible for murdering the city's sex workers and dropping their bodies from the sky. Carl detonates dynamite in her doll collection, killing her — which then accidentally triggers the doomsday soul crystal." },

  // ── SYSTEM / BORANT ──
  { id: "borant",     label: "Borant Corp",       book: 1, faction: "SYSTEM",      role: "Corp Entity",   x: 500, y: 670,
    desc: "Alien corporation. Destroyed Earth, runs the dungeon as galactic entertainment. Secretly bankrupt. Under political pressure from the Kua-tin government and the Skull Empire. Uses a VETO in Book 2 to negate 83 celestial boxes to avoid insolvency." },
  { id: "world_ai",   label: "World AI",          book: 1, faction: "SYSTEM",      role: "Admin",         x: 350, y: 660,
    desc: "The dungeon's System AI. Assigns guides, manages loot boxes, enforces rules. Subtly nudges Carl in ways that serve something beyond Borant's interests. Its true agenda becomes more apparent in later books." },
  { id: "zev",        label: "Zev",               book: 1, faction: "SYSTEM",      role: "PR Agent",      x: 660, y: 640,
    desc: "Borant's kua-tin (fish creature) PR agent. Astronaut outfit. Bonds instantly with Donut. Sympathetic to Carl despite working for the enemy. Gets suspended after Carl causes diplomatic chaos, then reassigned." },

  // ── GALACTIC MEDIA ──
  { id: "odette",     label: "Odette",            book: 1, faction: "MEDIA",       role: "Show Host",     x: 230, y: 540,
    desc: "Most famous galactic host. Former crawler who survived to Floor 12, then made a deal to leave. Crab-mantis costume (she looks human underneath). Advises Carl and Donut privately — the secret tip about choosing a class with a manager benefit is hers. Has history with Mordecai." },
  { id: "ripper",     label: "Ripper Wonton",     book: 2, faction: "MEDIA",       role: "Show Host",     x: 130, y: 420,
    desc: "Alien show host on 'The Danger Zone,' a Borant broadcast. Described as a fuzzy wombat-Ewok hybrid. Carl and Donut appear on his show in Book 2. Carl uses the appearance to deliver inflammatory anti-Skull Empire rhetoric." },
  { id: "manasa",     label: "Manasa",            book: 2, faction: "MEDIA",       role: "Pre-Dungeon",   x: 120, y: 560,
    desc: "Famous galactic pop star. Her production trailer is accidentally destroyed by Prince Stalwart's orbital strike — Stalwart thought Carl and Donut were inside. Manasa's death becomes a massive galactic incident." },

  // ── DUNGEON NPCs / ELITES (Book 2) ──
  { id: "signet",     label: "Tsarina Signet",    book: 2, faction: "NPCS",        role: "Elite NPC",     x: 360, y: 380,
    desc: "Half Naiad, half High Elf Elite NPC. Naked, covered in living tattoos she can summon as ink elementals. Stars in the dungeon drama 'Vengeance of the Daughter.' Tries to manipulate Carl into dying for her quest. Carl outmaneuvers her by negotiating with the show's producers. Deeply loves Grimaldi." },
  { id: "grimaldi",   label: "Grimaldi",          book: 2, faction: "NPCS",        role: "Boss",          x: 250, y: 410,
    desc: "Ringmaster of the traveling circus. A Pestiferous Fae who was transformed into a parasitic vine monster (Scolopendra) that infests people with worms, turning them into undead. Loves Signet and prizes family. Carl negotiates with the producers to resolve the quest by poisoning himself to commune with Grimaldi." },
  { id: "featherfall",label: "Magistrate Featherfall", book: 2, faction: "NPCS",  role: "NPC",           x: 740, y: 490,
    desc: "The nominal ruler of the Over City on Floor 3. Revealed to have been dead the whole time — a mummified corpse in his office. Miss Quill had been running the city in his name. Carl is declared the new Magistrate after Quill's death." },
  { id: "gumgum",     label: "GumGum",            book: 2, faction: "NPCS",        role: "NPC",           x: 660, y: 440,
    desc: "A dungeon NPC from the skyfowl settlement who approaches Carl and Donut in the Desperado Club and triggers the murder-mystery quest. Found dead with two letters on her body — a city guard pass and a blood-covered necromancy letter. Her death hooks Carl and Donut into the main Book 2 plot." },
  { id: "heather",    label: "Heather the Bear",  book: 2, faction: "NPCS",        role: "Boss",          x: 150, y: 360,
    desc: "A haunted bear from Grimaldi's circus, infested with parasites and suffering. Signet wants Carl to kill her as a sacrifice. Carl kills her, but mercifully — first burning away the parasites with Fireball of Custard, then putting her out of her misery. This act of compassion allows Signet to complete her spell." },
  { id: "samantha",   label: "Samantha",          book: 1, faction: "NPCS",        role: "NPC",           x: 240, y: 650,
    desc: "A dungeon NPC shopkeeper. Darkly comic. Trades gear and information for a price. Present on multiple floors." },

  // ── PRE-DUNGEON / BACKSTORY ──
  { id: "beatrice",   label: "Beatrice",          book: 1, faction: "BACKSTORY",   role: "Pre-Dungeon",   x: 110, y: 200,
    desc: "Carl's ex-girlfriend, Donut's original owner. Broke up with Carl before the Transformation. Carl was still with her cat when the dungeon opened. Presumed dead. Her absence shapes Carl's fierce protectiveness toward Donut." },
];

// ── EDGES ──────────────────────────────────────────────────────────────────
const EDGES = [
  // Core party
  { from: "carl",      to: "donut",       type: "party",       label: "partners with" },
  { from: "mordecai",  to: "carl",        type: "trains",      label: "trains/guides" },
  { from: "mordecai",  to: "donut",       type: "trains",      label: "manages" },
  { from: "donut",     to: "mongo",       type: "companion",   label: "tames" },
  { from: "beatrice",  to: "donut",       type: "exgf",        label: "original owner" },
  { from: "beatrice",  to: "carl",        type: "exgf",        label: "ex-girlfriend" },
  { from: "katia",     to: "carl",        type: "joined",      label: "joins party" },
  { from: "katia",     to: "donut",       type: "joined",      label: "joins party" },
  { from: "hekla",     to: "carl",        type: "brokers",     label: "asks to adopt Katia" },
  { from: "hekla",     to: "katia",       type: "connected",   label: "former party leader" },

  // Carl + Meadow Lark
  { from: "carl",      to: "brandon",     type: "allied",      label: "allies with" },
  { from: "carl",      to: "imani",       type: "allied",      label: "allies with" },
  { from: "carl",      to: "agatha",      type: "allied",      label: "allies with" },
  { from: "brandon",   to: "elle",        type: "protected",   label: "protects" },
  { from: "brandon",   to: "jack",        type: "leads",       label: "leads group" },
  { from: "imani",     to: "brandon",     type: "allied",      label: "works alongside" },
  { from: "chris",     to: "brandon",     type: "allied",      label: "brother/partner" },
  { from: "yolanda",   to: "jack",        type: "causes",      label: "tries to stop/shoots" },
  { from: "jack",      to: "yolanda",     type: "causes",      label: "triggers elemental → kills" },

  // Carl + other crawlers (B1)
  { from: "carl",      to: "li_jun",      type: "rescued",     label: "rescues on show" },
  { from: "carl",      to: "li_na",       type: "rescued",     label: "rescues on show" },
  { from: "carl",      to: "zhang",       type: "rescued",     label: "rescues on show" },

  // Antagonists (B1)
  { from: "maggie",    to: "frank",       type: "puppet",      label: "mind-controls" },
  { from: "frank",     to: "carl",        type: "hunts",       label: "attacks" },
  { from: "maggie",    to: "carl",        type: "antagonizes", label: "antagonizes" },
  { from: "carl",      to: "frank",       type: "causes",      label: "dynamite trap" },
  { from: "maggie",    to: "yvette",      type: "killed",      label: "strangles on air" },
  { from: "carl",      to: "maestro",     type: "antagonizes", label: "humiliates on air" },
  { from: "maestro",   to: "carl",        type: "antagonizes", label: "political grudge" },
  { from: "maestro",   to: "li_jun",      type: "antagonizes", label: "traps on show" },

  // Antagonists (B2)
  { from: "carl",      to: "stalwart",    type: "antagonizes", label: "provokes rebellion speech" },
  { from: "stalwart",  to: "carl",        type: "antagonizes", label: "orbital strike attempt" },
  { from: "stalwart",  to: "manasa",      type: "killed",      label: "accidentally destroys trailer" },
  { from: "stalwart",  to: "maestro",     type: "connected",   label: "brother" },
  { from: "carl",      to: "miss_quill",  type: "kills",       label: "dynamite trap kills" },
  { from: "miss_quill",to: "featherfall", type: "connected",   label: "ruled in his name (dead)" },
  { from: "miss_quill",to: "gumgum",      type: "killed",      label: "implicated in death" },

  // NPCs (B2)
  { from: "signet",    to: "carl",        type: "coerces",     label: "kidnaps Donut / coerces" },
  { from: "signet",    to: "grimaldi",    type: "loved",       label: "loves" },
  { from: "carl",      to: "signet",      type: "quest",       label: "resolves quest" },
  { from: "carl",      to: "grimaldi",    type: "quest",       label: "poisons self to negotiate" },
  { from: "carl",      to: "heather",     type: "kills",       label: "mercy kill" },
  { from: "signet",    to: "heather",     type: "coerces",     label: "demands sacrifice" },
  { from: "grimaldi",  to: "heather",     type: "connected",   label: "circus leader" },
  { from: "gumgum",    to: "carl",        type: "quest",       label: "triggers murder quest" },
  { from: "carl",      to: "featherfall", type: "connected",   label: "declared new Magistrate" },

  // System
  { from: "borant",    to: "world_ai",    type: "controls",    label: "runs" },
  { from: "borant",    to: "zev",         type: "employs",     label: "employs" },
  { from: "borant",    to: "maestro",     type: "connected",   label: "Skull Empire deal" },
  { from: "zev",       to: "carl",        type: "manages",     label: "PR manages" },
  { from: "zev",       to: "donut",       type: "manages",     label: "bonds with" },
  { from: "world_ai",  to: "carl",        type: "connected",   label: "cryptic messages" },
  { from: "world_ai",  to: "mordecai",    type: "connected",   label: "assigned guide" },

  // Media
  { from: "odette",    to: "carl",        type: "hosts",       label: "interviews/warns" },
  { from: "odette",    to: "donut",       type: "hosts",       label: "secret advice" },
  { from: "mordecai",  to: "odette",      type: "connected",   label: "prior history" },
  { from: "ripper",    to: "carl",        type: "hosts",       label: "hosts on Danger Zone" },
  { from: "borant",    to: "ripper",      type: "employs",     label: "employs" },
  { from: "lucia",     to: "carl",        type: "antagonizes", label: "marks Carl & Donut" },
];

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

const BOOK_FILTER_OPTIONS = ["ALL", "1", "2"];

export default function DCCBooks12Dag() {
  const svgRef = useRef(null);
  const [positions, setPositions] = useState(() => {
    const m = {};
    NODES.forEach(n => { m[n.id] = { x: n.x, y: n.y }; });
    return m;
  });
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 20 });
  const [zoom, setZoom] = useState(0.82);
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
    setZoom(z => Math.min(2.5, Math.max(0.25, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const book2Count = NODES.filter(n => n.book === 2).length;

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
          <span style={{ marginLeft: 10, fontSize: 11, color: "#57534e" }}>Books 1–2 · Character DAG · {NODES.length} characters · {EDGES.length} edges</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Book filter */}
          <div style={{ display: "flex", gap: 3 }}>
            {BOOK_FILTER_OPTIONS.map(b => (
              <button key={b} onClick={() => { setFilterBook(b); setSelected(null); }}
                style={{
                  background: filterBook === b ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)",
                  border: filterBook === b ? "1px solid rgba(245,158,11,0.6)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: filterBook === b ? "#f59e0b" : "#78716c",
                  padding: "4px 10px", fontSize: 12, cursor: "pointer",
                }}>
                {b === "ALL" ? "Both Books" : `Book ${b}`}
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
          <button onClick={() => { setPan({ x: 0, y: 20 }); setZoom(0.82); }}
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

      {/* Canvas + Sidebar */}
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

            {/* Edges */}
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

            {/* Nodes */}
            {visibleNodes.map(node => {
              const pos = positions[node.id];
              const fs = FACTION_STYLE[node.faction];
              const isSel = selected === node.id;
              const isHov = hovered === node.id;
              const dimmed = connectedIds && !connectedIds.has(node.id);
              const isBook2 = node.book === 2;
              const R = isSel ? 33 : isHov ? 30 : 25;

              return (
                <g key={node.id} transform={`translate(${pos.x},${pos.y})`}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); setSelected(isSel ? null : node.id); }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Book 2 pulse ring */}
                  {isBook2 && !dimmed && (
                    <circle r={R + 5} fill="none" stroke={fs.color}
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
                    fill={fs.color} opacity={dimmed ? 0.08 : isBook2 ? 0.7 : 0.3}
                    fontWeight={isBook2 ? "700" : "400"}
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
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color, boxShadow: `0 0 4px ${v.color}55` }} />
              <span style={{ fontSize: 10, color: "#a8a29e" }}>{v.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 18, height: 14, borderRadius: "50%", border: "1px dashed #a78bfa", opacity: 0.6 }} />
              <span style={{ fontSize: 9.5, color: "#78716c" }}>Dashed ring = Book 2 character</span>
            </div>
          </div>
          <div style={{ fontSize: 8, color: "#2d2926", marginTop: 5 }}>Click faction to filter</div>
        </div>

        {/* Zoom */}
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

  return (
    <div style={{ padding: 20, height: "100%", overflowY: "auto" }}>
      <div style={{ paddingBottom: 15, borderBottom: `1px solid ${fs.color}22`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 26 }}>{ROLE_EMOJI[node.role] || "●"}</span>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 10,
            background: node.book === 2 ? "rgba(167,139,250,0.15)" : "rgba(245,158,11,0.1)",
            color: node.book === 2 ? "#a78bfa" : "#f59e0b",
            border: node.book === 2 ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(245,158,11,0.3)",
            fontFamily: "monospace",
          }}>
            Book {node.book}
          </span>
        </div>
        <h2 style={{ margin: "0 0 7px", fontSize: 19, color: fs.color, textShadow: `0 0 16px ${fs.color}44`, lineHeight: 1.2 }}>
          {node.label}
        </h2>
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
              fontSize: 9, padding: "1px 5px", borderRadius: 8,
              background: targetNode.book === 2 ? "rgba(167,139,250,0.1)" : "rgba(245,158,11,0.08)",
              color: targetNode.book === 2 ? "#a78bfa" : "#78716c",
              fontFamily: "monospace",
            }}>
              B{targetNode.book}
            </span>
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
      letterSpacing: "0.04em",
    }}>
      {children}
    </span>
  );
}
