// ----------------- CONFIG -----------------
const WORKER_URL = "https://my-worker-simple.daniel-a-bernard.workers.dev"; // ton Worker Cloudflare
const MAX_CHUNK_SIZE = 180000; // si le contenu dépasse ça, on le split en plusieurs gists

// ----------------- DATABASES -----------------
let jumpDB = null;   // attendu: objet { "jump-name-lower": { name: "...", ... }, ... }
let tricksDB = null; // attendu: tableau [{ name: "...", content: "..." }, ...]

// ----------------- UTILITAIRES -----------------
async function loadDatabases() {
  if (!jumpDB) {
    try {
      const resp = await fetch('Jumps-database/jump_data.json');
      if (!resp.ok) throw new Error(`Erreur chargement jump_data.json: ${resp.status}`);
      jumpDB = await resp.json();
    } catch (err) {
      console.error("loadDatabases jumpDB error:", err);
      jumpDB = {};
    }
  }

  if (!tricksDB) {
    try {
      const resp = await fetch('Jumps-database/tricks.json');
      if (!resp.ok) throw new Error(`Erreur chargement tricks.json: ${resp.status}`);
      tricksDB = await resp.json();
    } catch (err) {
      console.error("loadDatabases tricksDB error:", err);
      tricksDB = [];
    }
  }
}

function getJump(name) {
  if (!jumpDB || !tricksDB) return null;
  const lower = name.toLowerCase().trim();

  if (jumpDB[lower]) return jumpDB[lower];

  for (const trick of tricksDB) {
    const hay = (trick.name || trick.content || "").toLowerCase();
    if (hay.includes(lower)) return trick;
  }
  return null;
}

// ----------------- FORMATTEUR -----------------
function buildName(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  return (item.name || item.content || "").toString();
}

// ----------------- BATCHS -----------------
const BATCHES = {};
const MAX_BATCH_NAME = 50;

function createBatch(batchName, author = "WebUser") {
  if (!batchName) return "Nom de batch requis.";
  if (batchName.length > MAX_BATCH_NAME) return "Nom de batch trop long !";
  if (BATCHES[batchName]) return "Batch existe déjà !";
  BATCHES[batchName] = {
    name: batchName,
    created_by: author,
    status: "unfinished",
    add: {},
    edit: {},
    rem: [],
    log: [`${author} created batch.`]
  };
  return `Batch "${batchName}" créé.`;
}

function addJumpToBatch(batchName, jumpName, author = "WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" introuvable.`;
  const jump = getJump(jumpName);
  if (!jump) return `Jump "${jumpName}" introuvable.`;
  batch.add[jumpName.toLowerCase()] = jump;
  batch.log.push(`${author} added "${jumpName}".`);
  return `Jump "${jumpName}" ajouté au batch "${batchName}".`;
}

function finishBatch(batchName, author = "WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" introuvable.`;
  batch.status = "finished";
  batch.log.push(`${author} finished batch.`);
  return `Batch "${batchName}" marqué comme finished.`;
}

function approveBatch(batchName, author = "WebUser") {
  const batch = BATCHES[batchName];
  if (!batch) return `Batch "${batchName}" introuvable.`;
  if (batch.status !== "finished") return "Le batch doit être terminé avant approbation.";

  Object.entries(batch.add).forEach(([name, data]) => { jumpDB[name.toLowerCase()] = data; });
  Object.entries(batch.edit).forEach(([name, data]) => { jumpDB[name.toLowerCase()] = data; });
  batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);

  batch.status = "implemented";
  batch.log.push(`${author} approved batch.`);
  return `Batch "${batchName}" approuvé et appliqué.`;
}

// ----------------- HELPERS for paste splitting -----------------
function splitIntoChunks(text, maxSize) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxSize));
    i += maxSize;
  }
  return chunks;
}

// ----------------- CREATE PASTE via Worker -----------------
// Le Worker retourne JSON { url: "...", id: "..." } en cas de succès
async function createPasteSingle(content) {
  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    // Essaie de parser JSON, fallback sur texte brut si nécessaire
    const text = await resp.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (err) {
      console.error("createPasteSingle: response non-JSON:", text);
      return { ok: false, error: "Worker a renvoyé une réponse inattendue", raw: text, status: resp.status };
    }

    if (!resp.ok) {
      return { ok: false, error: data && data.error ? data.error : "Erreur Worker", detail: data, status: resp.status };
    }

    if (data && data.url) return { ok: true, url: data.url, id: data.id || null };
    return { ok: false, error: "Pas d'URL retournée par le Worker.", detail: data };
  } catch (err) {
    console.error("createPasteSingle exception:", err);
    return { ok: false, error: "Impossible de contacter le Worker.", detail: String(err) };
  }
}

// Gère le split automatique si nécessaire, retourne un string (url unique) ou plusieurs urls séparées par newline
async function createPaste(content) {
  if (typeof content !== "string") content = String(content || "");

  // Normalisation des retours chariot
  content = content.replace(/\r\n/g, "\n");

  if (content.length === 0) return "Erreur: contenu vide.";

  // Si petit, envoie simple
  if (content.length <= MAX_CHUNK_SIZE) {
    const res = await createPasteSingle(content);
    if (res.ok) return res.url;
    // si erreur, renvoyer message d'erreur
    console.error("Worker error:", res);
    return `Erreur: ${res.error || "Impossible de créer le Gist."}`;
  }

  // Sinon split en morceaux
  const chunks = splitIntoChunks(content, MAX_CHUNK_SIZE);
  const urls = [];
  for (let i = 0; i < chunks.length; i++) {
    const header = `--- Part ${i+1}/${chunks.length} ---\n`;
    const chunkContent = header + chunks[i];
    const res = await createPasteSingle(chunkContent);
    if (!res.ok) {
      console.error("Worker chunk error:", res);
      return `Erreur: Échec lors de la création de la partie ${i+1}: ${res.error || res.detail || "unknown"}`;
    }
    urls.push(res.url);
  }

  // Retourne toutes les URLs séparées par des sauts de ligne
  return urls.join("\n");
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" introuvable.`;
  return buildName(jump);
}

function randomCommand() {
  if (!jumpDB || !tricksDB) return "Base de données non chargée.";
  const jumps = [...Object.values(jumpDB), ...tricksDB];
  if (!jumps.length) return "Aucun jump disponible.";
  const rand = jumps[Math.floor(Math.random() * jumps.length)];
  return buildName(rand);
}

async function listCommand(filters = "") {
  if (!jumpDB || !tricksDB) return "Base de données non chargée.";

  // Combine jumps + tricks
  let all = [
    ...Object.values(jumpDB).map(x => ({ name: buildName(x) })),
    ...tricksDB.map(t => ({ name: buildName(t) }))
  ];

  // Retirer entrées vides et dupliquer la normalisation
  all = all.map(o => ({ name: (o.name || "").trim() })).filter(o => o.name);

  // Filtre optionnel
  if (filters) {
    const f = filters.toLowerCase();
    all = all.filter(o => o.name.toLowerCase().includes(f));
  }

  if (!all.length) return "Aucune entrée trouvée pour ce filtre.";

  // Construire le texte final
  const header = "=== JUMPS & TRICKS ===\n";
  const lines = all.map(o => o.name);
  const output = header + lines.join("\n");

  // Optionnel: log de taille
  if (output.length > MAX_CHUNK_SIZE) {
    console.warn(`listCommand: output length ${output.length} > MAX_CHUNK_SIZE (${MAX_CHUNK_SIZE}). Will split.`);
  }

  // Envoi au Worker
  const link = await createPaste(output);
  return `Liste créée: ${link}`;
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
  await loadDatabases();

  if (!input || typeof input !== "string") return callback("Commande invalide.");
  if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");

  const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/(^")|("$)/g, ""));
  const cmd = args[0].substring(1).toLowerCase();
  const rest = args.slice(1);

  try {
    let res = "";

    switch (cmd) {
      case "info":
        if (!rest.length) res = "Usage: !info <nom du jump>";
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
        {
          const op = rest[0].toLowerCase();
          const batchName = rest[1];
          switch (op) {
            case "create": res = createBatch(batchName); break;
            case "add":
              if (rest.length < 3) res = "Usage: !batch add <batchName> <jumpName>";
              else res = addJumpToBatch(batchName, rest.slice(2).join(" "));
              break;
            case "finish": res = finishBatch(batchName); break;
            case "approve": res = approveBatch(batchName); break;
            default: res = "Opération batch inconnue.";
          }
        }
        break;

      default:
        res = "Commande inconnue.";
    }

    callback(res);
  } catch (err) {
    console.error("runCommand exception:", err);
    callback("Erreur interne lors de l'exécution de la commande.");
  }
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
