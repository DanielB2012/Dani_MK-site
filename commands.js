// ----------------- DATABASES -----------------
let jumpDB = null;
let tricksDB = null;

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

// ----------------- FORMATTEUR -----------------
function buildContent(jump) {
    if (jump.content) return jump.content.trim();

    let lines = [];
    if (jump.name && jump.location?.length) lines.push(`${jump.name} - ${jump.location[0]}`);
    else if (jump.name) lines.push(jump.name);

    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);
    if (jump.type) lines.push(`Type: ${jump.type}`);
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

function listCommand(args) {
    if (!jumpDB) return "Database not loaded yet.";

    // Extraction des filtres (ex: diff low, type triple)
    const filtered = Object.values(jumpDB).filter(j => {
        let ok = true;
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i].toLowerCase();
            const val = args[i + 1]?.toLowerCase();
            if (!val) continue;
            if (key === "diff" && j.diff?.toLowerCase() !== val) ok = false;
            if (key === "type" && j.type?.toLowerCase() !== val) ok = false;
        }
        return ok;
    });

    // On garde juste les noms
    const jumpNames = filtered.map(j => j.name).filter(Boolean);

    if (!jumpNames.length) return "Aucun jump ne correspond aux critères.";

    return createPaste(jumpNames.join("\n"));
}

// ----------------- PASTE.EE -----------------
const PASTE_API_KEY = "aLFR1Zi3gkO91568g36WA7ZeGdi3ZUeIQ8KFDrW2s";
async function createPaste(content) {
    try {
        const resp = await fetch("https://api.paste.ee/v1/pastes", {
            method: "POST",
            headers: {
                "X-Auth-Token": PASTE_API_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                description: "Liste de jumps",
                sections: [{ name: "jumps", syntax: "text", contents: content }],
                expire: "1y"
            })
        });
        const data = await resp.json();
        if (data && data.link) {
            return `Résultat: Liste créée: <a href="${data.link}" target="_blank">${data.link}</a>`;
        } else {
            return "Résultat: Liste créée: Erreur: Impossible de créer le paste.";
        }
    } catch (e) {
        console.error(e);
        return "Résultat: Liste créée: Erreur: Impossible de créer le paste.";
    }
}

// ----------------- RUN COMMAND -----------------
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
            if (!rest.length) {
                // sans filtres
                const allNames = Object.values(jumpDB).map(j => j.name).filter(Boolean);
                res = await createPaste(allNames.join("\n"));
            } else {
                res = await listCommand(rest);
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
