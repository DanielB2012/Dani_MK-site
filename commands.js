// ----------------- CONFIGURATION -----------------
const WORKER_URL = "https://my-worker-simple.daniel-a-bernard.workers.dev/";

// ----------------- UTILITAIRES -----------------
async function runCommand(command) {
  if (!command || !command.trim()) return "Commande vide.";

  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });

    const data = await resp.json();

    // Renvoie le résultat ou l'erreur
    if (data.result) return data.result;
    if (data.error) return `Erreur Worker: ${data.error}`;
    return "Erreur inconnue du Worker.";

  } catch (err) {
    return `Worker exception: ${err.message || err}`;
  }
}

// ----------------- COMMANDES SPÉCIALES -----------------
async function infoCommand(name) {
  if (!name) return "Veuillez fournir un nom de jump !";
  return runCommand(`!info ${name}`);
}

async function randomCommand() {
  return runCommand("!random");
}

async function listCommand(filters = "") {
  let output = await runCommand("!list");
  if (filters) {
    const filtered = output.split("\n")
      .filter(line => line.toLowerCase().includes(filters.toLowerCase()))
      .join("\n");
    output = filtered;
  }

  return output;
}

// ----------------- RUN COMMAND INTERFACE -----------------
async function runCommandHandler(input, callback) {
  if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");
  const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
  const cmd = args[0].substring(1).toLowerCase();
  const rest = args.slice(1);

  let res = "";

  switch (cmd) {
    case "info":
      res = await infoCommand(rest.join(" "));
      break;

    case "random":
      res = await randomCommand();
      break;

    case "list":
    case "missing":
      res = await listCommand(rest.join(" "));
      break;

    default:
      res = `Commande inconnue: ${cmd}`;
  }

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand = runCommandHandler;
