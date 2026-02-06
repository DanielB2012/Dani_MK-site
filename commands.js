// commands.js - version navigateur

// ----------------- CONSTANTES -----------------
const PREFIX = "!";
const DATABASE_DIR = "./Jumps-database/";
const JUMP_FILE = DATABASE_DIR + "jump_data.json";
const TRICKS_FILE = DATABASE_DIR + "tricks.json";
const BATCH_DIR = DATABASE_DIR + "batches";
const MAX_BATCH_NAME = 50;

// Stockage en mémoire pour navigateur
let jumpDB = {};
let tricksDB = {};
let batches = {}; // batchName -> batchData

// ----------------- UTILITAIRES -----------------
async function loadJson(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return {};
        return await res.json();
    } catch (e) {
        console.warn("Erreur fetch JSON:", url, e);
        return {};
    }
}

function saveJson(name, data) {
    // dans navigateur, on stocke juste en mémoire
    batches[name] = data;
}

function getJump(name) {
    name = name.toLowerCase();
    if (jumpDB[name]) return jumpDB[name];
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
    const allJumps = { ...jumpDB, ...tricksDB };
    if (!Object.keys(allJumps).length) return "No jumps in database!";
    return Object.keys(allJumps).join("\n");
}

// ----------------- COMMANDES BATCH -----------------
function getBatch(batchName) {
    return batches[batchName] || null;
}

function createBatch(batchName, author) {
    if (batchName.length > MAX_BATCH_NAME) return "Batch name too long!";
    if (batches[batchName]) return "Batch already exists!";

    const batch = {
        name: batchName,
        created_by: author,
        status: "unfinished",
        add: {},
        edit: {},
        rem: [],
        log: [`${author} created batch.`]
    };

    saveJson(batchName, batch);
    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author) {
    const batch = getBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    saveJson(batchName, batch);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author) {
    const batch = getBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    saveJson(batchName, batch);
    return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author) {
    const batch = getBatch(batchName);
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished before approval.";

    // Simule modification des jumps dans navigateur
    Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(j => delete jumpDB[j.toLowerCase()]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    saveJson(batchName, batch);

    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- RUN COMMAND -----------------
async function runCommand(message, callback) {
    // message peut être une string
    if (typeof message !== "string") return callback("Message invalide");

    // Charger les bases si ce n’est pas encore fait
    if (Object.keys(jumpDB).length === 0) jumpDB = await loadJson(JUMP_FILE);
    if (Object.keys(tricksDB).length === 0) tricksDB = await loadJson(TRICKS_FILE);

    let args;
    try {
        args = message.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g,""));
    } catch(e) {
        return callback("Failed to parse command. Wrap multi-word arguments in quotes.");
    }

    const cmd = args[0].substring(PREFIX.length).toLowerCase();
    const rest = args.slice(1);
    let res = "";

    switch(cmd){
        case "info":
            if(!rest.length) res = "Provide a jump name!";
            else res = infoCommand(rest.join(" "));
            break;
        case "list":
            res = listCommand();
            break;
        case "batch":
            if(rest.length < 2) { res = "Usage: !batch <operation> <batchName> [args]"; break; }
            const op = rest[0].toLowerCase();
            const batchName = rest[1];
            const author = "User";
            switch(op){
                case "create": res = createBatch(batchName, author); break;
                case "add": 
                    if(rest.length < 3) res = "Usage: !batch add <batchName> <jumpName>";
                    else res = addJumpToBatch(batchName, rest.slice(2).join(" "), author);
                    break;
                case "finish": res = finishBatch(batchName, author); break;
                case "approve": res = approveBatch(batchName, author); break;
                default: res = "Unknown batch operation!"; break;
            }
            break;
        default:
            res = "Unknown command!";
            break;
    }

    return callback(res);
}

// Exposer runCommand globalement
window.runCommand = runCommand;
</script>
