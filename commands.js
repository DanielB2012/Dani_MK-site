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

// ----------------- COMMANDES -----------------
function helpCommand() {
    return "See the full commands list here: https://github.com/JoniKauf/JumpediaOld/blob/main/README.md#channelconf-command";
}

function infoCommand(name) {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    return buildContent(jump);
}

function randomCommand() {
    if (!jumpDB) return "Database not loaded yet.";
    const allJumps = Object.values(jumpDB);
    if (!allJumps.length) return "No jumps available.";
    const jump = allJumps[Math.floor(Math.random() * allJumps.length)];
    return buildContent(jump);
}

function giveCommand(name, proofLink=null, user="WebUser") {
    const jump = getJump(name);
    if (!jump) return `Jump "${name}" not found.`;
    const userData = JSON.parse(localStorage.getItem("user_data")||"{}");
    userData[user] = userData[user]||{};
    userData[user][jump.name] = proofLink||"";
    localStorage.setItem("user_data", JSON.stringify(userData));
    return proofLink ? `Jump "${name}" added with proof.` : `Jump "${name}" added.`;
}

function proofCommand(op, name, link=null, user="WebUser") {
    const userData = JSON.parse(localStorage.getItem("user_data")||"{}");
    userData[user] = userData[user]||{};
    if (op==="get") {
        return userData[user][name] || "No proof set.";
    } else if (op==="set" && link) {
        userData[user][name] = link;
        localStorage.setItem("user_data", JSON.stringify(userData));
        return `Proof set for "${name}".`;
    }
    return "Invalid proof command.";
}

function remCommand(name, user="WebUser") {
    const userData = JSON.parse(localStorage.getItem("user_data")||"{}");
    if (userData[user]?.[name]) {
        delete userData[user][name];
        localStorage.setItem("user_data", JSON.stringify(userData));
        return `Jump "${name}" removed from your list.`;
    }
    return `Jump "${name}" not in your list.`;
}

function listCommand(args=[]) {
    if (!jumpDB) return "Database not loaded yet.";

    // ---- Appliquer filtres ----
    let list = Object.values(jumpDB);
    const filters = {};
    const sorts = [];

    for (let i=0; i<args.length; i++) {
        if (args[i]==="only" && args[i+1]) {
            const key = args[i+1].toLowerCase();
            const value = args[i+2]||"";
            filters[key] = value;
            i+=2;
        }
        if (args[i]==="sort" && args[i+1]) {
            sorts.push(args[i+1]);
            i++;
        }
    }

    list = list.filter(j => {
        for (const [key,val] of Object.entries(filters)) {
            if (!j[key] || !j[key].toString().toLowerCase().includes(val.toLowerCase())) return false;
        }
        return true;
    });

    // ---- Sort (optionnel) ----
    if (sorts.length) {
        list.sort((a,b)=> {
            for (const s of sorts) {
                if (a[s]!==b[s]) return (""+a[s]).localeCompare(""+b[s]);
            }
            return 0;
        });
    }

    // ---- Créer paste.ee ----
    const content = list.map(buildContent).join("\n\n");
    const url = `https://paste.ee/p/yourgeneratedpasteid?content=${encodeURIComponent(content)}`;
    return `Paste generated: ${url}`;
}

function missingCommand(args=[], user="WebUser") {
    if (!jumpDB) return "Database not loaded yet.";
    const userData = JSON.parse(localStorage.getItem("user_data")||"{}");
    const owned = Object.keys(userData[user]||{});
    const missing = Object.values(jumpDB).filter(j => !owned.includes(j.name));
    return listCommand(["all"]); // On peut appliquer filtres supplémentaires
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
    Object.entries(batch.add).forEach(([name,data]) => jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name,data]) => jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(name => delete jumpDB[name.toLowerCase()]);
    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approved and implemented.`;
}

// ----------------- RUN COMMANDES -----------------
async function runCommand(input, callback) {
    await loadDatabases();
    if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");
    const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g,""));
    const cmd = args[0].substring(1).toLowerCase();
    const rest = args.slice(1);

    let res="";
    switch(cmd) {
        case "help": res=helpCommand(); break;
        case "info": res=rest.length? infoCommand(rest.join(" ")) : "Provide a jump name!"; break;
        case "random": res=randomCommand(); break;
        case "give": res=rest.length? giveCommand(rest[0],rest[1]||null) : "Usage: !give <jump-name> [proof-link]"; break;
        case "proof": res=rest.length>=2 ? proofCommand(rest[0],rest[1],rest[2]||null) : "Usage: !proof get/set <jump-name> [proof-link]"; break;
        case "rem":
        case "del": res=rest.length? remCommand(rest.join(" ")) : "Provide jump name to remove"; break;
        case "list": res=listCommand(rest); break;
        case "missing": res=missingCommand(rest); break;
        case "batch":
            if (rest.length<2) { res="Usage: !batch <create|add|finish|approve> <batchName> [args]"; break; }
            const op=rest[0].toLowerCase();
            const batchName=rest[1];
            const author="WebUser";
            switch(op){
                case "create": res=createBatch(batchName,author); break;
                case "add": if(rest.length<3){res="Usage: !batch add <batchName> <jumpName>"; break;}
                    res=addJumpToBatch(batchName,rest.slice(2).join(" "),author); break;
                case "finish": res=finishBatch(batchName,author); break;
                case "approve": res=approveBatch(batchName,author); break;
                default: res="Unknown batch operation!"; break;
            }
            break;
        default: res="Unknown command!";
    }
    callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommand;
window.getJump = getJump;
