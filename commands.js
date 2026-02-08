// ----------------- DATABASES -----------------
let jumpDB = null;
let tricksDB = null;
const BATCHES = {};
const MAX_BATCH_NAME = 50;

// ----------------- WORKER BACKEND -----------------
const WORKER_URL = "https://my-worker-simple.daniel-a-bernard.workers.dev"; // ton Worker Cloudflare

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
    if (trick.name && trick.name.toLowerCase().includes(lower)) {
      return trick;
    }
  }
  return null;
}

// ----------------- FORMATTEUR -----------------
function buildContent(jump) {
  // Retourne juste le nom du jump
  return jump.name || "Unnamed jump";
}

// ----------------- BATCHS -----------------
function createBatch(batchName, author="WebUser") {
  if (batchName.length > MAX_BATCH_NAME) return "Batch name too long!";
  if (BATCHES[batchName]) return "Batch already exists!";
  BATCHES[batchName] = {
    name: batchName,
    created_by: author,
    status: "unfinished",
    add: {},
    edit: {},
    rem: [],
    log: [`${author} created batch.`]
  };
  return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author="WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" not found.`;
  const jump = getJump(jumpName);
  if (!jump) return `Jump "${jumpName}" not found.`;
  batch.add[jumpName.toLowerCase()] = jump;
  batch.log.push(`${author} added jump "${jumpName}".`);
  return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author="WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" not found.`;
  batch.status = "finished";
  batch.log.push(`${author} finished batch.`);
  return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author="WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" not found.`;
  if (batch.status !== "finished") return "Batch must be finished before approval.";

  Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
  Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
  batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);

  batch.status = "implemented";
  batch.log.push(`${author} approved batch.`);
  return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- WORKER GIST -----------------
async function createPaste(content) {
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    const data = await resp.json();
    if (data.url) return data.url;
    console.error("Worker error:", data);
    return "Erreur: Impossible de créer le Gist.";
  } catch (err) {
    console.error("Worker exception:", err);
    return "Erreur: Impossible de créer le Gist.";
  }
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" not found.`;
  return buildContent(jump);
}

function randomCommand() {
  if (!jumpDB) return "Database not loaded yet.";
  const allJumps = [...Object.values(jumpDB), ...tricksDB];
  const randJump = allJumps[Math.floor(Math.random() * allJumps.length)];
  return buildContent(randJump);
}

async function listCommand(filters = "") {
  if (!jumpDB || !tricksDB) return "Database not loaded yet.";

  // Combine jumps + tricks
  let all = [...Object.values(jumpDB), ...tricksDB];

  // Filtrer si besoin
  if (filters) {
    const f = filters.toLowerCase();
    all = all.filter(j => (j.name || "").toLowerCase().includes(f));
  }

  // Liste des noms seulement
  const output = all.map(j => j.name).join("\n");

  // Envoie au Worker pour créer le Gist
  const link = await createPaste(output);
  return `Liste créée: ${link}`;
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
      if (!rest.length) res = "Provide a jump name!";
      else res = infoCommand(rest.join(" "));
      break;

    case "random":
      res = randomCommand();
      break;

    case "list":
    case "missing":
      res = await listCommand(rest.join(" "));
      break;

    case "batch":
      if (rest.length < 2) {
        res = "Usage: !batch <create|add|finish|approve> <batchName> [args]";
        break;
      }
      const op = rest[0].toLowerCase();
      const batchName = rest[1];
      const author = "WebUser";

      switch(op) {
        case "create":
          res = createBatch(batchName, author);
          break;
        case "add":
          if (rest.length < 3) { res = "Usage: !batch add <batchName> <jumpName>"; break; }
          const jumpName = rest.slice(2).join(" ");
          res = addJumpToBatch(batchName, jumpName, author);
          break;
        case "finish":
          res = finishBatch(batchName, author);
          break;
        case "approve":
          res = approveBatch(batchName, author);
          break;
        default:
          res = "Unknown batch operation!";
      }
      break;

    default:
      res = "Unknown command!";
  }

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
