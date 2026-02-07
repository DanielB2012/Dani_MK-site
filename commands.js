// commands.js pour Jumpmedia (navigateur)
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
        if (trick.content && trick.content.toLowerCase().includes(lower)) return trick;
    }
    return null;
}

// ----------------- COMMANDES -----------------
function helpCommand() {
    return "Available commands: help, info, list, missing, give, del/rem, proof, rate, ratings, donate, typedyno, batch, genlists, top100, random, backup, channelconf";
}

function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    let lines = [];
    if (jump.name) lines.push(jump.name);
    if (jump.diff) lines.push(`Difficulty: ${jump.diff}`);
    if (jump.tier) lines.push(`Tier: ${jump.tier}`);
    if (jump.finder) lines.push(`Found by ${jump.finder}`);
    if (jump.prover) lines.push(`Proven by ${jump.prover}`);
    return lines.join("\n");
}

function listCommand() {
    if (!jumpDB) return "Database not loaded yet.";
    const jumpList = Object.values(jumpDB).map(j => j.name);
    return jumpList.join("\n");
}

function missingCommand() {
    return "Missing command executed (logic TBD)";
}

function giveCommand() {
    return "Give command executed (logic TBD)";
}

function delCommand() {
    return "Del/Rem command executed (logic TBD)";
}

function proofCommand() {
    return "Proof command executed (logic TBD)";
}

function rateCommand() {
    return "Rate command executed (logic TBD)";
}

function ratingsCommand() {
    return "Ratings command executed (logic TBD)";
}

function donateCommand() {
    return "**To the donation page:**\nhttps://paypal.me/JumpediaBot";
}

function typedynoCommand() {
    return "Typedyno command executed (logic TBD)";
}

function batchCommand() {
    return "Batch command executed (logic TBD)";
}

function genlistsCommand() {
    return "Genlists command executed (logic TBD)";
}

function top100Command() {
    return "Top100 command executed (logic TBD)";
}

function randomCommand() {
    return "Random command executed (logic TBD)";
}

function backupCommand() {
    return "Backup command executed (logic TBD)";
}

function channelconfCommand() {
    return "Channelconf command executed (logic TBD)";
}

function subrateCommand() {
    return "Subrate command executed (logic TBD)";
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
        case "help": res = helpCommand(); break;
        case "info": res = rest.length ? infoCommand(rest.join(" ")) : "Provide a jump name!"; break;
        case "list": res = listCommand(); break;
        case "missing": res = missingCommand(); break;
        case "give": res = giveCommand(); break;
        case "del":
        case "rem": res = delCommand(); break;
        case "proof": res = proofCommand(); break;
        case "rate": res = rateCommand(); break;
        case "ratings": res = ratingsCommand(); break;
        case "donate": res = donateCommand(); break;
        case "typedyno": res = typedynoCommand(); break;
        case "batch": res = batchCommand(); break;
        case "genlist":
        case "genlists": res = genlistsCommand(); break;
        case "top100": res = top100Command(); break;
        case "random": res = randomCommand(); break;
        case "backup": res = backupCommand(); break;
        case "channelconf": res = channelconfCommand(); break;
        case "subrate": res = subrateCommand(); break;
        default: res = "Unknown command!";
    }

    callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
