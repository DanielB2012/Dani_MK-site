// commands.js
const fs = require("fs");
const path = require("path");
const shlex = require("shlex");

// ----------------- CONSTANTES -----------------
const PREFIX = "!";
const DATABASE_DIR = "./Jumps-database/";
const JUMP_FILE = path.join(DATABASE_DIR, "jump_data.json");
const TRICKS_FILE = path.join(DATABASE_DIR, "tricks.json");
const BATCH_DIR = path.join(DATABASE_DIR, "batches");
const MAX_BATCH_NAME = 50;

// Crée le dossier batches s'il n'existe pas
if (!fs.existsSync(BATCH_DIR)) fs.mkdirSync(BATCH_DIR, { recursive: true });

// ----------------- UTILITAIRES -----------------
function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function getJump(name) {
    name = name.toLowerCase();
    const jumpDB = loadJson(JUMP_FILE);
    if (jumpDB[name]) return jumpDB[name];
    const tricksDB = loadJson(TRICKS_FILE);
    if (tricksDB[name]) return tricksDB[name];
    return null;
}

// ----------------- COMMANDES DE BASE -----------------
function infoCommand(jumpName) {
    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    let msg = `**Info for ${jump.name || jumpName}:**\n`;
    for (const [key, val] of Object.entries(jump)) {
        if (key === "name") continue;
        msg += `- ${key}: ${val}\n`;
    }
    return msg;
}

function listCommand() {
    const jumpDB = loadJson(JUMP_FILE);
    const tricksDB = loadJson(TRICKS_FILE);
    const allJumps = { ...jumpDB, ...tricksDB };

    if (!Object.keys(allJumps).length) return "No jumps in database!";
    return Object.keys(allJumps).join("\n");
}

// ----------------- COMMANDES BATCH -----------------
function getBatchFile(batchName) {
    return path.join(BATCH_DIR, `${batchName}.json`);
}

function loadBatch(batchName) {
    const file = getBatchFile(batchName);
    if (!fs.existsSync(file)) return null;
    return loadJson(file);
}

function saveBatch(batchName, batchData) {
    saveJson(getBatchFile(batchName), batchData);
}

function createBatch(batchName, author) {
    if (batchName.length > MAX_BATCH_NAME) return "Batch name too long!";
    const file = getBatchFile(batchName);
    if (fs.existsSync(file)) return "Batch already exists!";

    const batch = {
        name: batchName,
        created_by: author,
        status: "unfinished",
        add: {},
        edit: {},
        rem: [],
        log: [`${author} created batch.`]
    };

    saveBatch(batchName, batch);
    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author) {
    const batch = loadBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    saveBatch(batchName, batch);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function approveBatch(batchName, author) {
    const batch = loadBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished before approval.";

    const db = loadJson(JUMP_FILE);

    // Remove jumps
    batch.rem.forEach(j => delete db[j.toLowerCase()]);
    // Edit jumps
    Object.entries(batch.edit).forEach(([name, data]) => db[name.toLowerCase()] = data);
    // Add jumps
    Object.entries(batch.add).forEach(([name, data]) => db[name.toLowerCase()] = data);

    saveJson(JUMP_FILE, db);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    saveBatch(batchName, batch);

    return `Batch "${batchName}" approved and implemented.`;
}

function finishBatch(batchName, author) {
    const batch = loadBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    saveBatch(batchName, batch);
    return `Batch "${batchName}" marked as finished.`;
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(message, sendResponse) {
    let content = message.content;
    if (!content.startsWith(PREFIX)) return;

    let args;
    try {
        args = shlex.split(content);
    } catch (e) {
        return sendResponse("Failed to parse command. Wrap multi-word arguments in quotes.");
    }

    const cmd = args[0].substring(PREFIX.length).toLowerCase();
    const rest = args.slice(1);

    switch(cmd) {
        case "info":
            if (!rest.length) return sendResponse("Provide a jump name!");
            return sendResponse(infoCommand(rest.join(" ")));

        case "list":
            return sendResponse(listCommand());

        case "batch":
            if (rest.length < 2) return sendResponse("Usage: !batch <operation> <batchName> [args]");
            const op = rest[0].toLowerCase();
            const batchName = rest[1];
            const author = message.author || "Unknown";

            switch(op) {
                case "create": return sendResponse(createBatch(batchName, author));
                case "add":
                    if (rest.length < 3) return sendResponse("Usage: !batch add <batchName> <jumpName>");
                    const jumpName = rest.slice(2).join(" ");
                    return sendResponse(addJumpToBatch(batchName, jumpName, author));
                case "finish": return sendResponse(finishBatch(batchName, author));
                case "approve": return sendResponse(approveBatch(batchName, author));
                default: return sendResponse("Unknown batch operation!");
            }

        default:
            return sendResponse("Unknown command!");
    }
}

// ----------------- EXPORT -----------------
module.exports = { runCommand, getJump };
