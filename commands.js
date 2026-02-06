// ===============================
// Jumpedia Web Commands (MAX)
// GitHub Pages compatible
// ===============================

let jumps = [];
let ready = false;

/* ===== LOAD DATABASES ===== */
async function loadDatabases() {
    const a = await fetch("./Jumps-database/jump_data.json");
    const b = await fetch("./Jumps-database/tricks.json");

    const j1 = await a.json();
    const j2 = await b.json();

    jumps = [...j1, ...j2];
    ready = true;
}
loadDatabases();

/* ===== ENTRY POINT ===== */
async function runCommand(input) {
    if (!ready) return "Database loading…";
    if (!input.startsWith("!")) return "Commands must start with !";

    const args = input.trim().split(" ");
    const cmd = args[0].slice(1).toLowerCase();
    const rest = args.slice(1);

    switch (cmd) {
        case "jump":
        case "info":
            return cmdInfo(rest.join(" "));

        case "random":
            return cmdRandom();

        case "list":
            return cmdList(rest);

        case "count":
            return cmdCount();

        case "search":
            return cmdSearch(rest.join(" "));

        case "ratings":
            return cmdRatings();

        case "top":
            return cmdTop();

        case "help":
            return cmdHelp();

        default:
            return "That command doesn't exist!";
    }
}

/* ===== COMMANDS ===== */

function cmdInfo(name) {
    if (!name) return "Please specify a jump name.";
    const s = name.toLowerCase();

    const j = jumps.find(j => j.name.toLowerCase().includes(s));
    return j ? formatChat(j) : "Jump not found.";
}

function cmdRandom() {
    return formatChat(jumps[Math.floor(Math.random() * jumps.length)]);
}

function cmdList(args) {
    let result = [];

    switch (args[0]) {
        case "all":
            result = jumps;
            break;

        case "kingdom":
            result = jumps.filter(j =>
                j.kingdom.toLowerCase().includes(args.slice(1).join(" ").toLowerCase())
            );
            break;

        case "difficulty":
            result = jumps.filter(j =>
                j.difficulty.toLowerCase() === args[1]?.toLowerCase()
            );
            break;

        case "type":
            result = jumps.filter(j =>
                j.type.toLowerCase() === args[1]?.toLowerCase()
            );
            break;

        default:
            return "Usage: !list all | kingdom <name> | difficulty <level> | type <type>";
    }

    if (!result.length) return "No jumps found.";
    createPaste(result);
    return `Paste created with ${result.length} jumps.`;
}

function cmdCount() {
    return `Database contains ${jumps.length} jumps.`;
}

function cmdSearch(term) {
    if (!term) return "Please specify a keyword.";

    const r = jumps.filter(j =>
        JSON.stringify(j).toLowerCase().includes(term.toLowerCase())
    );

    if (!r.length) return "No results found.";
    createPaste(r);
    return `Search returned ${r.length} results.`;
}

function cmdRatings() {
    const rated = jumps.filter(j => j.rating);
    if (!rated.length) return "No ratings available.";

    createPaste(rated);
    return `Ratings list generated (${rated.length}).`;
}

function cmdTop() {
    const rated = jumps.filter(j => j.rating);
    rated.sort((a, b) => b.rating - a.rating);
    createPaste(rated.slice(0, 50));
    return "Top jumps generated.";
}

function cmdHelp() {
    return `
<b>Available commands</b><br>
!jump &lt;name&gt;<br>
!random<br>
!list all<br>
!list kingdom &lt;name&gt;<br>
!list difficulty &lt;level&gt;<br>
!list type &lt;type&gt;<br>
!search &lt;keyword&gt;<br>
!count<br>
!ratings<br>
!top
`;
}

/* ===== FORMAT ===== */

function formatChat(j) {
    return `
<b>${j.name}</b> - ${j.kingdom}<br>
Difficulty: ${j.difficulty}<br>
Type: ${j.type}<br>
Found by ${j.found_by}, Proven by ${j.proven_by}<br>
<i>From the Database</i>
`;
}

/* ===== LOCAL PASTE ===== */

function createPaste(list) {
    let txt = "";

    list.forEach(j => {
        txt += `${j.name} - ${j.kingdom}\n`;
        txt += `Difficulty: ${j.difficulty}\n`;
        txt += `Type: ${j.type}\n`;
        txt += `Found by ${j.found_by}, Proven by ${j.proven_by}\n`;
        txt += `From the Database\n\n`;
    });

    const blob = new Blob([`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Jumpedia Paste</title>
<style>
body { background:#0d0d0d; color:#00ffd0; font-family:monospace; padding:20px }
pre { white-space: pre-wrap }
</style>
</head>
<body>
<pre>${txt}</pre>
</body>
</html>
`], { type: "text/html" });

    window.open(URL.createObjectURL(blob), "_blank");
}
