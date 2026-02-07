// commands.js pour Jumpmedia (navigateur)
let jumpDB = null;
let tricksDB = null;
const BATCHES = {}; // Stockage temporaire des batches en mémoire
const MAX_BATCH_NAME = 50;

// ----------------- CONFIG PASTEE -----------------
const PASTEE_API_KEY = "aLFR1Zi3gkO91568g36WA7ZeGdi3ZUeIQ8KFDrW2s";
const PASTEE_API_URL = "https://paste.ee/api";

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

    // Recherche dans jump_data.json
    if (jumpDB[lower]) return jumpDB[lower];

    // Recherche dans tricks.json
    for (const trick of tricksDB) {
        if (trick.content && trick.content.toLowerCase().includes(lower)) {
            return trick;
        }
    }

    return null;
}

// ----------------- FORMATTEUR TEXTE -----------------
function buildContent(jump) {
    // Si c'est un trick (tricks.json)
    if (jump.content) return jump.content.trim();

    let lines = [];

    // Titre
    if (jump.name && jump.location?.length) {
        lines.push(`${jump.name} - ${jump.location[0]}`);
    } else if (jump.name) {
        lines.push(jump.name);
    }

    // Difficulty
    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);

    // Type
    if (jump.type) lines.push(`Type: ${jump.type}`);
    else lines.push("Type: Any");

    // Found / Proven
    if (jump.finder && jump.prover) {
        lines.push(`Found & Proven by ${jump.prover}`);
    } else if (jump.finder) {
        lines.push(`Found by ${jump.finder}`);
    } else if (jump.prover) {
        lines.push(`Proven by ${jump.prover}`);
    }

    // Database
    lines.push("From the Database");

    // Links
    if (jump.links) {
        if (Array.isArray(jump.links)) jump.links.forEach(l => lines.push(l));
        else lines.push(jump.links);
    }

    return lines.join("\n");
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return buildContent(jump);
}

function randomCommand() {
    if (!jumpDB) return "Database not loaded yet.";
    const jumps = Object.values(jumpDB);
    if (!jumps.length) return "No jumps available.";
    const jump = jumps[Math.floor(Math.random() * jumps.length)];
    return buildContent(jump);
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

    // Implémente les ajouts/modifs
    Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- LISTE VERS PASTEE -----------------
async function listCommand(filters = {}) {
    if (!jumpDB) return "Database not loaded yet.";

    // Filtrer et ne garder que les noms
    let output = Object.values(jumpDB)
        .filter(j => {
            let ok = true;
            if (filters.diff) ok = ok && j.diff && j.diff.toLowerCase() === filters.diff.toLowerCase();
            if (filters.type) ok = ok && j.type && j.type.toLowerCase() === filters.type.toLowerCase();
            return ok;
        })
        .map(j => j.name)
        .join("\n");

    if (!output) return "Aucun jump trouvé pour ces critères.";

    // Expiration 1 an
    const expiresDate = new Date();
    expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    const expiresStr = expiresDate.toISOString();

    try {
        const resp = await fetch(PASTEE_API_URL, {
            method: "POST",
            headers: {
                "X-Auth-Token": PASTEE_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                description: "Liste des jumps",
                sections: [{ name: "Jumps", syntax: "autodetect", contents: output }],
                visibility: 1,      // non listé
                expires: expiresStr
            })
        });

        const data = await resp.json();
        if (data && data.link) {
            return `Résultat: Liste créée: <a href="${data.link}" target="_blank">${data.link}</a>`;
        }
        return "Résultat: Erreur: Impossible de créer le paste.";
    } catch (err) {
        return "Résultat: Erreur: Impossible de créer le paste.";
    }
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(input, callback) {
    await loadDatabases();

    if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");

    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";

    switch(cmd) {
        case "info":
            if (!rest.length) res = "Provide a jump name!";
            else res = infoCommand(rest.join(" "));
            break;

        case "random":
            res = randomCommand();
            break;

        case "list":
            // Analyse des filtres
            let filters = {};
            for (let i = 0; i < rest.length; i++) {
                if (rest[i].toLowerCase() === "only") {
                    const key = rest[i+1]?.toLowerCase();
                    const value = rest[i+2]?.toLowerCase();
                    if (key === "diff") filters.diff = value;
                    if (key === "ty" || key === "type") filters.type = value;
                    i += 2;
                }
            }
            res = await listCommand(filters);
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
