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
  const randJump = allJumps[Math.floor(Math.random() * allJumps.length)];
  return randJump.name || "Nom non défini";
}

// ----------------- LISTE / PASTE -----------------
function parseListArguments(args) {
  // Mapping des alias d'attributs
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
  };

  let filters = [];
  let sorts = [];
  let yieldType = "";

  let mode = "filters"; // filters / sorts / yield
  let i = 0;

  while (i < args.length) {
    const arg = args[i].toLowerCase();

    if (arg === "only") {
      mode = "filters";
      i++;
      continue;
    } else if (arg === "by") {
      mode = "sorts";
      i++;
      continue;
    } else if (arg === "+" || arg === "-") {
      yieldType = arg;
      i++;
      continue;
    } else if (arg === "and" || arg === "or") {
      filters.push({ op: arg }); // conserver opérateur pour extension future
      i++;
      continue;
    }

    if (mode === "filters") {
      const key = attrMap[arg] || arg;
      const value = args[i + 1] || "";
      filters.push({ key, value });
      i += 2;
    } else if (mode === "sorts") {
      sorts.push(arg);
      i++;
    } else {
      i++;
    }
  }

  return { filters, sorts, yieldType };
}

async function listCommand(argsStr = "") {
  if (!jumpDB) return "Database not loaded yet.";

  const args = argsStr.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/"/g, "")) || [];
  const { filters, sorts, yieldType } = parseListArguments(args);

  let jumps = Object.values(jumpDB);

  // Appliquer les filtres
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    if (f.op) continue; // ignorer "and"/"or" pour l'instant
    jumps = jumps.filter(j => {
      const attr = j[f.key];
      if (!attr) return false;
      if (Array.isArray(attr)) {
        return attr.some(v => v.toLowerCase().includes(f.value.toLowerCase()));
      }
      return attr.toLowerCase().includes(f.value.toLowerCase());
    });
  }

  // Appliquer les sorts (ordre inverse pour priorité multiple)
  for (let s of sorts.reverse()) {
    jumps.sort((a, b) => {
      const av = (a[s] || "").toString().toLowerCase();
      const bv = (b[s] || "").toString().toLowerCase();
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
  }

  // Formater le output selon yield
  let output = jumps
    .map(j => {
      if (yieldType === "+") return JSON.stringify(j);
      if (yieldType === "-") return j.name;
      const extraAttrs = filters
        .filter(f => !f.op)
        .map(f => `${f.key}: ${j[f.key] || ""}`)
        .concat(sorts.map(s => `${s}: ${j[s] || ""}`))
        .join(", ");
      return extraAttrs ? `${j.name} [${extraAttrs}]` : j.name;
    })
    .join("\n");

  if (!output) return "Aucun jump trouvé avec ces filtres.";

  try {
    const res = await fetch("https://my-worker-simple.daniel-a-bernard.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: output })
    });

    const data = await res.json();
    if (data.url) return `Liste créée: ${data.url}`;
    return `Erreur: ${data.error || "Gist non créé"}`;
  } catch (err) {
    return `Erreur: ${err.message}`;
  }
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
  await loadDatabases();
  if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");

  const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
  const cmd = args[0].substring(1).toLowerCase();
  const rest = args.slice(1);

  let res = "";

  switch (cmd) {
    case "info":
      res = rest.length ? infoCommand(rest.join(" ")) : "Fournir un nom de jump !";
      break;
    case "random":
      res = randomCommand();
      break;
    case "list":
    case "missing":
      res = await listCommand(rest.join(" "));
      break;
    default:
      res = "Commande inconnue !";
  }

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
