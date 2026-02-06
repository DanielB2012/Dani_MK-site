// commands.js
const fs = require("fs");
const path = require("path");
const shlex = require("shlex");

// ----------------- CONSTANTES -----------------
const PREFIX = "!";
const DATABASE_DIR = "./Jumps-database/";
const JUMP_FILE = path.join(DATABASE_DIR, "jump_data.json");
const TRICKS_FILE = path.join(DATABASE_DIR, "tricks.json");
const MAX_BATCH_NAME = 50;

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
async function info(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    
    let msg = `**Info for ${jump.name || name}:**\n`;
    for (const [key, val] of Object.entries(jump)) {
        if (key === "name") continue;
        msg += `- ${key}: ${val}\n`;
    }
    return msg;
}

async function listJumps() {
    const jumpDB = loadJson(JUMP_FILE);
    if (!Object.keys(jumpDB).length) return "No jumps in database!";
    return Object.keys(jumpDB).join("\n");
}

// ----------------- COMMANDES BATCH -----------------
function createBatch(batchName, author) {
    const batchFile = path.join(DATABASE_DIR, "batches", `${batchName}.json`);
    if (fs.existsSync(batchFile)) return "Batch already exists!";
    
    const batchData = {
        name: batchName,
        created_by: author.username,
        status: "unfinished",
        add: {},
        edit: {},
        rem: [],
        log: []
    };
    saveJson(batchFile, batchData);
    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author) {
    const batchFile = path.join(DATABASE_DIR, "batches", `${batchName}.json`);
    if (!fs.existsSync(batchFile)) return `Batch "${batchName}" not found.`;
    
    const batch = loadJson(batchFile);
    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;
    
    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author.username} added jump ${jumpName}`);
    saveJson(batchFile, batch);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function approveBatch(batchName, author) {
    const batchFile = path.join(DATABASE_DIR, "batches", `${batchName}.json`);
    if (!fs.existsSync(batchFile)) return `Batch "${batchName}" not found.`;
    
    const batch = loadJson(batchFile);
    if (batch.status !== "finished") return "Batch must be finished before approval.";
    
    const db = loadJson(JUMP_FILE);
    // Remove jumps
    batch.rem.forEach(name => delete db[name.toLowerCase()]);
    // Edit jumps
    Object.entries(batch.edit).forEach(([name, data]) => {
        db[name.toLowerCase()] = data;
    });
    // Add jumps
    Object.entries(batch.add).forEach(([name, data]) => {
        db[name.toLowerCase()] = data;
    });

    saveJson(JUMP_FILE, db);

    batch.status = "implemented";
    batch.log.push(`${author.username} approved batch.`);
    saveJson(batchFile, batch);

    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(message) {
    const content = message.content;
    if (!content.startsWith(PREFIX)) return;
    
    let args;
    try {
        args = shlex.split(content);
    } catch (e) {
        return "Failed to parse command. Wrap multi-word arguments in quotes.";
    }
    
    const cmd = args[0].substring(PREFIX.length).toLowerCase();
    const rest = args.slice(1);

    switch(cmd) {
        case "info":
            if (!rest.length) return "Provide a jump name!";
            return message.channel.send(await info(rest.join(" ")));
        case "list":
            return message.channel.send(await listJumps());
        case "batch":
            if (!rest.length) return "Provide a batch operation!";
            const op = rest[0].toLowerCase();
            const batchName = rest[1];
            switch(op) {
                case "create":
                    return message.channel.send(createBatch(batchName, message.author));
                case "add":
                    const jumpName = rest.slice(2).join(" ");
                    return message.channel.send(addJumpToBatch(batchName, jumpName, message.author));
                case "approve":
                    return message.channel.send(approveBatch(batchName, message.author));
                default:
                    return message.channel.send("Unknown batch operation!");
            }
        default:
            return message.channel.send("Unknown command!");
    }
}

// ----------------- EXPORT -----------------
module.exports = { runCommand, getJump };
