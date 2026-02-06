// ===== Web Commands (GitHub Pages compatible) =====

let jumpData = [];
let tricksData = [];
let ready = false;

/* ===== LOAD DATABASES ===== */
async function loadDatabases() {
    const j = await fetch("./Jumps-database/jump_data.json");
    jumpData = await j.json();

    const t = await fetch("./Jumps-database/tricks.json");
    tricksData = await t.json();

    ready = true;
}
loadDatabases();

/* ===== MAIN COMMAND ENTRY ===== */
async function runCommand(input) {
    if (!ready) return "Database loading…";

    if (!input.startsWith("!")) return "Commands must start with !";

    const args = input.split(" ");
    const cmd = args[0].slice(1).toLowerCase();
    const rest = args.slice(1).join(" ");

    switch (cmd) {
        case "info":
        case "jump":
            return info(rest);

        case "list":
            return listCmd(args.slice(1));

        case "random":
            return randomCmd();

        default:
            return "That command doesn't exist!";
    }
}

/* ===== !info / !jump ===== */
function info(name) {
    if (!name) return "Please specify a jump name.";

    const s = name.toLowerCase();
    const found =
        jumpData.find(j => j.name.toLowerCase().includes(s)) ||
        tricksData.find(j => j.name.toLowerCase().includes(s));

    if (!found) return "Jump not found.";

    return formatChat(found);
}

/* ===== !random ===== */
function randomCmd() {
    const all = [...jumpData, ...tricksData];
    const j = all[Math.floor(Math.random() * all.length)];
    return formatChat(j);
}

/* ===== !list ===== */
function listCmd(args) {
    let results = [];

    if (args[0] === "all") {
        results = [...jumpData, ...tricksData];
    } else if (args[0] === "kingdom") {
        const k = args.slice(1).join(" ").toLowerCase();
        results = [...jumpData, ...tricksData].filter(j =>
            j.kingdom.toLowerCase().includes(k)
        );
    } else if (args[0] === "difficulty") {
        const d = args[1]?.toLowerCase();
        results = [...jumpData, ...tricksData].filter(j =>
            j.difficulty.toLowerCase() === d
        );
    } else {
        return "Usage: !list all | kingdom <name> | difficulty <level>";
    }

    if (!results.length) return "No jumps found.";

    createPaste(results);
    return `Paste created with ${results.length} jumps.`;
}

/* ===== FORMAT CHAT ===== */
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
function createPaste(jumps) {
    let text = "";
    jumps.forEach(j => {
        text += `${j.name} - ${j.kingdom}\n`;
        text += `Difficulty: ${j.difficulty}\n`;
        text += `Type: ${j.type}\n`;
        text += `Found by ${j.found_by}, Proven by ${j.proven_by}\n`;
        text += `From the Database\n\n`;
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Jumpedia Paste</title>
<style>
body { background:#0b0b0b; color:#00ffd0; font-family:monospace; padding:20px }
pre { white-space: pre-wrap }
</style>
</head>
<body>
<pre>${text}</pre>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
}
// ===== Web Commands (GitHub Pages compatible) =====

let jumpData = [];
let tricksData = [];
let ready = false;

/* ===== LOAD DATABASES ===== */
async function loadDatabases() {
    const j = await fetch("./Jumps-database/jump_data.json");
    jumpData = await j.json();

    const t = await fetch("./Jumps-database/tricks.json");
    tricksData = await t.json();

    ready = true;
}
loadDatabases();

/* ===== MAIN COMMAND ENTRY ===== */
async function runCommand(input) {
    if (!ready) return "Database loading…";

    if (!input.startsWith("!")) return "Commands must start with !";

    const args = input.split(" ");
    const cmd = args[0].slice(1).toLowerCase();
    const rest = args.slice(1).join(" ");

    switch (cmd) {
        case "info":
        case "jump":
            return info(rest);

        case "list":
            return listCmd(args.slice(1));

        case "random":
            return randomCmd();

        default:
            return "That command doesn't exist!";
    }
}

/* ===== !info / !jump ===== */
function info(name) {
    if (!name) return "Please specify a jump name.";

    const s = name.toLowerCase();
    const found =
        jumpData.find(j => j.name.toLowerCase().includes(s)) ||
        tricksData.find(j => j.name.toLowerCase().includes(s));

    if (!found) return "Jump not found.";

    return formatChat(found);
}

/* ===== !random ===== */
function randomCmd() {
    const all = [...jumpData, ...tricksData];
    const j = all[Math.floor(Math.random() * all.length)];
    return formatChat(j);
}

/* ===== !list ===== */
function listCmd(args) {
    let results = [];

    if (args[0] === "all") {
        results = [...jumpData, ...tricksData];
    } else if (args[0] === "kingdom") {
        const k = args.slice(1).join(" ").toLowerCase();
        results = [...jumpData, ...tricksData].filter(j =>
            j.kingdom.toLowerCase().includes(k)
        );
    } else if (args[0] === "difficulty") {
        const d = args[1]?.toLowerCase();
        results = [...jumpData, ...tricksData].filter(j =>
            j.difficulty.toLowerCase() === d
        );
    } else {
        return "Usage: !list all | kingdom <name> | difficulty <level>";
    }

    if (!results.length) return "No jumps found.";

    createPaste(results);
    return `Paste created with ${results.length} jumps.`;
}

/* ===== FORMAT CHAT ===== */
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
function createPaste(jumps) {
    let text = "";
    jumps.forEach(j => {
        text += `${j.name} - ${j.kingdom}\n`;
        text += `Difficulty: ${j.difficulty}\n`;
        text += `Type: ${j.type}\n`;
        text += `Found by ${j.found_by}, Proven by ${j.proven_by}\n`;
        text += `From the Database\n\n`;
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Jumpedia Paste</title>
<style>
body { background:#0b0b0b; color:#00ffd0; font-family:monospace; padding:20px }
pre { white-space: pre-wrap }
</style>
</head>
<body>
<pre>${text}</pre>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
}
