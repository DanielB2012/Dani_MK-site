// =====================================================
// commands.js — Jumpmedia (Browser / GitHub Pages)
// =====================================================

// ----------------- DATABASES -----------------
let jumpDB = null;      // objet { "jump name": {...} }
let tricksDB = null;   // tableau [ { content, links, descriptions } ]

const BATCHES = {};
const MAX_BATCH_NAME = 50;

// ----------------- UTILS -----------------
function normalize(str) {
    return str
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ----------------- LOAD DATABASES -----------------
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

// ----------------- TRICKS PARSER -----------------
function parseTrick(trick) {
    const lines = trick.content.split("\n");

    // First line: "Name - Kingdom"
    let name = "Unnamed";
    let location = [];

    if (lines[0].includes(" - ")) {
        const [n, loc] = lines[0].split(" - ");
        name = n.trim();
        location = [loc.trim()];
    } else {
        name = lines[0].trim();
    }

    const jump = {
        name,
        location,
        source: "Tricks Database"
    };

    for (const line of lines.slice(1)) {
        if (line.startsWith("Difficulty:")) {
            jump.diff = line.replace("Difficulty:", "").trim();
        } 
        else if (line.startsWith("Jump Type:") || line.startsWith("Type:")) {
            jump.type = line.replace(/Jump Type:|Type:/, "").trim();
        } 
        else if (line.includes("Found")) {
            jump.finder = [line.replace("From the Database", "").trim()];
        }
    }

    if (trick.links) jump.links = trick.links;
    if (trick.descriptions) jump.notes = trick.descriptions;

    return jump;
}

// ----------------- GET JUMP -----------------
function getJump(name) {
    if (!jumpDB || !tricksDB) return null;

    const search = normalize(name);

    // 1️⃣ jump_data.json (clé exacte ou partielle)
    for (const key in jumpDB) {
        if (normalize(key).includes(search)) {
            return jumpDB[key];
        }
    }

    // 2️⃣ tricks.json (parser content)
    if (Array.isArray(tricksDB)) {
        for (const trick of tricksDB) {
            if (!trick.content) continue;
            const titleLine = normalize(trick.content.split("\n")[0]);
            if (titleLine.includes(search)) {
                return parseTrick(trick);
            }
        }
    }

    return null;
}

// ----------------- FORMAT OUTPUT -----------------
function formatJump(jump) {
    let msg = `**${jump.name || "Unknown Jump"}**\n`;

    for (const [k, v] of Object.entries(jump)) {
        if (k === "name") continue;

        if (Array.isArray(v)) {
            msg += `${k}: ${v.join(", ")}\n`;
        } else {
            msg += `${k}: ${v}\n`;
        }
    }

    return msg.trim();
}

// ----------------- COMMANDS -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return formatJump(jump);
}

function listCommand() {
    const list = Object.keys(jumpDB);
    localStorage.setItem("jump_list", JSON.stringify(list));
    window.open("list.html", "_blank");
    return "Opening jump list...";
}

// ----------------- BATCH COMMANDS -----------------
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

    return `Batch "${batchName}" created.`;
}

function addJumpToBatch(batchName, jumpName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[normalize(jumpName)] = jump;
    batch.log.push(`${author} added "${jumpName}".`);

    return `Jump added to batch "${batchName}".`;
}

function finishBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);

    return `Batch "${batchName}" marked finished.`;
}

function approveBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished first.";

    for (const [k, v] of Object.entries(batch.add)) {
        jumpDB[k] = v;
    }

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);

    return `Batch "${batchName}" approved.`;
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input, callback) {
    await loadDatabases();

    if (!input.startsWith("!")) {
        callback("Commands must start with '!'");
        return;
    }

    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g)
        .map(a => a.replace(/"/g, ""));

    const cmd = args[0].slice(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";

    switch (cmd) {
        case "info":
            if (!rest.length) res = "Usage: !info <jump name>";
            else res = infoCommand(rest.join(" "));
            break;

        case "list":
            res = listCommand();
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
            else res = "Unknown batch operation.";

            break;

        default:
            res = "Unknown command.";
    }

    callback(res);
}

// ----------------- EXPORT (GLOBAL) -----------------
window.runCommand = runCommand;
window.getJump = getJump;
