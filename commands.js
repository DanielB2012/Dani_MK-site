// ================= DATABASE =================
let jumpDB = null;

// ================= LOAD =================
async function loadDatabases() {
  if (!jumpDB) {
    const resp = await fetch("Jumps-database/jump_data.json");
    jumpDB = await resp.json();
  }
}

// ================= UTILS =================
function normalize(v) {
  return v ? String(v).trim().toLowerCase() : "";
}

function tokenizeInput(input) {
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(t => t.replace(/^"|"$/g, "")) || [];
}

// ================= GET JUMP =================
function getJump(name) {
  if (!jumpDB) return null;
  return jumpDB[normalize(name)] || null;
}

// ================= INFO =================
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" not found.`;

  const lines = [];

  lines.push(jump.name);

  if (jump.location?.length)
    lines.push(`Location: ${jump.location.join(", ")}`);

  if (jump.diff)
    lines.push(`Difficulty: ${jump.diff}`);

  if (jump.tier)
    lines.push(`Tier: ${jump.tier}`);

  if (jump.type?.length)
    lines.push(`Type: ${jump.type.join(", ")}`);

  if (jump.finder?.length)
    lines.push(`Found by: ${jump.finder.join(", ")}`);

  if (jump.prover?.length)
    lines.push(`Proven by: ${jump.prover.join(", ")}`);

  if (jump.links?.length)
    lines.push(jump.links[0]);

  return lines.join("\n");
}

// ================= RANDOM =================
function randomCommand() {
  if (!jumpDB) return "Database not loaded.";
  const jumps = Object.values(jumpDB);
  if (!jumps.length) return "Database empty.";
  return jumps[Math.floor(Math.random() * jumps.length)].name;
}

// ================= FILTER =================
function matchAttr(attr, value) {
  if (!attr) return false;
  const v = normalize(value);
  if (Array.isArray(attr))
    return attr.some(a => normalize(a).includes(v));
  return normalize(attr).includes(v);
}

function passesFilters(jump, filters) {
  for (const f of filters) {
    if (!matchAttr(jump[f.key], f.value)) return false;
  }
  return true;
}

// ================= PARSE LIST =================
function parseListArguments(tokens) {
  const map = {
    diff: "diff", d: "diff",
    tier: "tier", t: "tier",
    type: "type", ty: "type",
    location: "location", loc: "location", k: "location",
    finder: "finder", f: "finder",
    prover: "prover", p: "prover",
    server: "server", s: "server",
    name: "name", n: "name"
  };

  const filters = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const key = map[tokens[i]?.toLowerCase()];
    const value = tokens[i + 1];
    if (key && value !== undefined) {
      filters.push({ key, value });
    }
  }
  return filters;
}

// ================= LIST (WITH GIST) =================
async function listCommandFromTokens(tokens) {
  if (!jumpDB) return "Database not loaded.";

  const filters = parseListArguments(tokens);
  const jumps = Object.values(jumpDB).filter(j => passesFilters(j, filters));

  if (!jumps.length)
    return "Aucun jump trouvé avec ces filtres.";

  const content = jumps.map(j => j.name).join("\n");

  try {
    const res = await fetch(
      "https://my-worker-simple.daniel-a-bernard.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      }
    );

    const data = await res.json();

    // ✅ SUCCÈS → lien uniquement
    if (data && typeof data.url === "string") {
      return `Liste créée: 
          ${data.url}`;
    }

    // ❌ ÉCHEC → message court, JAMAIS le contenu
    return "❌ Erreur : impossible de créer le Gist.";

  } catch (err) {
    return "❌ Erreur réseau lors de la création du Gist.";
  }
}


// ================= RUN =================
async function runCommand(input, callback) {
  await loadDatabases();

  if (!input.startsWith("!"))
    return callback("Commande invalide.");

  const tokens = tokenizeInput(input);
  const cmd = tokens[0].slice(1).toLowerCase();
  const args = tokens.slice(1);

  let result = "";

  try {
    switch (cmd) {
      case "info":
        result = args.length
          ? infoCommand(args.join(" "))
          : "Donne un nom de jump.";
        break;

      case "random":
        result = randomCommand();
        break;

      case "list":
        result = await listCommandFromTokens(args);
        break;

      default:
        result = "Commande inconnue.";
    }
  } catch (e) {
    result = `Erreur interne: ${e.message}`;
  }

  callback(result);
}

// ================= EXPORT =================
window.runCommand = runCommand;
window.getJump = getJump;


