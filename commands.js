// commands.js pour Jumpmedia (navigateur)

// ================== DATABASES ==================
let jumpDB = null;
let tricksDB = null;

// ================== BATCH SYSTEM ==================
const BATCHES = {};
const MAX_BATCH_NAME = 50;

// ================== LOAD DATABASES ==================
async function loadDatabases() {
    if (!jumpDB) {
        const resp = await fetch("Jumps-database/jump_data.json");
        if (!resp.ok) throw new Error("Failed to load jump_data.json");
        jumpDB = await resp.json();
    }

    if (!tricksDB) {
        const resp = await fetch("Jumps-database/tricks.json");
        if (!resp.ok) throw new Error("Failed to load tricks.json");
        tricksDB = await resp.json();
    }
}

// ================== UTILITIES ==================
function normalize(str) {
    return str.toLowerCase().trim();
}

function getJump(name) {
    if (!jumpDB || !tricksDB) return null;
    const key = normalize(name);

    if (jumpDB[key]) return jumpDB[key];

    // tricks.json est un tableau, pas un objet
    if (Array.isArray(tricksDB)) {
        for (const t of tricksDB) {
            if (!t.content) continue;
            if (t.content.toLowerCase().includes(key)) return t;
        }
    }

    return null;
}

function formatJump(jump) {
    let msg = `<strong>${jump.name || "Unnamed"}</strong><br>`;

    for (const [k, v] of Object.entries(jump)) {
        if (k === "name") continue;

        if (Array.isArray(v)) {
            msg += `<b>${k}:</b> ${v.join(", ")}<br>`;
        } else {
            msg += `<b>${k}:</b> ${v}<br>`;
        }
    }

    return msg;
}

// ================== BASIC COMMANDS ==================
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return formatJump(jump);
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

    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author = "WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;

    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;

    batch.add[normalize(jumpName)] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);

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
    if (batch.status !== "finished") return "Batch must be finished before approval.";

    Object.entries(batch.add).forEach(([name, data]) => {
        jumpDB[name] = data;
    });

    batch.rem.forEach(name => delete jumpDB[name]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);

    return `Batch "${batchName}" approved and implemented.`;
}

// ================== RUN COMMAND ==================
async function runCommand(input, callback) {
    try {
        await loadDatabases();
    } catch (e) {
        console.error(e);
        return callback("Failed to load databases.");
    }

    if (!input.startsWith("!")) {
        return callback("Command must start with '!'");
    }

    const args = input
        .match(/(?:[^\s"]+|"[^"]*")+/g)
        .map(a => a.replace(/"/g, ""));

    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";

    switch (cmd) {

        case "info":
            if (!rest.length) res = "Usage: !info <jump name>";
            else res = infoCommand(rest.join(" "));
            break;

        case "list": {
            const list = Object.keys(jumpDB);
            localStorage.setItem("jump_list", JSON.stringify(list));
            window.open("list.html", "_blank");
            res = "Opening jump list...";
            break;
        }

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
                    if (rest.length < 3) {
                        res = "Usage: !batch add <batchName> <jumpName>";
                        break;
                    }
                    res = addJumpToBatch(batchName, rest.slice(2).join(" "), author);
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

// ================== EXPORT ==================
window.runCommand = runCommand;
window.getJump = getJump;
