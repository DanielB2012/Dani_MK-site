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

    // Recherche dans jump_data.json
    if (jumpDB[lower]) return jumpDB[lower];

    // Recherche dans tricks.json
    for (const trick of tricksDB) {
        if (trick.content && trick.content.toLowerCase().includes(lower)) {
            return trick;
        }
    }

    return null;
}

// ----------------- FORMATTEUR TEXTE -----------------
function buildContent(jump) {
    // Si c'est un trick (tricks.json)
    if (jump.content) return jump.content.trim();

    let lines = [];

    // Titre
    if (jump.name && jump.location?.length) {
        lines.push(`${jump.name} - ${jump.location[0]}`);
    } else if (jump.name) {
        lines.push(jump.name);
    }

    // Difficulty
    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);

    // Type
    if (jump.type) lines.push(`Type: ${jump.type}`);
    else lines.push(`Type: Any`);

    // Found / Proven
    if (jump.finder && jump.prover) {
        lines.push(`Found & Proven by ${jump.prover}`);
    } else if (jump.finder) {
        lines.push(`Found by ${jump.finder}`);
    } else if (jump.prover) {
        lines.push(`Proven by ${jump.prover}`);
    }

    // Database
    lines.push("From the Database");

    // Links
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

function listCommand() {
    if (!jumpDB || !tricksDB) return "Database not loaded yet.";

    // --- Traiter jump_data.json ---
    const jumpList = Object.keys(jumpDB); // noms de jumps

    // --- Traiter tricks.json ---
    const trickList = tricksDB.map(trick => {
        if (trick.content) return trick.content.trim();
        return "Unnamed trick";
    });

    // --- Combine pour l'affichage ---
    const fullList = [
        "--- Jumps ---",
        ...jumpList,
        "--- Tricks ---",
        ...trickList
    ];

    // Stockage et ouverture dans list.html
    localStorage.setItem("jump_list", JSON.stringify(fullList));
    window.open("list.html", "_blank");
    return "Opening list...";
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

    // Implémente les ajouts/modifs
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

    switch(cmd) {
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

            switch(op) {
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
