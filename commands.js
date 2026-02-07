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

    // Type uniquement (tier supprimé)
    if (jump.type) lines.push(`Type: ${jump.type}`);
    else lines.push("Type: Any");

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
    if (!jumpDB) return "Database not loaded yet.";

    // Noms des jumps uniquement depuis jump_data.json
    const jumpList = Object.values(jumpDB).map(j => j.name);

    localStorage.setItem("jump_list", JSON.stringify(jumpList));
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
    if (!jump) return `Jump
