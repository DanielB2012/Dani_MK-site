// ----------------- COMMANDES.JS -----------------

// Appelle le Worker Cloudflare
const WORKER_URL = "https://my-worker-simple.daniel-a-bernard.workers.dev/";

// Exécute une commande et récupère le résultat JSON
async function runCommand(command, callback) {
  if (!command || !command.trim()) return callback("Commande vide.");

  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });

    const data = await resp.json();

    if (data.result) {
      callback(data.result);
    } else if (data.error) {
      callback(`Erreur Worker: ${data.error}`);
    } else {
      callback("Erreur inconnue du Worker.");
    }
  } catch (err) {
    callback(`Worker exception: ${err.message || err}`);
  }
}

// Commande info
async function infoCommand(name, callback) {
  if (!name) return callback("Veuillez fournir un nom de jump !");
  runCommand(`!info ${name}`, callback);
}

// Commande random
async function randomCommand(callback) {
  runCommand("!random", callback);
}

// Commande liste / missing
async function listCommand(filters = "") {
    if (!jumpDB) return "Database not loaded yet.";

    // Crée juste le texte de la liste
    let output = Object.values(jumpDB).map(j => j.name).join("\n"); // seulement les noms

    if (filters) {
        output = output
            .split("\n")
            .filter(l => l.toLowerCase().includes(filters.toLowerCase()))
            .join("\n");
    }

    try {
        const res = await createGist(output); // ton Worker GitHub
        if (!res.url) return "Erreur: Gist non créé.";
        return `Liste créée: ${res.url}`;
    } catch (err) {
        console.error("Worker error:", err);
        return "Erreur lors de la création du Gist.";
    }
}


// ----------------- HANDLER POUR CHAT -----------------
async function runCommandHandler(input, callback) {
  if (!input.startsWith("!")) return callback("Commande doit commencer par '!'");
  const args = input.match(/(?:[^\s"]+|"[^"]*")+/g).map(a => a.replace(/"/g, ""));
  const cmd = args[0].substring(1).toLowerCase();
  const rest = args.slice(1);

  switch(cmd) {
    case "info":
      infoCommand(rest.join(" "), callback);
      break;
    case "random":
      randomCommand(callback);
      break;
    case "list":
    case "missing":
      listCommand(rest.join(" "), callback);
      break;
    default:
      callback(`Commande inconnue: ${cmd}`);
  }
}

// ----------------- EXPORT -----------------
window.runCommand = runCommandHandler;

