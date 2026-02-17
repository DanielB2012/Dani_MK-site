// ----------------- DATABASE -----------------
let jumpDB = null;

// ----------------- UTILITAIRES -----------------
async function loadDatabases() {
  if (!jumpDB) {
    const resp = await fetch('Jumps-database/jump_data.json');
    jumpDB = await resp.json();
  }
}

function normalize(s) {
  return s ? String(s).trim().toLowerCase() : "";
}

// Recherche uniquement dans jump_data
function getJump(name) {
  if (!jumpDB) return null;
  const key = normalize(name);
  return jumpDB[key] || null;
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" not found.`;

  const lines = [];

  // Nom
  if (jump.name) {
    lines.push(jump.name);
  }

  // Location
  if (jump.location?.length) {
    lines.push(`Location: ${jump.location.join(", ")}`);
  }

  // Difficulty
  if (jump.diff) {
    lines.push(`Difficulty: ${jump.diff}`);
  }

  // Tier
  if (jump.tier) {
    lines.push(`Tier: ${jump.tier}`);
  }

  // Type
  if (jump.type?.length) {
    lines.push(`Type: ${jump.type.join(", ")}`);
  }

  // Finder / Prover
  if (jump.finder?.length && jump.prover?.length) {
    lines.push(`Found by ${jump.finder.join(", ")}`);
    lines.push(`Proven by ${jump.prover.join(", ")}`);
  } else if (jump.finder?.length) {
    lines.push(`Found by ${jump.finder.join(", ")}`);
  } else if (jump.prover?.length) {
    lines.push(`Proven by ${jump.prover.join(", ")}`);
  }

  // Lien
  if (jump.links?.length) {
    lines.push(jump.links[0]);
  }

  return lines.join("\n");
}

function randomCommand() {
  if (!jumpDB) return "Database not loaded yet.";
  const allJumps = Object.values(jumpDB);
  if (!allJumps.length) return "Database vide.";
  const randJump = allJumps[Math.floor(Math.random() * allJumps.length)];
  return randJump.name || "Nom non défini";
}

// ----------------- TOKENIZE -----------------
function tokenizeInput(input) {
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"|"$/g, "")) || [];
}

// ----------------- PARSING -----------------
function parseListArguments(tokens) {
  const attrMap = {
    diff: "diff", d: "diff",
    ty: "type", type: "type",
    k: "location", kingdom: "location", loc: "location",
    s: "server", server: "server",
    f: "finder", finder: "finder",
    p: "prover", prover: "prover",
    name: "name", n: "name",
    tier: "tier", t: "tier"
  };

  let filters = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const key = attrMap[tokens[i]?.toLowerCase()];
    const value = tokens[i + 1];
    if (key && value !== undefined) {
      filters.push({ key, value });
    }
  }

  return filters;
}

// ----------------- FILTRAGE -----------------
function matchAttribute(attrRaw, filterValue) {
  if (!attrRaw) return false;
  const fv = normalize(filterValue);

  if (Array.isArray(attrRaw)) {
    return attrRaw.some(v => normalize(v).includes(fv));
  }
  return normalize(attrRaw).includes(fv);
}

function passesFilters(jump, filters) {
  if (!filters.length) return true;
  return filters.every(f => matchAttribute(jump[f.key], f.value));
}

// ----------------- LIST COMMAND -----------------
async function listCommandFromTokens(tokens) {
  if (!jumpDB) return "Database non chargée.";

  const filters = parseListArguments(tokens);
  let jumps = Object.values(jumpDB).filter(j => passesFilters(j, filters));

  if (!jumps.length) return "Aucun jump trouvé avec ces filtres.";

  return jumps.map(j => j.name).join("\n");
}

async function listCommand(argsStr = "") {
  const tokens = tokenizeInput(argsStr);
  return await listCommandFromTokens(tokens);
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
  await loadDatabases();

  if (!input || typeof input !== "string") {
    return callback("Commande invalide.");
  }
  if (!input.startsWith("!")) {
    return callback("Commande doit commencer par '!'");
  }

  const args = tokenizeInput(input);
  if (!args.length) {
    return callback("Commande vide.");
  }

  const cmd = args[0].substring(1).toLowerCase();
  const restTokens = args.slice(1);

  let res = "";
  try {
    switch (cmd) {
      case "info":
        res = restTokens.length
          ? infoCommand(restTokens.join(" "))
          : "Fournir un nom de jump !";
        break;
      case "random":
        res = randomCommand();
        break;
      case "list":
        res = await listCommandFromTokens(restTokens);
        break;
      default:
        res = "Commande inconnue !";
        break;
    }
  } catch (err) {
    res = `Erreur interne: ${err?.message ?? String(err)}`;
  }

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
