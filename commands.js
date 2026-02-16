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

function normalize(s) {
  return s ? String(s).trim().toLowerCase() : "";
}

function getTypeFromTricks(jumpName) {
  if (!tricksDB || !Array.isArray(tricksDB)) return null;
  const target = normalize(jumpName);
  for (const t of tricksDB) {
    if (!t.content) continue;
    const content = t.content.toLowerCase();
    if (content.includes(target)) {
      const match = t.content.match(/Jump Type\s*:\s*([^\n\r]+)/i) || t.content.match(/Junp Type\s*:\s*([^\n\r]+)/i);
      if (match) return match[1].trim();
    }
  }
  return null;
}

function getJump(name) {
  if (!jumpDB) return null;
  const lower = name.toLowerCase();
  if (jumpDB[lower]) return jumpDB[lower];
  if (!tricksDB) return null;
  for (const t of tricksDB) {
    if (t.content && t.content.toLowerCase().includes(lower)) return t;
  }
  return null;
}

// ----------------- COMMANDES -----------------
function infoCommand(name) {
  const jump = getJump(name);
  if (!jump) return `Jump "${name}" not found.`;

  const lines = [];

  // Nom
  if (jump.name) {
    lines.push(jump.name);
  }

  // Difficulty
  if (jump.diff) {
    if (Array.isArray(jump.diff)) {
      lines.push(`Difficulty: ${jump.diff.join(", ")}`);
    } else {
      lines.push(`Difficulty: ${jump.diff}`);
    }
  }

  // Type (direct ou via tricks)
  let type = jump.type;
  if (!type) {
    type = getTypeFromTricks(jump.name);
  }
  if (type) {
    lines.push(`Type: ${type}`);
  }

  // Found / Proven
  if (jump.finder && jump.prover) {
    lines.push(`Found & Proven by ${jump.finder}`);
  } else if (jump.finder) {
    lines.push(`Found by ${jump.finder}`);
  } else if (jump.prover) {
    lines.push(`Proven by ${jump.prover}`);
  }

  // Source
  if (jump.source) {
    lines.push(jump.source);
  }

  // Lien
  if (jump.links) {
    if (Array.isArray(jump.links)) {
      lines.push(jump.links[0]);
    } else {
      lines.push(jump.links);
    }
  }

  return lines.join("\n");
}

function randomCommand() {
  if (!jumpDB) return "Database not loaded yet.";
  const allJumps = Object.values(jumpDB);
  if (!allJumps.length) return "Database vide.";
  const randJump = allJumps[Math.floor(Math.random() * allJumps.length)];
  return randJump.name || "Nom non défini";
}

// ----------------- TOKENIZE -----------------
function tokenizeInput(input) {
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(a => a.replace(/^"|"$/g, "")) || [];
}

// ----------------- PARSING -----------------
function parseListArguments(tokens) {
  const attrMap = {
    diff: "diff", d: "diff",
    ty: "type", type: "type",
    k: "location", kingdom: "location", loc: "location",
    s: "server", server: "server",
    f: "finder", finder: "finder",
    p: "prover", prover: "prover",
    name: "name", n: "name",
    tier: "tier", t: "tier",
    links: "links", link: "links", l: "links",
    extra: "extra"
  };

  let idx = 0, target = "all", filtersSection = [], sortsSection = [], yieldType = "";
  if (tokens.length > 0 && ["all","mine"].includes(tokens[0].toLowerCase())) {
    target = tokens[0].toLowerCase(); idx=1;
  } else if (tokens.length>0 && /^[0-9]{17,20}$/.test(tokens[0])) {
    target = tokens[0]; idx=1;
  }

  let mode = "pre";
  for(; idx<tokens.length; idx++) {
    const tk = tokens[idx]; const low = tk.toLowerCase();
    if(low==="only"){mode="filters"; continue;}
    if(low==="by"){mode="sorts"; continue;}
    if(tk==="+"||tk==="-"){yieldType=tk; continue;}
    if(mode==="pre") mode="filters";
    if(mode==="filters") filtersSection.push(tk);
    else if(mode==="sorts") sortsSection.push(tk);
  }

  // parse filters -> groupes or/and
  const groups=[]; let currentGroup=[];
  let i=0;
  while(i<filtersSection.length){
    const token=filtersSection[i]; const low=token.toLowerCase();
    if(low==="or"){if(currentGroup.length) groups.push(currentGroup); currentGroup=[]; i++; continue;}
    if(low==="and"){i++; continue;}
    const keyToken=token;
    const valueToken=filtersSection[i+1]!==undefined?filtersSection[i+1]:"";
    const key=attrMap[keyToken.toLowerCase()]||keyToken.toLowerCase();
    let value=valueToken;
    if(key==="diff" && /elite/i.test(value)) value=value.split(/\s+/)[0];
    currentGroup.push({key,value});
    i+=2;
  }
  if(currentGroup.length) groups.push(currentGroup);
  const filterGroups = groups.length ? groups : [];

  return {target, filterGroups, sorts:sortsSection, yieldType};
}

// ----------------- FILTRAGE -----------------
function matchDiffAttribute(attrRaw, filterValue){
  if(!attrRaw) return false;
  const attr=String(attrRaw).trim();
  const fv=String(filterValue).trim().toLowerCase();
  if(/elite/i.test(attr)){
    const first=attr.split(/\s+/)[0].toLowerCase(); return first===fv;
  }
  const numMatch=attr.match(/^(\d+(\.\d+)?)/);
  if(numMatch){ const num=numMatch[1]; return num===fv || fv.startsWith(num) || fv===`${num}/10`; }
  return attr.toLowerCase().includes(fv);
}

function matchGenericAttribute(attrRaw, filterValue){
  if(!attrRaw) return false;
  const fv=String(filterValue).trim().toLowerCase(); if(fv==="") return false;
  if(Array.isArray(attrRaw)) return attrRaw.some(a=>String(a).toLowerCase().includes(fv));
  return String(attrRaw).toLowerCase().includes(fv);
}

function matchConditionForJump(jump,cond){
  const key=cond.key, value=cond.value;
  if(!key || value===undefined || value===null) return false;
  let attr = jump[key];
  if((!attr || attr==="") && key==="type") attr=getTypeFromTricks(jump.name)||"";
  if(key==="diff") return Array.isArray(attr)?attr.some(a=>matchDiffAttribute(a,value)):matchDiffAttribute(attr,value);
  return matchGenericAttribute(attr,value);
}

function passesFilters(jump, filterGroups){
  if(!filterGroups || filterGroups.length===0) return true; // important
  for(const group of filterGroups){
    let allTrue=true;
    for(const cond of group){
      if(!matchConditionForJump(jump,cond)){allTrue=false; break;}
    }
    if(allTrue) return true;
  }
  return false;
}

// ----------------- LIST COMMAND -----------------
async function listCommandFromTokens(tokens){
  if(!jumpDB) return "Database non chargée.";
  const {target, filterGroups, sorts, yieldType} = parseListArguments(tokens);
  let jumps=Object.values(jumpDB)||[];
  jumps=jumps.filter(j=>passesFilters(j,filterGroups));
  for(let i=sorts.length-1;i>=0;i--){
    const s=sorts[i];
    jumps.sort((a,b)=>{
      const av=normalize(a[s]??""), bv=normalize(b[s]??"");
      if(av<bv) return -1; if(av>bv) return 1; return 0;
    });
  }
  if(!jumps.length) return "Aucun jump trouvé avec ces filtres.";

  const usedFilterKeys=[];
  for(const g of filterGroups) for(const c of g) if(c?.key && !usedFilterKeys.includes(c.key)) usedFilterKeys.push(c.key);

  const outputLines=jumps.map(j=>{
    if(yieldType==="+") return JSON.stringify(j);
    if(yieldType==="-") return j.name||"(nom manquant)";
    const parts=[];
    for(const k of usedFilterKeys){
      let val=j[k]; if((!val||val==="")&&k==="type") val=getTypeFromTricks(j.name)||"";
      if(Array.isArray(val)) val=val.join("; "); parts.push(`${k}: ${val??""}`);
    }
    for(const s of sorts){
      let val=j[s]; if((!val||val==="")&&s==="type") val=getTypeFromTricks(j.name)||"";
      if(Array.isArray(val)) val=Array.isArray(val)?val.join("; "):val; if(!usedFilterKeys.includes(s)) parts.push(`${s}: ${val??""}`);
    }
    return parts.length?`${j.name} [${parts.join(", ")}]`:j.name;
  });

  const output=outputLines.join("\n");
  if(!output.trim()) return "Aucun contenu à poster.";

  try{
    const res=await fetch("https://my-worker-simple.daniel-a-bernard.workers.dev/",{
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({content:output})
    });
    const data=await res.json();
    if(data?.url) return `Liste créée: ${data.url}`;
    return `Erreur: ${data?.error??"Gist non créé"}`;
  }catch(err){return `Erreur: ${err?.message??"Erreur inconnue"}`;}
}

async function listCommand(argsStr=""){
  const tokens=tokenizeInput(argsStr);
  return await listCommandFromTokens(tokens);
}

// ----------------- RUN COMMAND -----------------
async function runCommand(input,callback){
  await loadDatabases();
  if(!input || typeof input!=="string") return callback("Commande invalide.");
  if(!input.startsWith("!")) return callback("Commande doit commencer par '!'");

  const args=tokenizeInput(input);
  if(!args.length) return callback("Commande vide.");

  const cmd=args[0].substring(1).toLowerCase();
  const restTokens=args.slice(1);

  let res="";
  try{
    switch(cmd){
      case "info": res=restTokens.length?infoCommand(restTokens.join(" ")):"Fournir un nom de jump !"; break;
      case "random": res=randomCommand(); break;
      case "list": res=await listCommandFromTokens(restTokens); break;
      case "missing": res=await listCommandFromTokens(restTokens); break;
      default: res="Commande inconnue !"; break;
    }
  }catch(err){res=`Erreur interne: ${err?.message??String(err)}`;}

  callback(res);
}

// ----------------- EXPORT -----------------
window.runCommand=runCommand;
window.getJump=getJump;

