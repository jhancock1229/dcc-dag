import { useState, useRef, useEffect, useCallback } from "react";

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
  "Medic": "🏥",
};

const NODES = [
  // ── BOOK 1 PARTY ──
  { id: "carl", label: "Carl", book: 1, faction: "PARTY", role: "Crawler", x: 500, y: 310,
    desc: "Coast Guard vet, 27. Partners with his ex's cat through the dungeon. Chooses Primal race / Compensated Anarchist class. Specialist in explosives and improvisation. Earns catchphrase 'Goddamnit, Donut.' Political thorn in Borant's side. Discovers the Dungeon Anarchist's Cookbook on Floor 4 — a secret artifact passed between crawlers across seasons." },
  { id: "donut", label: "Princess Donut", book: 1, faction: "PARTY", role: "Mage", x: 360, y: 190,
    desc: "Carl's ex's prize show cat. Absurdly high Charisma. Former Child Actor class. Her crown places her in Blood Sultanate succession. Becomes a galactic celebrity. On Floor 4 she begins maturing into a real strategist." },
  { id: "mordecai", label: "Mordecai", book: 1, faction: "PARTY", role: "Trickster", x: 220, y: 310,
    desc: "Racetrack Changeling NPC, incubus form on Floor 3. Becomes Donut's manager. Deeply knowledgeable, keeps secrets. Gets banished from the Dungeon for days on Floor 4 after attacking the fan-box presenter who has a history with him." },
  { id: "mongo", label: "Mongo", book: 1, faction: "PARTY", role: "Companion", x: 220, y: 160,
    desc: "Donut's velociraptor. Ferociously loyal. Donut can Clockwork Triplicate him into 3 copies from Book 2 onward." },
  // ── BOOK 2 PARTY ──
  { id: "katia", label: "Katia Grim", book: 2, faction: "PARTY", role: "Juggernaut", x: 640, y: 190,
    desc: "Icelandic art professor. Doppelganger / Monster Truck Driver class. Joins in Book 2, ten levels behind but catches up fast. In Book 3 she becomes a popular and capable crawler in her own right — Carl exploits her race and class creatively to give her a steel-loaded backpack she can morph into armor. Eventually leads Team Katia." },
  // ── BOOK 1 MEADOW LARK ──
  { id: "brandon", label: "Brandon Andrews", book: 1, faction: "MEADOWLARK", role: "Survivor", x: 750, y: 270,
    desc: "Meadow Lark maintenance worker. Natural leader. Giant magical hammer. Dies heroically holding off a monster horde." },
  { id: "chris", label: "Chris Andrews", book: 1, faction: "MEADOWLARK", role: "Survivor", x: 850, y: 340,
    desc: "Brandon's brother. Survives into Book 3. Odette cryptically tries to warn Carl about him mid-Floor 4, but is muted by the system before she can finish." },
  { id: "imani", label: "Imani", book: 1, faction: "MEADOWLARK", role: "Healer", x: 760, y: 390,
    desc: "Meadow Lark caretaker, healer class. 12 player-kills (claims mercy killings). One of Carl's most trusted allies. Helps plan and execute the major Floor 5 operation alongside Carl." },
  { id: "yolanda", label: "Yolanda Martinez", book: 1, faction: "MEADOWLARK", role: "Caretaker", x: 870, y: 430,
    desc: "Meadow Lark caretaker. Tries to stop Jack. Dies in the Rage Elemental chaos. The guild 'Safehome Yolanda' is named in her memory." },
  { id: "elle", label: "Elle McGibbons", book: 1, faction: "MEADOWLARK", role: "Resident", x: 960, y: 270,
    desc: "99-year-old Meadow Lark resident. Hits on Carl. Transforms into the powerful Frost Maiden on Floor 3. By Book 3 she tries out new catchphrases, landing on 'Stay Frosty.'" },
  { id: "jack", label: "Jack", book: 1, faction: "MEADOWLARK", role: "Resident", x: 960, y: 380,
    desc: "Elderly resident with dementia. Urinates in the dungeon corridor, summoning a Level 93 Rage Elemental. Dies in the aftermath." },
  { id: "agatha", label: "Agatha", book: 1, faction: "MEADOWLARK", role: "Survivor", x: 860, y: 490,
    desc: "Mysterious homeless woman. Set fire to Meadow Lark's kitchen, forcing the evacuation. Descends alone. Her true nature heavily hinted in later books." },
  // ── BOOK 1 OTHER CRAWLERS ──
  { id: "li_jun", label: "Li Jun", book: 1, faction: "CRAWLERS", role: "Crawler", x: 500, y: 165,
    desc: "Asian crawler. Rescued by Carl from Prince Maestro's death show. Goes on to become a capable fighter." },
  { id: "li_na", label: "Li Na", book: 1, faction: "CRAWLERS", role: "Crawler", x: 610, y: 130,
    desc: "Crawler in Li Jun's group. Saved by Carl. Grows into a strong fighter. Named as a signatory on Carl's Floor 5 battle plan in the Cookbook." },
  { id: "zhang", label: "Zhang", book: 1, faction: "CRAWLERS", role: "Crawler", x: 720, y: 130,
    desc: "Third member of the Asian crawler group. Group's manager figure. All three rescued from near-death by Carl." },
  // ── BOOK 2 CRAWLERS ──
  { id: "hekla", label: "Hekla", book: 2, faction: "CRAWLERS", role: "Crawler", x: 720, y: 65,
    desc: "Leader of Brynhild's Daughters, top-2 leaderboard at end of Book 2. Contacts Carl to hand off Katia. In Book 3 her husband is shown dying from a cactus mob. Her arc grows darker — Odette warns Carl about her but is muted before finishing. Her true agenda with Katia becomes clear in later books." },
  { id: "lucia", label: "Lucia Mar", book: 2, faction: "CRAWLERS", role: "Crawler", x: 620, y: 65,
    desc: "#1 leaderboard at end of Book 2. Lajabless race — beautiful by day, skull-faced by night. By Book 3 she is clearly overpowered; Mordecai suspects she accepted a deal to erase how she killed two admins. Kills Ifechi (Florin's partner) in a spell-reflection trap on Floor 4." },
  { id: "quan", label: "Quan CH", book: 2, faction: "CRAWLERS", role: "Crawler", x: 500, y: 65,
    desc: "Opened his celestial box before Borant's VETO in Book 2. In Book 3 he has a celestial item granting flight, lightning bolts, and a full damage shield. Tries to interfere with Carl's Floor 4 endgame plan involving the god-puppy Orthrus. Carl cuts off his arm to prevent divine retribution and Quan retreats through the stairwell." },
  // ── BOOK 3 NEW CRAWLERS ──
  { id: "miriam", label: "Miriam Dom", book: 3, faction: "CRAWLERS", role: "Shepherd", x: 420, y: 50,
    desc: "Italian goat farmer, Shepherd class. Entered with 15 boer goats — herded them through the first two floors. Becomes a top-10 crawler. Turned vampire in Book 3's Floor 4. Despite being vegetarian, she refuses to drink her goats' blood (the dungeon finds this hilarious). Deep maternal bond with Prepotente. Sacrifices herself at dawn on Floor 5 to free Prepotente from the Ring of Divine Suffering debuff — her death cures all vampires on the floor." },
  { id: "prepotente", label: "Prepotente", book: 3, faction: "CRAWLERS", role: "Aerialist", x: 310, y: 50,
    desc: "Miriam's beloved goat, transformed into a bipedal Caprid / Forsaken Aerialist by a pet biscuit on Floor 3. Name means 'arrogant and bossy' in Italian — accurate. Screams constantly and for no apparent reason. Starts out as a weird jerk, matures greatly. Terrifyingly smart underneath the chaos. After Miriam's death he's essentially unmoored and borderline dangerous. Eventually develops a frenemy relationship with Carl." },
  { id: "florin", label: "Florin", book: 3, faction: "CRAWLERS", role: "Crawler", x: 840, y: 60,
    desc: "Crawler from France who spent time in Africa, speaks with an Australian accent. Ex-mercenary. Partners with Ifechi early. In Book 3 on Floor 4, Lucia Mar uses a spell-reflection trap that causes all of Florin's shotgun blasts to bounce onto Ifechi, killing her. He's effectively framed for it. Joins Team Katia later. An all-loving hero who recognizes what's happening to Lucia and tries to help her." },
  { id: "ifechi", label: "Ifechi", book: 3, faction: "CRAWLERS", role: "Medic", x: 950, y: 120,
    desc: "Red Cross medic. Bonds deeply with Florin. They partner through the first four floors. Killed on Floor 4 by Lucia Mar's spell-reflection trap — Florin gets the kill credit. Has an identical sister who appears as a boss elsewhere. Her death sends Florin into a long collapse." },
  { id: "louis", label: "Louis", book: 3, faction: "CRAWLERS", role: "Crawler", x: 950, y: 200,
    desc: "Overweight, balding American. Drove his modified convertible Chevy Astro van into the dungeon when the staircase appeared, earning the Cloud of Exhaust spell (puts mobs to sleep). Has the same powerful spell as Miriam but kept running from fights. First meets Royal Court on Floor 5. Becomes Team Katia's ace pilot. Deeply genuine — Juice Box (his eventual love) loves him for having zero pretense." },
  { id: "firas", label: "Firas", book: 3, faction: "CRAWLERS", role: "Crawler", x: 1050, y: 160,
    desc: "Louis's best friend. The two spend the first five floors together. After Floor 5 they get outrageously drunk in a bar, figuring they're done for. Joins Team Katia. Killed in the Floor 6 battle against Queen Imogen by a lightning spell. Louis takes it extremely hard." },
  { id: "gwendolyn", label: "Gwendolyn Duet", book: 3, faction: "CRAWLERS", role: "Crawler", x: 1060, y: 310,
    desc: "Crawler who calls out Ronaldo on the group chat: 'The bomber guy warned all of you dumbasses. Fall back to the train lines. Hold them at the choke points.' Practical, no-nonsense. Part of the wider crawler coalition on Floor 4." },
  { id: "ronaldo", label: "Ronaldo Qu", book: 3, faction: "CRAWLERS", role: "Crawler", x: 1060, y: 400,
    desc: "Crawler involved in the Floor 4 endgame. Argues with Gwendolyn in group chat about whether Carl's warnings were clear enough. No relation to Quan CH." },
  { id: "bautista", label: "Daniel Bautista", book: 3, faction: "CRAWLERS", role: "Crawler", x: 840, y: 180,
    desc: "Crawler. Carl thinks he looks like a Thundercat after his race transformation. Lost his entire family in the Transformation. Donut finds an anklet belonging to Grace Bautista in Book 2 — hinting at a family connection. Develops a romantic relationship with Katia on Floor 6. Part of Team Katia." },
  // ── BOOK 1 ANTAGONISTS ──
  { id: "frank", label: "Frank Q", book: 1, faction: "ANTAGONISTS", role: "Player Killer", x: 340, y: 500,
    desc: "Player killer under Maggie's mind control. Aware of everything but helpless. By Book 3, Maggie is revealed to be blackmailed by a backer who threatens her supposedly-dead family." },
  { id: "maggie", label: "Maggie My", book: 1, faction: "ANTAGONISTS", role: "Player Killer", x: 220, y: 470,
    desc: "Mind-controls Frank as a puppet. Strangles Yvette on live air. In Book 3, revealed to be trapped — a backer threatens her dead family members with transfiguration into killable monsters. She seems exhausted and resigned by her final encounter with Carl." },
  { id: "yvette", label: "Yvette", book: 1, faction: "ANTAGONISTS", role: "Pre-Dungeon", x: 110, y: 510,
    desc: "Frank and Maggie's daughter. Killed by Maggie on live broadcast." },
  { id: "maestro", label: "Prince Maestro", book: 1, faction: "ANTAGONISTS", role: "Host/Boss", x: 480, y: 490,
    desc: "Skull Empire host. Humiliated by Carl on air. Holds a dangerous grudge throughout the series." },
  // ── BOOK 2 ANTAGONISTS ──
  { id: "stalwart", label: "Prince Stalwart", book: 2, faction: "ANTAGONISTS", role: "Antagonist", x: 360, y: 590,
    desc: "Maestro's brother. Orbital strike attempt accidentally kills pop star Manasa instead of Carl and Donut." },
  { id: "miss_quill", label: "Miss Quill", book: 2, faction: "ANTAGONISTS", role: "NPC", x: 600, y: 500,
    desc: "Necromancer secretly running the Over City. Killed by Carl's dynamite trap, triggering the doomsday soul crystal." },
  // ── BOOK 3 ANTAGONISTS ──
  { id: "loita", label: "Loita", book: 3, faction: "ANTAGONISTS", role: "Antagonist", x: 220, y: 580,
    desc: "Devout kua-tin. Replaces Zev as Carl & Donut's PR agent on Floor 4. Openly xenophobic — tells Carl that humans are a cancer and Earth should have simply been destroyed. Insists on adding a self-destruct system to the Robot Donut merchandise toys, over Carl's protests. Carl rigs one to kill her and makes it look like an accident. A Syndicate liaison suspects but can't prove it." },
  // ── SYSTEM / BORANT ──
  { id: "borant", label: "Borant Corp", book: 1, faction: "SYSTEM", role: "Corp Entity", x: 500, y: 670,
    desc: "Alien corporation. Destroyed Earth, runs the dungeon. Secretly bankrupt. Uses its one VETO to negate 83 celestial boxes in Book 2. In Book 3, is clearly desperate — offering Carl a legendary box upgrade in exchange for the source of his Loita-killing knowledge. Carl refuses." },
  { id: "world_ai", label: "World AI", book: 1, faction: "SYSTEM", role: "Admin", x: 350, y: 660,
    desc: "The dungeon's System AI. Assigns guides, manages loot. On Floor 4, awards Carl a fan-sponsored box containing the Dungeon Anarchist's Cookbook. Its subtle interventions suggest an agenda beyond Borant's interests." },
  { id: "zev", label: "Zev", book: 1, faction: "SYSTEM", role: "PR Agent", x: 660, y: 640,
    desc: "Borant's kua-tin PR agent. Sympathetic. Replaced by Loita on Floor 4. His replacement signals a more hostile phase of Borant's management of Carl and Donut." },
  // ── GALACTIC MEDIA ──
  { id: "odette", label: "Odette", book: 1, faction: "MEDIA", role: "Show Host", x: 130, y: 440,
    desc: "Most famous galactic host. Former crawler. Has history with Mordecai. In Book 3, she tries to warn Carl about Chris Andrews mid-interview but is muted by the system before she can finish. Also censored when discussing Hekla's death." },
  { id: "ripper", label: "Ripper Wonton", book: 2, faction: "MEDIA", role: "Show Host", x: 80, y: 360,
    desc: "Alien show host on 'The Danger Zone.' Described as a fuzzy wombat-Ewok hybrid. Carl and Donut appear on his show in Book 2 to deliver inflammatory anti-Skull Empire speech." },
  { id: "manasa", label: "Manasa", book: 2, faction: "MEDIA", role: "Pre-Dungeon", x: 80, y: 530,
    desc: "Famous galactic pop star. Her production trailer accidentally destroyed by Prince Stalwart's orbital strike." },
  { id: "mexx", label: "Mexx-6000", book: 3, faction: "MEDIA", role: "Admin", x: 130, y: 310,
    desc: "A Syndicate AI or technical liaison. Meets with Carl in the production trailer on Floor 4 to explain why his crawler powers work in that space. When Carl can't follow the explanation, she offers to translate into 'earth monkey speak.' Represents the Syndicate's production infrastructure." },
  // ── BOOK 2 DUNGEON NPCs ──
  { id: "signet", label: "Tsarina Signet", book: 2, faction: "NPCS", role: "Elite NPC", x: 360, y: 380,
    desc: "Half Naiad/Elf Elite NPC. Stars in 'Vengeance of the Daughter.' Kidnaps Donut to coerce Carl. Carl outmaneuvers her via the show's producers. In Book 3, she becomes aware of her own NPC status and ultimately sacrifices herself on Floor 5 to break Diwata's peace seal, enabling the crawlers to fight." },
  { id: "grimaldi", label: "Grimaldi", book: 2, faction: "NPCS", role: "Boss", x: 250, y: 410,
    desc: "Pestiferous Fae turned parasitic vine circus ringmaster. Loves Signet. Carl negotiates with producers to resolve the quest by poisoning himself to commune with him." },
  { id: "featherfall", label: "Magistrate Featherfall", book: 2, faction: "NPCS", role: "NPC", x: 740, y: 490,
    desc: "Nominal ruler of the Over City. Revealed to have been dead the whole time — mummified in his office while Miss Quill ran the city. Carl is declared the new Magistrate after Quill's death." },
  { id: "gumgum", label: "GumGum", book: 2, faction: "NPCS", role: "NPC", x: 660, y: 440,
    desc: "Skyfowl NPC. Approaches Carl and Donut in the Desperado Club, triggering the murder-mystery quest. Found dead with a guard pass and a blood-covered necromancy letter." },
  { id: "heather", label: "Heather the Bear", book: 2, faction: "NPCS", role: "Boss", x: 150, y: 360,
    desc: "Haunted, parasite-infested bear from Grimaldi's circus. Carl mercy-kills her — burning the parasites away first — enabling Signet to complete her spell." },
  { id: "samantha", label: "Samantha", book: 4, faction: "NPCS", role: "Deity", x: 240, y: 650,
    desc: "Withering Spirit Psamathe — banished minor deity of unrequited love. Inhabits a decapitated latex sex doll head found in Carl's inventory. Vulgar, loud, and shockingly perceptive. Her daughter Mrs. Ghazi is a sand ooze Floor 5 Borough Boss. Joins Royal Court on Floor 5 after Carl pokes her teeth. Plans to find a real body and reunite with her king on the 12th floor." },
  // ── BOOK 3 NPCs (continued) ──
  { id: "chaco", label: "Chaco the Bard", book: 3, faction: "NPCS", role: "Show Host", x: 550, y: 670,
    desc: "Former crawler from Mordecai's season. Now hosts The Prize Carousel dungeon minigame — winged, wolf-headed man in a checkered leisure suit. Killed Mordecai's brother Uzzi on Odette's instruction to get the floor key before the timer ran out. Mordecai attacks him on sight in Book 3 (earning a 7-day safe-room time-out). Deeply remorseful but bound to silence. His warning to Carl: 'They always make you turn on your party.'" },
  // ── BOOK 4 NEW NODES ──
  { id: "juice_box", label: "Juice Box", book: 4, faction: "NPCS", role: "NPC", x: 120, y: 700,
    desc: "Changeling NPC prostitute at Hump Town's inn on Floor 5. Henrik's sister. Deeply loyal to her changeling family. Becomes a critical ally to Carl and the Royal Court — helps save Hump Town from bombardment. Later goes to Floor 9 as an aquatic form to rally NPC factions. Eventually co-warlord of the NPC faction. Gets engaged to Louis." },
  { id: "henrik", label: "Henrik", book: 4, faction: "NPCS", role: "NPC", x: 50, y: 700,
    desc: "Changeling and Juice Box's brother. Holds one of the three pocket-watch pieces of the Gate of the Feral Gods artifact. Carl must retrieve his piece to assemble the Gate." },
  { id: "mrs_ghazi", label: "Mrs. Ghazi", book: 4, faction: "NPCS", role: "Boss", x: 360, y: 750,
    desc: "Samantha's daughter and a sand ooze Floor 5 Borough Boss (Level 52). Created by Samantha's union with King Blaine. Devoted protector. Samantha believes she was killed in the bubble's acid, which causes Samantha to offer her daughter's organs to save Louis — but Mrs. Ghazi likely survived to Floor 9." },
  // Book 4 deities
  { id: "orthrus", label: "Orthrus", book: 4, faction: "SYSTEM", role: "Deity", x: 420, y: 750,
    desc: "A feral god who turns out to be a massive puppy — not the terrifying beast everyone feared. Summoned when Carl and Katia are forced to use the Gate of the Feral Gods to escape the ocean floor. Gentle and confused rather than malevolent. Carl bonds with him and works to keep him safe from his enraged divine father Emberus." },
  { id: "emberus", label: "Emberus", book: 4, faction: "ANTAGONISTS", role: "Deity", x: 120, y: 580,
    desc: "Angry and cruel god. Father of Orthrus's deceased owner. Arrives on Floor 5 to reclaim Orthrus after Carl summons him via the Gate, threatening thousands of crawlers. Carl uses Donut's Meathook scroll to lure Orthrus to Emberus, resolving the crisis — but Samantha may have been involved in killing Geyrun, which complicates things with him." },
  { id: "algos", label: "Algos", book: 4, faction: "ANTAGONISTS", role: "Deity", x: 60, y: 490,
    desc: "Ancient god of pain. Maggie My (possessing Chris) attempts to summon Algos using a Celestial Grenade during a Floor 5 confrontation. Katia petrifies the possessed Chris and Donut drops him into the Subterranean quadrant to prevent the summoning." },
  { id: "denise", label: "Denise", book: 4, faction: "ANTAGONISTS", role: "Boss", x: 120, y: 490,
    desc: "Feral goose goddess — Air castle boss on Floor 5. Completely immune to direct attacks. Carl defeats her by jamming her into the kitchen sink's garbage disposal grinder, since she is immune to attacks but not to the environment." },
  { id: "commandant_kane", label: "Commandant Kane", book: 4, faction: "ANTAGONISTS", role: "Boss", x: 50, y: 590,
    desc: "Holds one of the three Gate of the Feral Gods pocket-watch pieces. Carl must defeat or retrieve the piece from him to assemble the complete artifact." },
  // ── BOOK 3 DUNGEON NPCs ──
  { id: "growler_gary", label: "Growler Gary", book: 3, faction: "NPCS", role: "NPC", x: 430, y: 670,
    desc: "Gnoll bartender at a Floor 4 safe room called The Downward Dog. Refers to himself exclusively in third person ('Growler Gary thinks...') — except in very serious moments when he says 'I,' which signals the conversation has become genuinely grave." },
  // ── BOOK 4 NEW CRAWLERS ──
  { id: "tserendolgor", label: "Tserendolgor (Ren)", book: 4, faction: "CRAWLERS", role: "Crawler", x: 1160, y: 270,
    desc: "Mongolian former runway model turned flamethrower-wielding Dog Soldier. Race: Dog Soldier. Class: Crisper. Wields an enchanted flamethrower named 'Velma.' Enters the dungeon to rescue friends and family. Donut constantly harasses her over her dog-themed race. Allied with Meadow Lark on Floor 4. On Floor 5, Emberus mistakes her bubble for Orthrus — he pounds on the wall screaming while her entire world melts. Survives. Dies on Floor 8, donating her gear and pet Garret (a Tummy Acher) to Carl. Her sacrifice becomes a symbol: 'You're more than just a person. You're our hope.'" },
  // ── BOOK 4 SYSTEM/SYNDICATE ──
  { id: "orren", label: "Orren", book: 4, faction: "SYSTEM", role: "Admin", x: 600, y: 720,
    desc: "Syndicate Liaison — a Gondii parasitic worm inhabiting a fishbowl of liquid mounted on a mechanical body. Carl's 'vice principal.' First appears investigating Loita's death on Floor 5, constructing an elaborate (mostly accurate) picture of Carl's guilt. Manages negotiations between Borant, the System AI, and crawlers. Negotiates the Gate of the Feral Gods handover deal. Morally complicated — liaisons are required to be independent of their race, and Orren takes it seriously." },
  { id: "quasar", label: "Quasar", book: 4, faction: "SYSTEM", role: "Admin", x: 700, y: 720,
    desc: "Carl's Nullian lawyer — looks like a stereotypical Area 51 alien (gray, large eyes, bulbous head) in a tan suit with a hula girl tie. Nullians are rare in Syndicate space. Immediately annoying to Orren. Negotiates Carl's deal with Orren for the Gate of the Feral Gods, securing mercenary bodyguards and the Zerzura spell in exchange. Informs Carl that crawlers become full Syndicate citizens at Floor 10." },
  // ── BOOK 4 NPC BODYGUARDS (Desperado Club) ──
  { id: "sledge", label: "The Sledge", book: 4, faction: "NPCS", role: "NPC", x: 310, y: 730,
    desc: "7-foot Cretin bodyguard in a tuxedo at the Desperado Club. Donut's personal favorite. Close friends with Bomo. Hired as permanent Royal Court security after failing to stop an assassination attempt on Donut (Carl requested them instead of retribution). Buys a magic protection spell with his own money specifically to protect Donut. On Floor 6, crashes a Twister into a turret and teleports Queen Imogen's entire castle to Floor 9 using the Zerzura spell. Last words: 'No let Bomo beat my Frogger score.'" },
  { id: "bomo", label: "Bomo", book: 4, faction: "NPCS", role: "NPC", x: 200, y: 730,
    desc: "Cretin bodyguard at the Desperado Club, close friends with Sledge. Hired alongside Sledge as permanent Royal Court security. Both become mercenary bodyguards as part of the Gate of the Feral Gods exchange deal with Orren. Assigned as Bomo throughout the crawl." },
  { id: "very_sullen", label: "Very Sullen", book: 4, faction: "NPCS", role: "NPC", x: 110, y: 730,
    desc: "Third Cretin bodyguard from the Desperado Club. Thinner face than the others, tiny emotionless dot eyes. Rarely speaks. Hired specifically to guard Katia on Floor 5, then becomes her full-time mercenary bodyguard from Floor 6 onward. Part of the Gate deal with Orren." },
  { id: "clay_ton", label: "Clay-ton", book: 3, faction: "NPCS", role: "NPC", x: 440, y: 730,
    desc: "Fourth Cretin bodyguard from the Desperado Club. First hired as personal security for Elle McGibbons (due to her leaderboard status) on Floor 4. Becomes a mercenary bodyguard as part of the Gate deal. On Floor 6 assigned by Carl to protect Chris Andrews." },
  // ── BOOK 4 DEITIES ──
  { id: "hellik", label: "Hellik", book: 4, faction: "SYSTEM", role: "Deity", x: 520, y: 750,
    desc: "God of Sun and Life. Twin brother of Emberus. Named in Floor 5 quests as the prime suspect in Geyrun's murder — though he was in divine council when it happened. Emberus tasks Carl with killing him (with smite if Carl reaches Floor 18 without completing it). Later reveals himself to Carl as unexpectedly friendly, denies the murder, and asks Carl to convince Emberus to ally against Nekhebit." },
  { id: "geyrun", label: "Geyrun", book: 4, faction: "BACKSTORY", role: "Pre-Dungeon", x: 1160, y: 200,
    desc: "Emberus's deceased favorite son and original owner of Orthrus the puppy. Murdered by an unknown assailant before the story begins — Emberus blinded himself in grief. His death sets off the entire Floor 5 divine crisis: Emberus comes for Orthrus, tasks Carl with the 'Find Out Who Killed My Son' and 'Kill Hellik' quests, and the murder mystery runs through subsequent books." },
  // ── BACKSTORY ──
  { id: "beatrice", label: "Beatrice", book: 1, faction: "BACKSTORY", role: "Pre-Dungeon", x: 110, y: 200,
    desc: "Carl's ex-girlfriend, Donut's original owner. Presumed dead. Her absence shapes Carl's fierce protectiveness toward Donut." },
];

const EDGES = [
  // Core party
  { from: "carl", to: "donut", type: "party", label: "partners with" },
  { from: "mordecai", to: "carl", type: "trains", label: "trains/guides" },
  { from: "mordecai", to: "donut", type: "trains", label: "manages" },
  { from: "donut", to: "mongo", type: "companion", label: "tames" },
  { from: "beatrice", to: "donut", type: "exgf", label: "original owner" },
  { from: "beatrice", to: "carl", type: "exgf", label: "ex-girlfriend" },
  { from: "katia", to: "carl", type: "joined", label: "joins party" },
  { from: "katia", to: "donut", type: "joined", label: "joins party" },
  { from: "hekla", to: "carl", type: "brokers", label: "asks to adopt Katia" },
  { from: "hekla", to: "katia", type: "connected", label: "former party leader" },
  // Meadow Lark
  { from: "carl", to: "brandon", type: "allied", label: "allies with" },
  { from: "carl", to: "imani", type: "allied", label: "allies with" },
  { from: "carl", to: "agatha", type: "allied", label: "allies with" },
  { from: "brandon", to: "elle", type: "protected", label: "protects" },
  { from: "brandon", to: "jack", type: "leads", label: "leads group" },
  { from: "imani", to: "brandon", type: "allied", label: "works alongside" },
  { from: "chris", to: "brandon", type: "allied", label: "brother/partner" },
  { from: "yolanda", to: "jack", type: "causes", label: "tries to stop" },
  { from: "jack", to: "yolanda", type: "causes", label: "triggers elemental → kills" },
  // Other crawlers B1
  { from: "carl", to: "li_jun", type: "rescued", label: "rescues on show" },
  { from: "carl", to: "li_na", type: "rescued", label: "rescues on show" },
  { from: "carl", to: "zhang", type: "rescued", label: "rescues on show" },
  // Antagonists B1
  { from: "maggie", to: "frank", type: "puppet", label: "mind-controls" },
  { from: "frank", to: "carl", type: "hunts", label: "attacks" },
  { from: "maggie", to: "carl", type: "antagonizes", label: "antagonizes" },
  { from: "carl", to: "frank", type: "causes", label: "dynamite trap" },
  { from: "maggie", to: "yvette", type: "killed", label: "strangles on air" },
  { from: "carl", to: "maestro", type: "antagonizes", label: "humiliates on air" },
  { from: "maestro", to: "carl", type: "antagonizes", label: "political grudge" },
  { from: "maestro", to: "li_jun", type: "antagonizes", label: "traps on show" },
  // Antagonists B2
  { from: "carl", to: "stalwart", type: "antagonizes", label: "provokes speech" },
  { from: "stalwart", to: "carl", type: "antagonizes", label: "orbital strike attempt" },
  { from: "stalwart", to: "manasa", type: "killed", label: "accidentally destroys trailer" },
  { from: "stalwart", to: "maestro", type: "connected", label: "brother" },
  { from: "carl", to: "miss_quill", type: "killed", label: "dynamite kills" },
  { from: "miss_quill", to: "featherfall", type: "connected", label: "ruled in his name" },
  { from: "miss_quill", to: "gumgum", type: "killed", label: "implicated in death" },
  // Antagonists B3
  { from: "loita", to: "zev", type: "replaces", label: "replaces as PR agent" },
  { from: "loita", to: "carl", type: "antagonizes", label: "racist hostility" },
  { from: "loita", to: "donut", type: "antagonizes", label: "racist hostility" },
  { from: "carl", to: "loita", type: "killed", label: "robot donut booby trap" },
  { from: "borant", to: "loita", type: "employs", label: "employs" },
  // NPCs B2
  { from: "signet", to: "carl", type: "coerces", label: "kidnaps Donut / coerces" },
  { from: "signet", to: "grimaldi", type: "loved", label: "loves" },
  { from: "carl", to: "signet", type: "quest", label: "resolves quest" },
  { from: "carl", to: "grimaldi", type: "quest", label: "poisons self to negotiate" },
  { from: "carl", to: "heather", type: "killed", label: "mercy kill" },
  { from: "signet", to: "heather", type: "coerces", label: "demands sacrifice" },
  { from: "gumgum", to: "carl", type: "quest", label: "triggers murder quest" },
  { from: "carl", to: "featherfall", type: "connected", label: "declared new Magistrate" },
  // NPCs B3
  { from: "carl", to: "growler_gary", type: "allied", label: "frequents bar" },
  { from: "mexx", to: "carl", type: "connected", label: "explains production trailer rules" },
  // System
  { from: "borant", to: "world_ai", type: "controls", label: "runs" },
  { from: "borant", to: "zev", type: "employs", label: "employs" },
  { from: "borant", to: "maestro", type: "connected", label: "Skull Empire deal" },
  { from: "zev", to: "carl", type: "manages", label: "PR manages" },
  { from: "zev", to: "donut", type: "manages", label: "bonds with" },
  { from: "world_ai", to: "carl", type: "connected", label: "cryptic messages / Cookbook" },
  { from: "world_ai", to: "mordecai", type: "connected", label: "assigned guide" },
  // Media
  { from: "odette", to: "carl", type: "hosts", label: "interviews/warns" },
  { from: "odette", to: "donut", type: "hosts", label: "secret advice" },
  { from: "mordecai", to: "odette", type: "connected", label: "prior history" },
  { from: "ripper", to: "carl", type: "hosts", label: "hosts on Danger Zone" },
  { from: "borant", to: "ripper", type: "employs", label: "employs" },
  { from: "borant", to: "mexx", type: "employs", label: "employs/deploys" },
  { from: "odette", to: "chris", type: "connected", label: "tries to warn Carl (muted)" },
  // B3 crawler relations
  { from: "miriam", to: "prepotente", type: "companion", label: "shepherd/mother figure" },
  { from: "prepotente", to: "miriam", type: "companion", label: "companion/ward" },
  { from: "carl", to: "miriam", type: "allied", label: "meets/allies with" },
  { from: "carl", to: "prepotente", type: "connected", label: "frenemy relationship" },
  { from: "florin", to: "ifechi", type: "allied", label: "partners with" },
  { from: "lucia", to: "ifechi", type: "killed", label: "spell-reflection trap" },
  { from: "lucia", to: "florin", type: "tricks", label: "frames for Ifechi's death" },
  { from: "florin", to: "katia", type: "allied", label: "joins Team Katia" },
  { from: "louis", to: "firas", type: "allied", label: "best friends" },
  { from: "louis", to: "katia", type: "allied", label: "joins Team Katia" },
  { from: "firas", to: "katia", type: "allied", label: "joins Team Katia" },
  { from: "bautista", to: "katia", type: "allied", label: "romantic relationship" },
  { from: "quan", to: "carl", type: "antagonizes", label: "interferes with Floor 4 endgame" },
  { from: "carl", to: "quan", type: "causes", label: "cuts off arm to stop him" },
  { from: "lucia", to: "carl", type: "antagonizes", label: "marks Carl & Donut" },
  { from: "hekla", to: "katia", type: "mentors", label: "true agenda (covert)" },
  { from: "gwendolyn", to: "ronaldo", type: "connected", label: "argue in crawler chat" },
  // Book 4 edges
  // Tserendolgor
  { from: "tserendolgor", to: "carl", type: "allied", label: "ally / symbol of hope" },
  { from: "tserendolgor", to: "imani", type: "allied", label: "Meadow Lark ally" },
  { from: "emberus", to: "tserendolgor", type: "antagonizes", label: "mistakes for Orthrus" },
  // Orren & Quasar
  { from: "orren", to: "carl", type: "controls", label: "investigates / regulates" },
  { from: "quasar", to: "carl", type: "allied", label: "Carl's lawyer" },
  { from: "quasar", to: "orren", type: "antagonizes", label: "legal adversary" },
  { from: "orren", to: "borant", type: "employs", label: "Syndicate liaison" },
  // Bodyguards
  { from: "sledge", to: "donut", type: "protected", label: "dedicated bodyguard" },
  { from: "sledge", to: "bomo", type: "allied", label: "close friends" },
  { from: "bomo", to: "carl", type: "protected", label: "Royal Court security" },
  { from: "very_sullen", to: "katia", type: "protected", label: "permanent bodyguard" },
  { from: "clay_ton", to: "elle", type: "protected", label: "hired by Elle" },
  { from: "clay_ton", to: "chris", type: "protected", label: "assigned by Carl" },
  // Hellik / Geyrun
  { from: "hellik", to: "emberus", type: "antagonizes", label: "suspected of killing Geyrun" },
  { from: "geyrun", to: "orthrus", type: "companion", label: "original owner" },
  { from: "emberus", to: "geyrun", type: "companion", label: "beloved son (deceased)" },
  // Chaco
  { from: "chaco", to: "mordecai", type: "antagonizes", label: "killed Mordecai's brother Uzzi" },
  { from: "odette", to: "chaco", type: "controls", label: "instructed to kill Uzzi" },
  // Samantha
  { from: "carl", to: "samantha", type: "companion", label: "wakes / reluctant allies" },
  { from: "samantha", to: "carl", type: "companion", label: "joins Royal Court" },
  { from: "samantha", to: "mrs_ghazi", type: "companion", label: "mother/daughter" },
  { from: "juice_box", to: "henrik", type: "allied", label: "siblings" },
  { from: "juice_box", to: "louis", type: "allied", label: "engaged to" },
  { from: "carl", to: "juice_box", type: "allied", label: "saves Hump Town / allies" },
  { from: "juice_box", to: "carl", type: "allied", label: "key NPC ally" },
  { from: "carl", to: "henrik", type: "quest", label: "retrieves Gate piece from" },
  { from: "carl", to: "commandant_kane", type: "quest", label: "retrieves Gate piece from" },
  { from: "carl", to: "orthrus", type: "companion", label: "summons / protects" },
  { from: "emberus", to: "orthrus", type: "companion", label: "pursues / father figure" },
  { from: "emberus", to: "carl", type: "antagonizes", label: "threatens crawlers" },
  { from: "maggie", to: "algos", type: "quest", label: "attempts to summon" },
  { from: "maggie", to: "chris", type: "puppet", label: "infiltrator possession" },
  { from: "carl", to: "denise", type: "killed", label: "garbage disposal kill" },
  { from: "carl", to: "maggie", type: "killed", label: "kills with Mordecai's potion" },
  { from: "katia", to: "maggie", type: "allied", label: "petrifies possessed Chris" },
  { from: "samantha", to: "emberus", type: "connected", label: "involved in Geyrun's death" },
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
          <span style={{ marginLeft: 10, fontSize: 11, color: "#57534e" }}>Books 1–4 · Character DAG · {NODES.length} characters · {EDGES.length} edges</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 3 }}>
            {["ALL","1","2","3","4"].map(b => (
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
