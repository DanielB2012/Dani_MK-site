// ----------------- DATABASES -----------------
let jumpDB = null;
let tricksDB = null;

// ----------------- UTILITAIRES -----------------
async function loadDatabases() {
  if (!jumpDB) {
    const resp = await fetch('Jumps-database/jump_data.json');
    jumpDB = await resp.json();
  }
  if (!tricksDB) {
    const resp = await fetch('Jumps-database/tricks.json');
    tricksDB = await resp.json();
  }
}

function normalize(s) {
  if (s === null || s === undefined) return "";
  return String(s).trim().toLowerCase();
}

// Essaie plusieurs heuristiques pour récupérer le "Jump Type" depuis tricksDB
function getTypeFromTricks(jumpName) {
  if (!tricksDB || !Array.isArray(tricksDB)) return null;
  const target = normalize(jumpName);

  // Parcours des entrées et essaie de trouver la meilleure correspondance
  for (const t of tricksDB) {
    if (!t || !t.content) continue;
    const content = String(t.content);

    // 1) Nom avant le '-' (ex: "Luminous Conduction - Metro Kingdom")
    const firstLine = content.split("\n")[0] || content;
    const leftPart = firstLine.split("-")[0].trim().toLowerCase();
    if (leftPart && leftPart === target) {
      const match = content.match(/Jump Type\s*:\s*([^\n\r]+)/i) || content.match(/Junp Type\s*:\s*([^\n\r]+)/i);
      if (match) return match[1].trim();
    }
  }

  // 2) Si pas trouvé par égalité stricte, rechercher inclusion (nom du jump contenu dans la ligne content)
  for (const t of tricksDB) {
    if (!t || !t.content) continue;
    const content = String(t.content).toLowerCase();
    if (content.includes(target)) {
      const match = t.content.match(/Jump Type\s*:\s*([^\n\r]+)/i) || t.content.match(/Junp Type\s*:\s*([^\n\r]+)/i);
      if (match) return match[1].trim();
    }
  }

  // 3) fallback : aucune info
  return null;
}

// Récupère un jump par nom (pratique pour infoCommand)
function getJump(name) {
  if (!jumpDB || !tricksDB) return null;
  const lower = name.toLowerCase();
  if (jumpDB[lower]) return jumpDB[lower];
  for (const trick of tricksDB) {
    if (trick.content && trick.content.toLowerCase().includes(lower)) {
      return trick;
    }
  }
  return null;
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" not found.`;
  return jump.name || "Nom non défini";
}

function randomCommand() {
  if (!jumpDB) return "Database not loaded yet.";
  const allJumps = Object.values(jumpDB);
  if (!allJumps.length) return "Database vide.";
  const randJump = allJumps[Math.floor(Math.random() * allJumps.length)];
  return randJump.name || "Nom non défini";
}

// ----------------- PARSING des ARGUMENTS -----------------
function tokenizeInput(input) {
  // Retourne un tableau d'arguments en respectant les guillemets
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"|"$/g, "")) || [];
}

function parseListArguments(tokens) {
  // mapping d'alias
  const attrMap = {
    diff: "diff",
    d: "diff",
    ty: "type",
    type: "type",
    k: "location",
    kingdom: "location",
    loc: "location",
    s: "server",
    server: "server",
    f: "finder",
    finder: "finder",
    p: "prover",
    prover: "prover",
    name: "name",
    n: "name",
    tier: "tier",
    t: "tier",
    links: "links",
    link: "links",
    l: "links",
    extra: "extra"
  };

  let idx = 0;
  let target = "all"; // valeur par défaut
  let filtersSection = []; // tableau de tokens pour filters
  let sortsSection = []; // tokens pour sorts
  let yieldType = ""; // '+' or '-'

  // If first token looks like a target (all / mine / user id), consume it.
  if (tokens.length > 0 && ["all", "mine"].includes(tokens[0].toLowerCase())) {
    target = tokens[0].toLowerCase();
    idx = 1;
  } else if (tokens.length > 0 && /^[0-9]{17,20}$/.test(tokens[0])) {
    // Discord ID-ish -> treat as user id (we don't implement per-user lists here, but accept)
    target = tokens[0];
    idx = 1;
  }

  // split tokens into filters (after 'only' or from here) and sorts (after 'by')
  // Accept syntax: [only] <filters...> [by <sorts...>] [+ or -]
  // We'll scan from idx to end
  let mode = "pre"; // pre / filters / sorts
  for (; idx < tokens.length; idx++) {
    const tk = tokens[idx];
    const low = tk.toLowerCase();

    if (low === "only") {
      mode = "filters";
      continue;
    }
    if (low === "by") {
      mode = "sorts";
      continue;
    }
    if (tk === "+" || tk === "-") {
      yieldType = tk;
      continue;
    }

    if (mode === "pre") {
      // If user didn't write 'only' explicitly, assume tokens start with filters
      mode = "filters";
    }

    if (mode === "filters") {
      filtersSection.push(tk);
    } else if (mode === "sorts") {
      sortsSection.push(tk);
    }
  }

  // Parse filtersSection into groups separated by 'or', where within group 'and' separates conditions.
  // Each condition is [key value].
  const raw = filtersSection;
  const groups = [];
  let currentGroup = [];
  let i = 0;
  while (i < raw.length) {
    const token = raw[i];
    const low = token.toLowerCase();
    if (low === "or") {
      if (currentGroup.length) groups.push(currentGroup);
      currentGroup = [];
      i++;
      continue;
    }
    if (low === "and") { i++; continue; }

    const keyToken = token;
    const valueToken = raw[i + 1] !== undefined ? raw[i + 1] : "";
    // map alias
    const key = attrMap[keyToken.toLowerCase()] || keyToken.toLowerCase();
    // Normalisation spéciale : si diff filter contains 'elite' keep only first token
    let value = valueToken;
    if (key === "diff" && typeof value === "string" && /elite/i.test(value)) {
      value = value.split(/\s+/)[0];
    }
    currentGroup.push({ key, value });
    i += 2;
  }
  if (currentGroup.length) groups.push(currentGroup);

  // If no filters specified, groups will be empty -> means "no filter"
  return {
    target,
    filterGroups: groups, // array of groups; empty means no filter
    sorts: sortsSection,
    yieldType
  };
}

// ----------------- LOGIQUE DE FILTRAGE -----------------
function matchDiffAttribute(attrRaw, filterValue) {
  // attrRaw: string like "5/10" or "Low Elite" etc.
  // filterValue: user-provided, e.g. "5" or "low"
  if (attrRaw === null || attrRaw === undefined) return false;
  const attr = String(attrRaw).trim();

  if (!filterValue && filterValue !== 0) return false;
  const fv = String(filterValue).trim().toLowerCase();

  // If attr contains "Elite", use first word (Low/Mid/High/Insanity etc.)
  if (/elite/i.test(attr)) {
    const first = attr.split(/\s+/)[0].toLowerCase();
    return first === fv;
  }

  // If attr starts with a number like 5/10 or 8.5/10, extract the number before slash
  const numMatch = attr.match(/^(\d+(\.\d+)?)/);
  if (numMatch) {
    const numStr = numMatch[1]; // e.g. "5" or "8.5"
    // Accept both exact numeric match or substring match (user might request "5" for "5/10")
    if (numStr.toLowerCase() === fv) return true;
    // Also allow user input "5/10"
    if (fv.startsWith(numStr) || fv === `${numStr}/10`) return true;
    return false;
  }

  // Otherwise compare lowercase includes (tolerant)
  return attr.toLowerCase().includes(fv);
}

function matchGenericAttribute(attrRaw, filterValue) {
  if (attrRaw === null || attrRaw === undefined) return false;
  const fv = String(filterValue).trim().toLowerCase();
  if (fv === "") return false;

  if (Array.isArray(attrRaw)) {
    return attrRaw.some(a => String(a).toLowerCase().includes(fv));
  } else {
    return String(attrRaw).toLowerCase().includes(fv);
  }
}

function matchConditionForJump(jump, cond) {
  const key = cond.key;
  const value = cond.value;

  // Defensive checks
  if (!key) return false;
  if (value === undefined || value === null) return false;

  // Acquire attribute value from jump (if missing, null)
  let attr = undefined;
  if (Object.prototype.hasOwnProperty.call(jump, key)) {
    attr = jump[key];
  } else {
    attr = undefined;
  }

  // If key is type and not present, try to get it from tricksDB
  if ((attr === undefined || attr === null || attr === "") && key === "type") {
    const t = getTypeFromTricks(jump.name || "");
    if (t) attr = t;
  }

  // Now route by key
  if (key === "diff") {
    // attr might be array (weird), handle gracefully
    if (Array.isArray(attr)) {
      return attr.some(a => matchDiffAttribute(a, value));
    } else {
      return matchDiffAttribute(attr, value);
    }
  } else {
    // generic attributes: location (array), finder (array), etc.
    return matchGenericAttribute(attr, value);
  }
}

// Evaluate filter groups: OR of groups, each group is AND of conditions
function passesFilters(jump, filterGroups) {
  if (!filterGroups || filterGroups.length === 0) return true; // no filters -> pass

  for (const group of filterGroups) {
    // group: array of conditions to AND together
    let allTrue = true;
    for (const cond of group) {
      if (!matchConditionForJump(jump, cond)) {
        allTrue = false;
        break;
      }
    }
    if (allTrue) return true; // at least one group satisfied -> pass
  }
  return false;
}

// ----------------- LIST COMMAND -----------------
async function listCommandFromTokens(tokens) {
  if (!jumpDB) return "Base de données non chargée.";

  const { target, filterGroups, sorts, yieldType } = parseListArguments(tokens);

  // Currently we only support 'all' as a meaningful target for listing the DB.
  // If the user provided 'mine' or a user ID, we don't have per-user data in this file,
  // so we treat it as 'all' while keeping future compatibility.
  // (Alternatively, you can return a message saying 'mine' isn't supported locally.)
  // For safety, we ignore target for now.
  let jumps = Object.values(jumpDB) || [];

  // Apply filters
  const filtered = jumps.filter(j => passesFilters(j, filterGroups));
  jumps = filtered;

  // Apply sorts (in order of priority: the first listed has highest priority)
  // We reverse to perform stable sorts (least significant first).
  for (let i = sorts.length - 1; i >= 0; i--) {
    const s = sorts[i];
    // try to map s aliases to actual keys? assume user passed attribute name or alias already
    jumps.sort((a, b) => {
      const av = normalize(a[s] ?? "");
      const bv = normalize(b[s] ?? "");
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
  }

  // Prepare output according to yield
  if (!jumps.length) return "Aucun jump trouvé avec ces filtres.";

  const usedFilterKeys = [];
  for (const g of filterGroups) {
    for (const c of g) {
      if (c && c.key && !usedFilterKeys.includes(c.key)) usedFilterKeys.push(c.key);
    }
  }

  const outputLines = jumps.map(j => {
    if (yieldType === "+") return JSON.stringify(j);
    if (yieldType === "-") return j.name || "(nom manquant)";
    // Default: name + attributes used in filters & sorts (resolve type if needed)
    const parts = [];
    for (const k of usedFilterKeys) {
      let val = j[k];
      if ((val === undefined || val === null || val === "") && k === "type") {
        val = getTypeFromTricks(j.name || "") || "";
      }
      if (Array.isArray(val)) {
        val = val.join("; ");
      }
      parts.push(`${k}: ${val ?? ""}`);
    }
    for (const s of sorts) {
      let val = j[s];
      if ((val === undefined || val === null || val === "") && s === "type") {
        val = getTypeFromTricks(j.name || "") || "";
      }
      if (Array.isArray(val)) val = val.join("; ");
      if (!usedFilterKeys.includes(s)) parts.push(`${s}: ${val ?? ""}`);
    }
    return parts.length ? `${j.name} [${parts.join(", ")}]` : j.name;
  });

  const output = outputLines.join("\n");

  // Finally post to the worker, but only if there's non-empty content
  if (!output.trim()) return "Aucun contenu à poster.";

  try {
    const res = await fetch("https://my-worker-simple.daniel-a-bernard.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: output })
    });
    const data = await res.json();
    if (data && data.url) return `Liste créée: ${data.url}`;
    return `Erreur: ${data && data.error ? data.error : "Gist non créé"}`;
  } catch (err) {
    return `Erreur: ${err && err.message ? err.message : "Erreur inconnue lors de la requête."}`;
  }
}

// Wrapper that accepts the plain args string as before (keeps compatibility)
async function listCommand(argsStr = "") {
  const tokens = tokenizeInput(argsStr);
  return await listCommandFromTokens(tokens);
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
  await loadDatabases();
  if (!input || typeof input !== "string") return callback("Commande invalide.");
  if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");

  // Tokenize (preserve quoted strings)
  const args = tokenizeInput(input).map(a => a.replace(/^"|"$/g, ""));
  if (!args.length) return callback("Commande vide.");

  const cmd = args[0].substring(1).toLowerCase();
  const restTokens = args.slice(1); // already tokenized

  let res = "";

  try {
    switch (cmd) {
      case "info":
        if (!restTokens.length) {
          res = "Fournir un nom de jump !";
        } else {
          res = infoCommand(restTokens.join(" "));
        }
        break;
      case "random":
        res = randomCommand();
        break;
      case "list":
        // pass tokens (as a string for backward compat), but we can also pass tokens array
        res = await listCommandFromTokens(restTokens);
        break;
      case "missing":
        // we don't have per-user data in this module; behave like list for now
        // In a full implementation you'd subtract the user's completed jumps from the DB.
        res = await listCommandFromTokens(restTokens);
        break;
      default:
        res = "Commande inconnue !";
    }
  } catch (err) {
    res = `Erreur interne: ${err && err.message ? err.message : String(err)}`;
  }

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
