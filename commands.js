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
  // Gère filters et sorts
  let filters = [];
  let sorts = [];
  let yieldType = "";

  let mode = "filters"; // filters / sorts / yield
  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();

    if (arg === "only") {
      mode = "filters";
      continue;
    } else if (arg === "by") {
      mode = "sorts";
      continue;
    } else if (arg === "+" || arg === "-") {
      yieldType = arg;
      continue;
    }

    if (mode === "filters") {
      // filtre = paire attribut valeur
      const key = args[i];
      const value = args[i + 1] || "";
      filters.push({ key: key.toLowerCase(), value: value.toLowerCase() });
      i++; // skip value
    } else if (mode === "sorts") {
      sorts.push(arg);
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
  for (const f of filters) {
    jumps = jumps.filter(j => {
      const attr = j[f.key];
      if (!attr) return false;
      if (Array.isArray(attr)) {
        return attr.some(v => v.toLowerCase().includes(f.value));
      }
      return attr.toLowerCase().includes(f.value);
    });
  }

  // Appliquer les sorts
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
      // default: name + filter/sort attributes
      const extraAttrs = filters.concat(sorts.map(k => ({ key: k, value: j[k] || "" })))
        .map(f => `${f.key}: ${f.value}`)
        .join(", ");
      return extraAttrs ? `${j.name} [${extraAttrs}]` : j.name;
    })
    .join("\n");

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
