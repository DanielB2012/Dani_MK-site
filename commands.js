// commands.js pour Jumpmedia (navigateur)
let jumpDB = null;
let tricksDB = null;
const BATCHES = {}; // Stockage temporaire des batches en mémoire
const MAX_BATCH_NAME = 50;

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
    if (jumpDB[lower]) return jumpDB[lower];
    if (tricksDB[lower]) return tricksDB[lower];
    return null;
}

function formatJump(jump) {
    let msg = `**Info for ${jump.name || "Unknown"}:**\n`;
    for (const [k, v] of Object.entries(jump)) {
        if (k === "name") continue;
        if (Array.isArray(v)) msg += `- ${k}: ${v.join(", ")}\n`;
        else msg += `- ${k}: ${v}\n`;
    }
    return msg;
}

// ----------------- COMMANDES DE BASE -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return formatJump(jump);
}

function listCommand() {
    if (!jumpDB) return "Database not loaded yet.";
    return Object.keys(jumpDB).join("\n");
}

// ----------------- COMMANDES BATCH -----------------
function createBatch(batchName, author="Unknown") {
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

function addJumpToBatch(batchName, jumpName, author="Unknown") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;
    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author="Unknown") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author="Unknown") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished before approval.";

    // Implémentation directe dans jumpDB (attention: modifie uniquement en mémoire)
    Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(input, callback) {
    await loadDatabases();

    if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");
    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";
    switch (cmd) {
        case "info":
            if (!rest.length) res = "Provide a jump name!";
            else res = infoCommand(rest.join(" "));
            break;
        case "list":
            res = listCommand();
            break;
        case "batch":
            if (rest.length < 2) {
                res = "Usage: !batch <create|add|finish|approve> <batchName> [args]";
                break;
            }
            const op = rest[0].toLowerCase();
            const batchName = rest[1];
            const author = "WebUser";
            switch (op) {
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
                    break;
            }
            break;
        default:
            res = "Unknown command!";
            break;
    }
    callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
window.jumpDB = jumpDB;
