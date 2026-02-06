// commands.js
const fs = require('fs');
const path = require('path');
const { Client, MessageAttachment } = require('discord.js');
const shlex = require('shlex'); // ou une lib similaire pour parser comme shell

const PREFIX = "!";
const DATABASE_DIR = "./data/jumps/";
const TRICKS_FILE = "./data/tricks.json";
const BATCHES_DIR = "./data/batches/";
const MAX_BATCH_NAME = 50;
const MAX_DISCORD_MSG_LEN = 2000;

// ----------------- UTILITAIRES -----------------
function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getJump(name) {
    name = name.toLowerCase();
    const jumpDB = loadJson(path.join(DATABASE_DIR, "jump_data.json"));
    if (jumpDB[name]) return jumpDB[name];
    const tricksDB = loadJson(TRICKS_FILE);
    if (tricksDB[name]) return tricksDB[name];
    return null;
}

function isAdmin(author) {
    const BOT_ADMINS = [/* id admin ici */];
    return BOT_ADMINS.includes(author.id);
}

function isMod(author) {
    const BOT_MODS = [/* id mod ici */];
    if (isAdmin(author)) return true;
    return author.roles.cache.some(r => BOT_MODS.includes(r.id));
}

function formatJump(jump) {
    return Object.entries(jump).map(([k,v]) => `${k}: ${v}`).join(" | ");
}

// ----------------- COMMANDES -----------------

async function info(jumpName) {
    const jump = getJump(jumpName);
    if (!jump) return "Jump not found!";
    return `**${jump.name}**\n${formatJump(jump)}`;
}

function listJumps() {
    const jumpDB = loadJson(path.join(DATABASE_DIR, "jump_data.json"));
    return Object.keys(jumpDB).join("\n") || "No jumps in database!";
}

// ----------------- BATCH -----------------
function getBatch(nameOrHash) {
    const files = fs.readdirSync(BATCHES_DIR);
    for (const file of files) {
        if (!file.endsWith(".json") || file.endsWith("backup.json")) continue;
        const batchData = loadJson(path.join(BATCHES_DIR, file));
        if (batchData.hash === nameOrHash || batchData.name.toLowerCase() === nameOrHash.toLowerCase()) {
            return batchData;
        }
    }
    return null;
}

function saveBatch(batch) {
    saveJson(path.join(BATCHES_DIR, `${batch.hash}.json`), batch);
}

function batchCreate(name, author) {
    const newHash = Date.now().toString(36); // simple hash
    const batchData = {
        name, hash: newHash, status: "unfinished", created_by: author.username,
        add: {}, edit: {}, rem: [], log: [],
        created_at: new Date().toISOString(),
        implemented_at: "TBD"
    };
    saveBatch(batchData);
    return `Batch "${name}" created!`;
}

function batchAdd(batchName, jumpName, jumpData, author) {
    const batch = getBatch(batchName);
    if (!batch) return "Batch not found!";
    batch.add[jumpName.toLowerCase()] = jumpData;
    batch.log.push(`${author.username} adds jump ${jumpName}`);
    saveBatch(batch);
    return `Jump ${jumpName} added to batch "${batchName}"`;
}

function batchApprove(batchName, author) {
    if (!isAdmin(author)) return "Only admins can approve batches!";
    const batch = getBatch(batchName);
    if (!batch) return "Batch not found!";
    if (batch.status !== "finished") return "Batch must be finished before approval!";
    
    // Charger la DB
    const db = loadJson(path.join(DATABASE_DIR, "jump_data.json"));

    // Remove jumps
    for (const j of batch.rem) delete db[j.toLowerCase()];

    // Edit jumps
    for (const [name, data] of Object.entries(batch.edit)) {
        const jumpName = data.name ? data.name.toLowerCase() : name.toLowerCase();
        db[jumpName] = data;
    }

    // Add jumps
    for (const [name, data] of Object.entries(batch.add)) {
        db[name.toLowerCase()] = data;
    }

    // Save DB
    saveJson(path.join(DATABASE_DIR, "jump_data.json"), db);

    batch.status = "implemented";
    batch.implemented_at = new Date().toISOString();
    saveBatch(batch);

    return `Batch "${batchName}" approved and implemented!`;
}

// ----------------- RUN -----------------
async function run(message, client) {
    const content = message.content.replace(/“|”|«|»|„|‟/g, '"').replace(/‘|’|‚|‛|‹|›/g, "'");
    if (!content.startsWith(PREFIX)) return;

    const args = shlex.split(content);
    const cmd = args[0].substring(PREFIX.length).toLowerCase();

    switch(cmd) {
        case "info": return message.channel.send(await info(args.slice(1).join(" ")));
        case "list": return message.channel.send(listJumps());
        case "batchcreate": return message.channel.send(batchCreate(args[1], message.author));
        case "batchadd": 
            const jumpData = {}; // ici tu dois parser les attributs depuis args
            return message.channel.send(batchAdd(args[1], args[2], jumpData, message.author));
        case "batchapprove": return message.channel.send(batchApprove(args[1], message.author));
        default: return message.channel.send("Command not found!");
    }
}

// ----------------- EXPORT -----------------
module.exports = { run, getJump };
