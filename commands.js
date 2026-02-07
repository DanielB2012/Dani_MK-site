// commands.js pour Jumpmedia (navigateur)
let jumpDB = null;
let tricksDB = null;
const BATCHES = {}; 
const MAX_BATCH_NAME = 50;
const PASTEE_API_KEY = "aLFR1Zi3gkO91568g36WA7ZeGdi3ZUeIQ8KFDrW2s";

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
    for (const trick of tricksDB) {
        if (trick.content && trick.content.toLowerCase().includes(lower)) {
            return trick;
        }
    }
    return null;
}

function buildContent(jump) {
    if (jump.content) return jump.content.trim();
    let lines = [];
    if (jump.name && jump.location?.length) lines.push(`${jump.name} - ${jump.location[0]}`);
    else if (jump.name) lines.push(jump.name);
    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);
    if (jump.type) lines.push(`Type: ${jump.type}`);
    else lines.push("Type: Any");
    if (jump.finder && jump.prover) lines.push(`Found & Proven by ${jump.prover}`);
    else if (jump.finder) lines.push(`Found by ${jump.finder}`);
    else if (jump.prover) lines.push(`Proven by ${jump.prover}`);
    lines.push("From the Database");
    if (jump.links) {
        if (Array.isArray(jump.links)) jump.links.forEach(l => lines.push(l));
        else lines.push(jump.links);
    }
    return lines.join("\n");
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return buildContent(jump);
}

function listCommand(filterFunc = null) {
    if (!jumpDB) return "Database not loaded yet.";
    let jumpNames = Object.values(jumpDB).map(j => j.name);
    if (filterFunc) jumpNames = jumpNames.filter(filterFunc);
    return createPaste(jumpNames.join("\n"));
}

// ----------------- BATCHS -----------------
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
    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" not found.`;
    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" not found.`;
    if (batch.status !== "finished") return "Batch must be finished before approval.";
    Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);
    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- PASTEE -----------------
async function createPaste(content) {
    try {
        const resp = await fetch("https://cors.isomorphic-git.org/https://paste.ee/api", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": PASTEE_API_KEY
            },
            body: JSON.stringify({
                description: "Jumpedia List",
                sections: [{ name: "Jump Names", contents: content }],
                expire: "1year"
            })
        });
        const data = await resp.json();
        if (!data || !data.link) throw new Error("Paste creation failed");
        return `<a href="${data.link}" target="_blank">${data.link}</a>`;
    } catch (e) {
        return "Erreur: Impossible de créer le paste.";
    }
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(input, callback) {
    await loadDatabases();
    if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");

    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res = "";

    switch(cmd) {
        case "info":
            if (!rest.length) res = "Provide a jump name!";
            else res = infoCommand(rest.join(" "));
            break;

        case "list":
            // Filtrage simple diff/type pour demo
            let filterFunc = null;
            if (rest.includes("diff") || rest.includes("ty")) {
                filterFunc = jName => {
                    const jump = getJump(jName);
                    if (!jump) return false;
                    let ok = true;
                    for (let i = 0; i < rest.length; i++) {
                        if (rest[i] === "diff" && rest[i+1]) ok = ok && (jump.diff?.toLowerCase() === rest[i+1].toLowerCase());
                        if (rest[i] === "ty" && rest[i+1]) ok = ok && (jump.type?.toLowerCase() === rest[i+1].toLowerCase());
                    }
                    return ok;
                };
            }
            res = await listCommand(filterFunc);
            res = `Résultat: Liste créée: ${res}`;
            break;

        case "batch":
            if (rest.length < 2) {
                res = "Usage: !batch <create|add|finish|approve> <batchName> [args]";
                break;
            }
            const op = rest[0].toLowerCase();
            const batchName = rest[1];
            const author = "WebUser";
            switch(op) {
                case "create": res = createBatch(batchName, author); break;
                case "add":
                    if (rest.length < 3) { res = "Usage: !batch add <batchName> <jumpName>"; break; }
                    const jumpName = rest.slice(2).join(" ");
                    res = addJumpToBatch(batchName, jumpName, author);
                    break;
                case "finish": res = finishBatch(batchName, author); break;
                case "approve": res = approveBatch(batchName, author); break;
                default: res = "Unknown batch operation!";
            }
            break;

        default:
            res = "Unknown command!";
    }

    callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
