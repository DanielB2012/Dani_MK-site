// commands.js — Jumpmedia (Browser Version)

// ================== DATABASES ==================
let jumpDB = null;
let tricksDB = null;

const BATCHES = {};
const MAX_BATCH_NAME = 50;

// ================== UTILS ==================
function normalize(str) {
    return str.toLowerCase().trim();
}

async function loadDatabases() {
    if (!jumpDB) {
        const r1 = await fetch("Jumps-database/jump_data.json");
        jumpDB = await r1.json();
    }

    if (!tricksDB) {
        const r2 = await fetch("Jumps-database/tricks.json");
        tricksDB = await r2.json();
    }
}

// ================== FORMATTER ==================
function formatJump(jump) {
    let msg = `**${jump.name || "Unknown Jump"}**\n`;

    for (const [key, value] of Object.entries(jump)) {
        if (key === "name") continue;

        if (Array.isArray(value)) {
            msg += `${key}: ${value.join(", ")}\n`;
        } else {
            msg += `${key}: ${value}\n`;
        }
    }

    return msg.trim();
}

// ================== PARSERS ==================
function parseJumpData(jump) {
    // jump_data.json est déjà bien structuré
    return {
        name: jump.name,
        location: jump.location,
        diff: jump.diff,
        tier: jump.tier,
        server: jump.server,
        finder: jump.finder,
        prover: jump.prover,
        links: jump.links
    };
}

function parseTrick(trick) {
    const lines = trick.content.split("\n").map(l => l.trim());

    let name = "Unnamed";
    let location = [];

    if (lines[0].includes(" - ")) {
        const [n, loc] = lines[0].split(" - ");
        name = n.trim();
        location = [loc.trim()];
    } else {
        name = lines[0];
    }

    const jump = {
        name,
        location,
        server: "Database"
    };

    for (const line of lines.slice(1)) {
        if (line.startsWith("Difficulty:")) {
            jump.diff = line.replace("Difficulty:", "").trim();
        }
        else if (line.startsWith("Jump Type:") || line.startsWith("Type:")) {
            jump.type = line.replace(/Jump Type:|Type:/, "").trim();
        }
        else if (line.includes("Found")) {
            jump.finder = [
                line
                    .replace("Found & Proven by", "")
                    .replace("Found by", "")
                    .replace("Proven by", "")
                    .replace("From the Database", "")
                    .trim()
            ];
        }
    }

    if (trick.links) jump.links = trick.links;
    if (trick.descriptions) jump.notes = trick.descriptions;

    return jump;
}

// ================== SEARCH ==================
function getJump(name) {
    const search = normalize(name);

    // 1️⃣ jump_data.json
    if (jumpDB[search]) {
        return parseJumpData(jumpDB[search]);
    }

    // 2️⃣ tricks.json
    if (Array.isArray(tricksDB)) {
        for (const trick of tricksDB) {
            if (!trick.content) continue;
            const title = trick.content.split("\n")[0].toLowerCase();
            if (title.includes(search)) {
                return parseTrick(trick);
            }
        }
    }

    return null;
}

// ================== COMMANDS ==================
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return formatJump(jump);
}

function listCommand() {
    const list = Object.keys(jumpDB);
    localStorage.setItem("jump_list", JSON.stringify(list));
    window.open("list.html", "_blank");
    return "Opening list...";
}

// ================== BATCH COMMANDS ==================
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

    return `Batch "${batchName}" created.`;
}

function addJumpToBatch(batchName, jumpName, author = "WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[normalize(jumpName)] = jump;
    batch.log.push(`${author} added "${jumpName}".`);
    return `Jump "${jumpName}" added to batch.`;
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
    return `Batch "${batchName}" implemented.`;
}

// ================== RUN ==================
async function runCommand(input, callback) {
    await loadDatabases();

    if (!input.startsWith("!")) {
        callback("Commands must start with '!'");
        return;
    }

    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g)
        .map(a => a.replace(/"/g, ""));

    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";

    switch (cmd) {
        case "info":
            res = rest.length ? infoCommand(rest.join(" ")) : "Provide a jump name!";
            break;

        case "list":
            res = listCommand();
            break;

        case "batch":
            if (rest.length < 2) {
                res = "Usage: !batch <create|add|finish|approve> <name>";
                break;
            }
            const op = rest[0];
            const name = rest[1];

            if (op === "create") res = createBatch(name);
            else if (op === "add") res = addJumpToBatch(name, rest.slice(2).join(" "));
            else if (op === "finish") res = finishBatch(name);
            else if (op === "approve") res = approveBatch(name);
            else res = "Unknown batch operation.";
            break;

        default:
            res = "Unknown command.";
    }

    callback(res);
}

// ================== EXPORT ==================
window.runCommand = runCommand;
