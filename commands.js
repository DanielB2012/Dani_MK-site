const fs = require('fs');
const path = require('path');
const Discord = require('discord.js');

const PREFIX = "!";
let CLIENT; // sera assigné à ton client Discord.js

// === CONFIG / ROLES ===
const BOT_ADMINS = [/* ids */];
const BOT_MOD_ROLES = [/* ids */];
const GOD_TIER_RATER_ROLES = [/* ids */];

const MAX_BATCH_NAME = 50;
const BATCHES_DIR = "./data/batches/";
const DATABASE_DIR = "./data/jumps/";
const MAX_DISCORD_FILE_SIZE = 10_000_000; // ex: 10MB
const LOCATION_ORDER = [/* kingdom order */];
const DIFF_ORDER = ["Easy", "Medium", "Hard", "Unproven"];

// === PERMISSIONS CHECKS ===
function isAdmin(member) {
    return BOT_ADMINS.includes(member.id);
}

function isMod(member) {
    return member.roles.cache.some(role => BOT_MOD_ROLES.includes(role.id)) || isAdmin(member);
}

function isGodTierRater(member) {
    return member.roles.cache.some(role => GOD_TIER_RATER_ROLES.includes(role.id)) || isAdmin(member);
}

// === UTILS ===
function readJson(path) {
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function hashString(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
}

function strAuthor(member) {
    return `'${member.displayName}' (${member.id})`;
}

function timeToStr() {
    return new Date().toISOString();
}

// === BATCH FUNCTIONS ===
async function batchCommand(channelId, args, message) {
    const author = message.member;
    const operation = args[1]?.toLowerCase();

    if (!isMod(author)) return "You aren't authorized to use this command!";

    if (!operation) return "Please provide a batch operation!";

    // Switch-case operations
    switch(operation) {
        case "create":
            return batchCreate(args, author);
        case "list":
            return batchList();
        case "approve":
            return batchApprove(args, message);
        // TODO: add other operations: add/edit/rem/forget/status/log/info/nuke
        default:
            return `Unknown batch command \`${operation}\``;
    }
}

function batchCreate(args, author) {
    const batchName = args.slice(2).join(" ");
    const batchHash = hashString(batchName + Date.now());
    const batchPath = path.join(BATCHES_DIR, batchHash + ".json");

    if (fs.existsSync(batchPath)) return "Batch already exists!";

    const batchData = {
        name: batchName,
        hash: batchHash,
        created_at: timeToStr(),
        created_by: strAuthor(author),
        status: "unfinished",
        implemented_at: "TBD",
        log: [],
        add: {},
        edit: {},
        rem: []
    };

    batchData.log.push(`${strAuthor(author)} created batch`);
    writeJson(batchPath, batchData);

    return `**Batch "${batchName}" created!**`;
}

function batchList() {
    const files = fs.readdirSync(BATCHES_DIR);
    const batches = files.filter(f => f.endsWith(".json") && !f.endsWith("backup.json"))
                         .map(f => readJson(path.join(BATCHES_DIR, f)));

    if (!batches.length) return "No batches found!";

    const listStr = batches.map(b => `${b.name} | ${b.status} | ${b.created_at}`).join("\n");
    return "Batches:\n" + listStr;
}

async function batchApprove(args, message) {
    const author = message.member;
    if (!isAdmin(author)) return "You must be a Jumpedia Admin to approve a batch!";

    const batchNameOrHash = args[2];
    const batchPath = path.join(BATCHES_DIR, batchNameOrHash + ".json");
    const batchData = readJson(batchPath);
    if (!batchData) return "Batch not found!";

    if (batchData.status !== "finished") return "Batch must be finished before approval!";

    // === Copy database ===
    const db = readJson(path.join(DATABASE_DIR, "jump_data.json")) || {};
    writeJson(path.join(DATABASE_DIR, `jump_data_${Date.now()}.json`), db);

    // Remove jumps
    batchData.rem.forEach(name => delete db[name]);

    // Edit jumps
    for (const [name, edits] of Object.entries(batchData.edit)) {
        if (!db[name]) continue;
        Object.assign(db[name], edits);
    }

    // Add jumps
    Object.assign(db, batchData.add);

    // Save DB
    writeJson(path.join(DATABASE_DIR, "jump_data.json"), db);

    // Update batch
    batchData.status = "implemented";
    batchData.implemented_at = timeToStr();
    writeJson(batchPath, batchData);

    await message.channel.send(`# Batch approved!\nAll changes applied.`);
    // Optionally: regenerate lists
}

// === EXPORTS ===
module.exports = {
    batchCommand,
    isAdmin,
    isMod,
    isGodTierRater,
    readJson,
    writeJson
};
