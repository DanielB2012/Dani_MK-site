// chemins mis à jour
const DATABASE_DIR = "./Jumps-database/";
const JUMP_FILE = path.join(DATABASE_DIR, "jump_data.json");
const TRICKS_FILE = path.join(DATABASE_DIR, "tricks.json");

// ----------------- UTILITAIRES -----------------
function getJump(name) {
    name = name.toLowerCase();
    const jumpDB = loadJson(JUMP_FILE);
    if (jumpDB[name]) return jumpDB[name];
    const tricksDB = loadJson(TRICKS_FILE);
    if (tricksDB[name]) return tricksDB[name];
    return null;
}

// ----------------- RUN -----------------
async function run(message, client) {
    const content = message.content.replace(/“|”|«|»|„|‟/g, '"').replace(/‘|’|‚|‛|‹|›/g, "'");
    if (!content.startsWith(PREFIX)) return;

    const args = shlex.split(content);
    const cmd = args[0].substring(PREFIX.length).toLowerCase();

    switch(cmd) {
        case "info": 
            return message.channel.send(await info(args.slice(1).join(" ")));
        case "list": 
            const jumpDB = loadJson(JUMP_FILE);
            return message.channel.send(Object.keys(jumpDB).join("\n") || "No jumps in database!");
        // ... autres commandes batch restent identiques
    }
}
