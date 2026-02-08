// ----------------- DATABASES -----------------
let jumpDB = null;
let tricksDB = null;

const BATCHES = {};
const MAX_BATCH_NAME = 50;

// ----------------- LOAD DATABASES -----------------
async function loadDatabases() {
    if (!jumpDB) {
        const resp = await fetch("Jumps-database/jump_data.json");
        jumpDB = await resp.json();
    }

    if (!tricksDB) {
        const resp = await fetch("Jumps-database/tricks.json");
        tricksDB = await resp.json();
    }
}

// ----------------- GET JUMP -----------------
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

// ----------------- FORMAT FULL INFO -----------------
function buildContent(jump) {
    if (jump.content) return jump.content.trim();

    let lines = [];

    if (jump.name) lines.push(jump.name);
    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);
    if (jump.type) lines.push(`Type: ${jump.type}`);
    if (jump.finder) lines.push(`Found by ${jump.finder}`);
    if (jump.prover) lines.push(`Proven by ${jump.prover}`);

    return lines.join("\n");
}

// ----------------- PASTE.RS -----------------
async function createPaste(content) {
    try {
        const resp = await fetch("https://paste.rs/", {
            method: "POST",
            body: content
        });

        if (!resp.ok) {
            console.error("paste.rs HTTP error:", resp.status);
            return "Erreur: Impossible de créer le paste.";
        }

        const url = await resp.text();
        return url.trim();
    } catch (err) {
        console.error("paste.rs exception:", err);
        return "Erreur: Impossible de créer le paste.";
    }
}

// ----------------- COMMANDS -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return buildContent(jump);
}

function randomCommand() {
    if (!jumpDB) return "Database not loaded yet.";

    const all = Object.values(jumpDB);
    const rand = all[Math.floor(Math.random() * all.length)];
    return buildContent(rand);
}

// ----------------- LIST COMMAND (JUMPS + TRICKS / NAMES ONLY) -----------------
async function listCommand(filters = "") {
    if (!jumpDB || !tricksDB) return "Database not loaded yet.";

    // JUMPS NAMES
    let jumpNames = Object.values(jumpDB)
        .map(j => j.name)
        .filter(Boolean);

    // TRICKS NAMES
    let trickNames = tricksDB
        .map(t => t.name || t.content)
        .filter(Boolean);

    let allNames = [
        "=== JUMPS ===",
        ...jumpNames,
        "",
        "=== TRICKS ===",
        ...trickNames
    ];

    if (filters) {
        const f = filters.toLowerCase();
        allNames = allNames.filter(line =>
            line.startsWith("===") || line.toLowerCase().includes(f)
        );
    }

    const pasteContent = allNames.join("\n");
    const link = await createPaste(pasteContent);

    return `Liste créée: ${link}`;
}

// ----------------- BATCH SYSTEM -----------------
function createBatch(batchName, author = "WebUser") {
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

function addJumpToBatch(batchName, jumpName, author = "WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added "${jumpName}".`);

    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author = "WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);

    return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author = "WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished first.";

    Object.entries(batch.add).forEach(([k, v]) => jumpDB[k] = v);
    Object.entries(batch.edit).forEach(([k, v]) => jumpDB[k] = v);
    batch.rem.forEach(k => delete jumpDB[k]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);

    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
    await loadDatabases();

    if (!input.startsWith("!")) {
        callback("Commande doit commencer par '!'");
        return;
    }

    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res;

    switch (cmd) {
        case "info":
            res = rest.length ? infoCommand(rest.join(" ")) : "Provide a jump name!";
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
                res = "Usage: !batch <create|add|finish|approve> <batchName>";
                break;
            }

            const op = rest[0];
            const batchName = rest[1];

            if (op === "create") res = createBatch(batchName);
            else if (op === "add") res = addJumpToBatch(batchName, rest.slice(2).join(" "));
            else if (op === "finish") res = finishBatch(batchName);
            else if (op === "approve") res = approveBatch(batchName);
            else res = "Unknown batch operation!";

            break;

        default:
            res = "Unknown command!";
    }

    callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
