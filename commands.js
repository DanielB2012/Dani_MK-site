// commands.js pour Jumpmedia (Navigateur)
let jumpDB = null;
let tricksDB = null;
const BATCHES = {};
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

    for (const trick of tricksDB) {
        if (trick.content && trick.content.toLowerCase().includes(lower)) {
            return trick;
        }
    }
    return null;
}

// ----------------- FORMATTEUR TEXTE -----------------
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

// ----------------- PASTE.EE -----------------
async function createPasteEE(content) {
    const data = {
        sections: [{ name: "Jumpedia List", syntax: "autodetect", contents: content }],
        expire: "1week"
    };

    try {
        const resp = await fetch("https://api.paste.ee/v1/pastes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Auth-Token": "VOTRE_CLE_API_PASTEEE" // <-- Remplace par ta clé
            },
            body: JSON.stringify(data)
        });

        const json = await resp.json();
        if (json && json.link) return json.link;
        return "Erreur lors de la création du paste.";
    } catch (e) {
        return "Erreur réseau lors de la création du paste.";
    }
}

// ----------------- LISTE ET MISSING -----------------
function generateListText(args) {
    // Ici on applique tous les filtres/rest de la commande !list ou !missing
    // Pour simplifier exemple : on liste juste tous les noms
    const filtered = Object.values(jumpDB || {}).map(j => `${j.name} | ${j.type || "Any"} | Diff: ${j.diff || "N/A"}`);
    return filtered.join("\n");
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return buildContent(jump);
}

function randomCommand() {
    const allJumps = Object.values(jumpDB || {});
    if (!allJumps.length) return "Database vide.";
    const jump = allJumps[Math.floor(Math.random() * allJumps.length)];
    return buildContent(jump);
}

// ----------------- BATCHS -----------------
function createBatch(batchName, author="WebUser") {
    if (batchName.length > MAX_BATCH_NAME) return "Batch name trop long !";
    if (BATCHES[batchName]) return "Batch déjà existant !";
    BATCHES[batchName] = { name: batchName, created_by: author, status:"unfinished", add:{}, edit:{}, rem:[], log:[`${author} created batch.`] };
    return `Batch "${batchName}" créé !`;
}

function addJumpToBatch(batchName, jumpName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" non trouvé.`;
    const jump = getJump(jumpName);
    if (!jump) return `Jump "${jumpName}" non trouvé.`;
    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    return `Jump "${jumpName}" ajouté au batch "${batchName}".`;
}

function finishBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" non trouvé.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    return `Batch "${batchName}" marqué comme terminé.`;
}

function approveBatch(batchName, author="WebUser") {
    const batch = BATCHES[batchName];
    if (!batch) return `Batch "${batchName}" non trouvé.`;
    if (batch.status !== "finished") return "Batch doit être terminé avant approbation.";

    Object.entries(batch.add).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name, data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);

    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approuvé et appliqué.`;
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(input, callback) {
    await loadDatabases();
    if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");
    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    switch(cmd) {
        case "help": callback("Voir la documentation: https://github.com/JoniKauf/JumpediaOld/blob/main/README.md"); break;
        case "info": callback(rest.length ? infoCommand(rest.join(" ")) : "Donnez un nom de jump !"); break;
        case "random": callback(randomCommand()); break;

        case "list":
        case "missing":
            {
                const listText = generateListText(rest);
                createPasteEE(listText).then(link => callback(`Liste créée: <a href="${link}" target="_blank">${link}</a>`));
            }
            break;

        case "give": callback("Commande give non implémentée dans l'exemple"); break;
        case "proof": callback("Commande proof non implémentée dans l'exemple"); break;
        case "rate": callback("Commande rate non implémentée dans l'exemple"); break;
        case "ratings": callback("Commande ratings non implémentée dans l'exemple"); break;
        case "top100": callback("Commande top100 non implémentée dans l'exemple"); break;
        case "donate": callback("Faire un don: https://www.paypal.com/donate/example"); break;

        case "batch":
            if(rest.length < 2) return callback("Usage: !batch <create|add|finish|approve> <batchName> [args]");
            const op = rest[0].toLowerCase(), batchName = rest[1], author="WebUser";
            switch(op){
                case "create": callback(createBatch(batchName, author)); break;
                case "add":
                    if(rest.length < 3) return callback("Usage: !batch add <batchName> <jumpName>");
                    callback(addJumpToBatch(batchName, rest.slice(2).join(" "), author));
                    break;
                case "finish": callback(finishBatch(batchName, author)); break;
                case "approve": callback(approveBatch(batchName, author)); break;
                default: callback("Opération batch inconnue !"); break;
            }
            break;

        default: callback("Commande inconnue !");
    }
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
