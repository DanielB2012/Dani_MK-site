// -------------------- COMMANDES.JS POUR NAVIGATEUR --------------------

// --------- DONNÉES DES JUMPS (à remplacer par tes vrais données) ---------
window.jumpDB = {
    "superjump": { name: "Super Jump", height: "10m", difficulty: "hard", description: "Un super jump incroyable !" },
    "megajump": { name: "Mega Jump", height: "15m", difficulty: "very hard", description: "Le jump ultime !" }
};

window.tricksDB = {
    "fliptrick": { name: "Flip Trick", type: "trick", description: "Un trick retourné stylé." },
    "spintrick": { name: "Spin Trick", type: "trick", description: "Un spin trick impressionnant." }
};

// --------- BATCHES EN MÉMOIRE ---------
window.batches = {};

// --------- CONSTANTES ---------
const PREFIX = "!";
const MAX_BATCH_NAME = 50;

// --------- UTILITAIRES ---------
function getJump(name){
    name = name.toLowerCase();
    if(window.jumpDB[name]) return window.jumpDB[name];
    if(window.tricksDB[name]) return window.tricksDB[name];
    return null;
}

function infoCommand(jumpName){
    const jump = getJump(jumpName);
    if(!jump) return `Jump "${jumpName}" not found.`;
    let msg = `**Info for ${jump.name || jumpName}:**\n`;
    for(const [key,val] of Object.entries(jump)){
        if(key==="name") continue;
        msg += `- ${key}: ${val}\n`;
    }
    return msg;
}

function listCommand(){
    const allJumps = {...window.jumpDB, ...window.tricksDB};
    if(!Object.keys(allJumps).length) return "No jumps in database!";
    return Object.keys(allJumps).join("\n");
}

// --------- COMMANDES BATCH ---------
function getBatch(batchName){ return window.batches[batchName] || null; }

function createBatch(batchName, author){
    if(batchName.length > MAX_BATCH_NAME) return "Batch name too long!";
    if(window.batches[batchName]) return "Batch already exists!";
    const batch = { name: batchName, created_by: author, status:"unfinished", add:{}, edit:{}, rem:[], log:[`${author} created batch.`] };
    window.batches[batchName] = batch;
    return `Batch "${batchName}" successfully created!`;
}

function addJumpToBatch(batchName, jumpName, author){
    const batch = getBatch(batchName);
    if(!batch) return `Batch "${batchName}" not found.`;
    const jump = getJump(jumpName);
    if(!jump) return `Jump "${jumpName}" not found.`;
    batch.add[jumpName.toLowerCase()] = jump;
    batch.log.push(`${author} added jump "${jumpName}".`);
    return `Jump "${jumpName}" added to batch "${batchName}".`;
}

function finishBatch(batchName, author){
    const batch = getBatch(batchName);
    if(!batch) return `Batch "${batchName}" not found.`;
    batch.status = "finished";
    batch.log.push(`${author} finished batch.`);
    return `Batch "${batchName}" marked as finished.`;
}

function approveBatch(batchName, author){
    const batch = getBatch(batchName);
    if(!batch) return `Batch "${batchName}" not found.`;
    if(batch.status!=="finished") return "Batch must be finished before approval.";
    Object.entries(batch.add).forEach(([name,data]) => window.jumpDB[name.toLowerCase()] = data);
    Object.entries(batch.edit).forEach(([name,data]) => window.jumpDB[name.toLowerCase()] = data);
    batch.rem.forEach(j => delete window.jumpDB[j.toLowerCase()]);
    batch.status = "implemented";
    batch.log.push(`${author} approved batch.`);
    return `Batch "${batchName}" approved and implemented.`;
}

// --------- RUN COMMAND ---------
window.runCommand = function(message, callback){
    if(typeof message !== "string") return callback("Message invalide");
    let args;
    try{
        // Découpe en mots, supporte les guillemets
        args = message.match(/(?:[^\s"]+|"[^"]*")+/g).map(a=>a.replace(/"/g,""));
    }catch(e){
        return callback("Failed to parse command.");
    }

    if(args.length === 0 || !args[0].startsWith(PREFIX)) return callback("Commande doit commencer par '!'");
    const cmd = args[0].substring(PREFIX.length).toLowerCase();
    const rest = args.slice(1);
    let res = "";

    switch(cmd){
        case "info": res = rest.length ? infoCommand(rest.join(" ")) : "Provide a jump name!"; break;
        case "list": res = listCommand(); break;
        case "batch":
            if(rest.length<2){ res="Usage: !batch <operation> <batchName> [args]"; break; }
            const op = rest[0].toLowerCase(), batchName = rest[1], author="User";
            switch(op){
                case "create": res=createBatch(batchName,author); break;
                case "add": res=rest.length<3?"Usage: !batch add <batchName> <jumpName>":addJumpToBatch(batchName,rest.slice(2).join(" "),author); break;
                case "finish": res=finishBatch(batchName,author); break;
                case "approve": res=approveBatch(batchName,author); break;
                default: res="Unknown batch operation!"; break;
            }
            break;
        default: res="Unknown command!"; break;
    }

    callback(res);
};
