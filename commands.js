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
async function listCommand(filters = "") {
  if (!jumpDB) return "Database not loaded yet.";

  const output = Object.values(jumpDB)
    .map(j => j.name)
    .filter(name => !filters || name.toLowerCase().includes(filters.toLowerCase()))
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
