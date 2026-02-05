// ==== Imports & Constants ====
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Discord = require('discord.js');
const client = new Discord.Client({ intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent] });

const PREFIX = '!';
const USER_JUMP_DATA_DIR = './data/users/';
const BATCHES_DIR = './data/batches/';
const BACKUP_NAME_EXTENSION = 'backup.json';
const MAX_BATCH_NAME = 50;
const MAX_DISCORD_MSG_LEN = 2000;
const MAX_DISCORD_FILE_SIZE = 10000000;

// Global variable replacements
let CLIENT;
let TOP100_LINK = "";

// ==== Utilities ====
function _timeToStr() {
    return new Date().toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}

function _hashString(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

function _readJSONSafe(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function _writeJSONSafe(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function _idToUsername(userId) {
    // Replace with actual logic
    return userId.toString();
}

// ==== Top 100 Command ====
const DIFF_TO_POINTS = {
    "0/10": 0.001,
    "0.5/10": 0.004,
    "1/10": 0.005,
    "1.5/10": 0.006,
    "2/10": 0.008,
    "2.5/10": 0.011,
    "3/10": 0.015,
    "3.5/10": 0.020,
    "4/10": 0.026,
    "4.5/10": 0.035,
    "5/10": 0.046,
    "5.5/10": 0.061,
    "6/10": 0.081,
    "6.5/10": 0.107,
    "7/10": 0.141,
    "7.5/10": 0.187,
    "8/10": 0.247,
    "8.5/10": 0.327,
    "9/10": 0.432,
    "9.5/10": 0.571,
    "10/10": 0.756,
    "Low Elite": 1,
    "Mid Elite": 2,
    "High Elite": 4,
    "Insanity Elite": 8,
    "God Tier": 20,
    "Hell Tier": 50
};

async function top100() {
    if (!_isTimeForDailyUpdate("top100")) return `**Top 100**:\n${TOP100_LINK}`;

    const usersScoring = {};
    const order = [...TIER_ORDER].slice(0, -1).reverse();

    fs.readdirSync(USER_JUMP_DATA_DIR).forEach(fileName => {
        if (fileName.endsWith('.json') && !fileName.endsWith(BACKUP_NAME_EXTENSION) && /^\d+\.json$/.test(fileName)) {
            const userId = parseInt(fileName.replace('.json', ''));
            const username = _idToUsername(userId);
            usersScoring[username] = 0;

            const userJumps = _readJSONSafe(path.join(USER_JUMP_DATA_DIR, fileName));
            Object.keys(userJumps).forEach(jumpName => {
                const jumpData = database._getJumpFast(jumpName);
                if (!jumpData) return;
                usersScoring[username] += DIFF_TO_POINTS[jumpData.diff] || 0;
            });
        }
    });

    let top = Object.entries(usersScoring).sort((a, b) => b[1] - a[1]);
    if (top.length > 100) top = top.slice(0, 100);

    const topReformatted = top.map(([username, points]) => [username, points.toFixed(3)]);
    TOP100_LINK = await paste.create(_formatTable(topReformatted, ['NAME', 'POINTS']));
    return top100();
}

// ==== Random Jump Command ====
function randomJump() {
    const keys = Object.keys(database.DATABASE);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return info(randomKey);
}

// ==== Permission Checks ====
function _isGodTierRater(member) {
    const roles = secret.load().GOD_TIER_RATER_ROLES;
    return member.roles.cache.some(r => roles.includes(r.id)) || _isAdmin(member);
}

function _isMod(member) {
    const roles = secret.load().BOT_MOD_ROLES;
    return member.roles.cache.some(r => roles.includes(r.id)) || _isAdmin(member);
}

function _isAdmin(memberOrId) {
    const id = memberOrId.id ? memberOrId.id : memberOrId;
    return secret.load().BOT_ADMINS.includes(id);
}

// ==== Channel Configuration ====
function channelConf(args, channelId, author) {
    channelId = String(channelId);
    let modPerms = false;
    if (_isMod(author)) modPerms = true;
    else if (!author.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) return "You don't have the permission to use this moderation command!";

    const VALID_VALS = {
        commands: [['none', '0'], ['normal', '1'], ['moderation', 'mods', 'mod', '2']],
        info: [['short', 'fast', '0'], ['long', 'slow', '1']]
    };

    const confs = _getChannelConf(channelId);

    if (args.length === 1) {
        return "**This channel's configurations are:**\n" + Object.entries(confs).map(([k, v]) => `__${k}__: ${v}`).join("\n");
    }

    if (!(args[1] in VALID_VALS)) return `The channel configuration \`${args[1]}\` does not exist!`;
    if (args.length === 2) return `The value of the channel configuration \`${args[1]}\` is set to \`${confs[args[1]]}\`!`;

    const userVal = args.slice(2).join(" ");
    let val = null;
    for (const possibility of VALID_VALS[args[1]]) {
        if (possibility.includes(userVal)) { val = possibility[0]; break; }
    }
    if (!val) return `The value \`${userVal}\` is not valid for the channel configuration \`${args[1]}\`!`;
    if (val === 'moderation' && !modPerms) return "You aren't a verified Jumpedia Moderator, so you can only set the channel's type to `Normal` or `Commands`!";

    confs[args[1]] = val;
    _writeJSONSafe(`data/channels/${channelId}.json`, confs);
    return `The channel configuration \`${args[1]}\` was set to \`${val}\`!`;
}
// ==== Batch Utilities ====
const BATCH_DATABASES_ORDER = ['rem', 'edit', 'add'];

function _getBatchDataByNameOrHash(nameOrHash) {
    if (nameOrHash.length === 64) { // SHA256 hash length
        const filePath = path.join(BATCHES_DIR, `${nameOrHash}.json`);
        if (fs.existsSync(filePath)) return _readJSONSafe(filePath);
        return [];
    }

    const matching = [];
    for (const fileName of fs.readdirSync(BATCHES_DIR)) {
        if (fileName.endsWith('.json') && !fileName.endsWith('backup.json')) {
            const batchData = _readJSONSafe(path.join(BATCHES_DIR, fileName));
            if (batchData.name.toLowerCase() === nameOrHash.toLowerCase()) {
                if (!_isLocked(batchData)) return batchData;
                matching.push(batchData);
            }
        }
    }
    return matching;
}

function _appendLog(batchData, msg) {
    batchData.log.push([_timeToStr(), msg]);
}

function _strAuthor(member) {
    return `'${member.displayName}' (${member.id})`;
}

function _isEditable(batchData) {
    return batchData.status === 'unfinished';
}

function _isLocked(batchData) {
    return batchData.status === 'implemented' || batchData.status === 'nuked';
}

// ==== Batch Errors ====
function _getBatchErrors(batchData) {
    const errors = {
        rem_not_exist: new Set(),
        edit_not_exist: new Set(),
        edit_in_add_too: new Set(),
        edit_in_rem_too: new Set(),
        edit_name_exist: new Set(),
        edit_name_collides: new Set(),
        add_exist: new Set()
    };

    let empty = true;
    for (const db of BATCH_DATABASES_ORDER) if (batchData[db] && Object.keys(batchData[db]).length > 0) empty = false;
    if (empty) return { empty: true };

    const listJumpNames = db => Array.isArray(db) ? db : Object.keys(db);

    for (const jumpName of batchData.rem) {
        if (!database._getJumpFast(jumpName)) errors.rem_not_exist.add(jumpName);
    }

    const collisionCheckedFutureNames = {};
    for (const [jumpName, jumpData] of Object.entries(batchData.edit)) {
        if (!database._getJumpFast(jumpName)) errors.edit_not_exist.add(jumpName);
        if (listJumpNames(batchData.add).includes(jumpName)) errors.edit_in_add_too.add(jumpName);
        if (listJumpNames(batchData.rem).includes(jumpName)) errors.edit_in_rem_too.add(jumpName);

        const futureName = jumpData.name ? jumpData.name.toLowerCase() : jumpName;
        if (database._getJumpFast(futureName) && futureName !== jumpName) errors.edit_name_exist.add(`${jumpName} -> ${futureName}`);

        if (!collisionCheckedFutureNames[futureName]) collisionCheckedFutureNames[futureName] = [];
        collisionCheckedFutureNames[futureName].push(jumpName);
    }

    for (const [futureName, collidingJumps] of Object.entries(collisionCheckedFutureNames)) {
        if (collidingJumps.length > 1) collidingJumps.forEach(j => errors.edit_name_collides.add(`${j} -> ${futureName}`));
    }

    for (const jumpName of listJumpNames(batchData.add)) {
        if (database._getJumpFast(jumpName)) errors.add_exist.add(jumpName);
    }

    const finalErrors = {};
    for (const [k, v] of Object.entries(errors)) if (v.size > 0) finalErrors[k] = v;
    return Object.keys(finalErrors).length ? finalErrors : null;
}

function _batchErrorsToStr(errors, batchName) {
    if (errors.empty) return "The batch contains no updates at all, therefore it cannot be finished!";
    const lines = [];

    const appendError = (desc, fix, jumps) => {
        lines.push(`${desc}\nHow to fix: ${fix}\nList:\n- ${Array.from(jumps).join('\n- ')}`);
    };

    for (const [type, jumps] of Object.entries(errors)) {
        switch (type) {
            case 'rem_not_exist': appendError("The following jumps that don't exist in Jumpedia were tried to be removed!", `!batch forget "${batchName}" rem <jump-name>`, jumps); break;
            case 'edit_not_exist': appendError("The following jumps that don't exist in Jumpedia were tried to be edited!", `!batch forget "${batchName}" edit <jump-name>`, jumps); break;
            case 'edit_in_add_too': appendError("The following jumps were tried to be edited and added at the same time!", `!batch forget "${batchName}" <edit/add> <jump-name>`, jumps); break;
            case 'edit_in_rem_too': appendError("The following jumps were tried to be edited and removed at the same time!", `!batch forget "${batchName}" <edit/rem> <jump-name>`, jumps); break;
            case 'edit_name_exist': appendError("The following jump edits would overwrite existing jumps!", `!batch forget "${batchName}" edit <jump-name>`, jumps); break;
            case 'edit_name_collides': appendError("The following jump edits collide with other edits!", `!batch forget "${batchName}" edit <jump-name>`, jumps); break;
            case 'add_exist': appendError("The following jumps already exist!", `!batch forget "${batchName}" add <jump-name>`, jumps); break;
        }
    }

    return paste.create(lines.join("\n\n"), { beforeLink: "A few errors that must be fixed first were found:" });
}

// ==== Batch Create ====
function _batchCreate(batchName, batchHash, author) {
    if (!Array.isArray(_getBatchDataByNameOrHash(batchName))) return "An active batch with that name already exists!";

    const batchData = {
        name: batchName,
        hash: batchHash,
        created_at: _timeToStr(),
        created_by: _strAuthor(author),
        implemented_at: "TBD",
        status: "unfinished",
        log: [],
        add: {},
        edit: {},
        rem: []
    };

    _appendLog(batchData, `${_strAuthor(author)} creates batch`);
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchHash}.json`), batchData);
    return "**Batch successfully created!**\n\n- You can now attach jump additions, removals and edits!\n- After everything wanted is added to the batch, its status can be set to being finished!\n- Finally the batch can be approved by a Jumpedia Admin!";
}

// ==== Batch Add/Edit ====
function _batchAddOrEdit(batchData, args, author, addElseEdit = true) {
    if (args.length < 1) return "Please specify the jump name and the jump info afterwards!";
    const jumpName = args[0];
    let jumpData = addElseEdit ? { name: jumpName } : {};

    let lastAttr = null;
    for (const arg of args.slice(1)) {
        let [attr, val] = arg.includes(':') ? arg.split(/:(.+)/) : [lastAttr, arg];
        attr = attr ? attr.trim().toLowerCase() : null;
        val = val ? val.trim() : null;
        if (!attr) return `Attribute not specified for value "${val}"!`;

        // Handle attributes that can have multiple values
        if (ATTRIBUTES_LISTABLE.includes(attr)) {
            jumpData[attr] = jumpData[attr] || [];
            jumpData[attr].push(_userValToVal(attr, val));
        } else {
            jumpData[attr] = _userValToVal(attr, val);
        }

        lastAttr = attr;
    }

    // Validate required attributes
    if (addElseEdit) {
        const missing = ATTRIBUTES_REQUIRED.slice(1).filter(a => !(a in jumpData));
        if (missing.length) return `The required attributes \`${missing.join('`, `')}\` are missing!`;
    }

    if ('diff' in jumpData) jumpData.tier = _diffToTier(jumpData.diff);

    const db = addElseEdit ? batchData.add : batchData.edit;
    const overwrite = jumpName.toLowerCase() in db;
    db[jumpName.toLowerCase()] = jumpData;

    _appendLog(batchData, `${_strAuthor(author)} ${overwrite ? 'overwrites' : 'adds'} jump under batch's ${addElseEdit ? 'additions' : 'edits'} -> ${Object.entries(jumpData).map(([k,v]) => `${k}: ${v}`).join('   ')}`);
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchData.hash}.json`), batchData);

    return `The specified jump's info was successfully ${overwrite ? 'overwritten' : 'stored'} under the batch's ${addElseEdit ? 'additions' : 'edits'}!`;
}
// ==== Batch Remove / Forget ====
function _batchRem(batchData, jumpName, author) {
    jumpName = jumpName.toLowerCase();
    if (!jumpName) return "Please specify the jump you want to remove!";

    if (batchData.rem.includes(jumpName)) return "The specified jump's info is already stored under the batch's removals!";
    batchData.rem.push(jumpName);
    _appendLog(batchData, `${_strAuthor(author)} adds jump under batch's removals -> Name: ${jumpName}`);
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchData.hash}.json`), batchData);
    return "The specified jump's info was successfully stored under the batch's removals!";
}

function _batchForget(batchData, args, author) {
    if (args.length < 2) return `Please enter both a valid operation (${BATCH_DATABASES_ORDER.join(', ')}) and the jump you want to remove from that operation!`;

    let operation = args[0].toLowerCase() === 'del' ? 'rem' : args[0].toLowerCase();
    let jumpName = args.slice(1).join(' ').toLowerCase();

    if (!BATCH_DATABASES_ORDER.includes(operation)) return `Only the operations \`${BATCH_DATABASES_ORDER.join('`, `')}\` are valid!`;

    const db = batchData[operation];
    if (Array.isArray(db)) {
        const idx = db.indexOf(jumpName);
        if (idx === -1) return "There is no jump with that name stored in the batch under that operation!";
        db.splice(idx, 1);
    } else {
        if (!(jumpName in db)) return "There is no jump with that name stored in the batch under that operation!";
        delete db[jumpName];
    }

    _appendLog(batchData, `${_strAuthor(author)} lets batch information be forgotten -> Operation: ${operation}   Name: ${jumpName}`);
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchData.hash}.json`), batchData);
    return "The specified batch information was successfully forgotten!";
}

// ==== Batch Approve / Nuke ====
async function _batchApprove(batchData, message) {
    const author = message.author;
    if (!_isAdmin(author)) return "You must be a Jumpedia Admin to be able to approve a batch!";
    if (batchData.status !== 'finished') {
        _appendLog(batchData, `${_strAuthor(author)} tries to approve batch, but fails due to status not being 'finished'`);
        return "Only batches that have the status `finished` can be approved!";
    }

    const errors = _getBatchErrors(batchData);
    if (errors) {
        _appendLog(batchData, `${_strAuthor(author)} tries to approve batch, but fails due to errors`);
        return _batchErrorsToStr(errors, batchData.name);
    }

    // Backup current database
    const backupPath = path.join(DATABASE_DIR, `jump_data_${new Date().toISOString().replace(/[:.]/g,'_')}.json`);
    _writeJSONSafe(backupPath, database.DATABASE);

    let dbCopy = { ...database.DATABASE };

    // Remove jumps
    for (const jump of batchData.rem) dbCopy[jump] && delete dbCopy[jump];

    // Edit jumps
    for (const [jumpName, jumpData] of Object.entries(batchData.edit)) {
        if (jumpData.name) {
            const newName = jumpData.name.toLowerCase();
            if (jumpName !== newName) {
                dbCopy[newName] = { ...dbCopy[jumpName] };
                delete dbCopy[jumpName];
            } else {
                dbCopy[jumpName].name = jumpData.name;
            }
        }
        for (const [attr, val] of Object.entries(jumpData)) {
            if (!val) delete dbCopy[jumpName][attr];
            else dbCopy[jumpName][attr] = val;
        }
    }

    // Add jumps
    dbCopy = { ...dbCopy, ...batchData.add };
    database.DATABASE = dbCopy;

    batchData.status = 'implemented';
    batchData.implemented_at = _timeToStr();
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchData.hash}.json`), batchData);

    await message.channel.send("# The batch was successfully approved!\nThe changes are now implemented and no further changes to the batch can be made!");
    await genlists(message);
}

function _batchNuke(batchData, author) {
    if (!_isAdmin(author)) return "You must be a Jumpedia Admin to be able to nuke a batch!";
    _appendLog(batchData, `${_strAuthor(author)} NUKES BATCH!!!`);
    batchData.status = 'nuked';
    batchData.implemented_at = 'Never';
    _writeJSONSafe(path.join(BATCHES_DIR, `${batchData.hash}.json`), batchData);
    return "The batch was successfully ***NUKED***! :exploding_head:";
}

// ==== GenLists ====
async function genlists(message) {
    const author = message.author;
    if (!_isAdmin(author)) return "You must be a Jumpedia Admin to be able to use this command!";

    const LIST_INFOS = {
        "Database": { channel_id: 692793306996015145, key: jd => jd.server === "Database" && jd.diff !== "Unproven" },
        "SMO Trickjumping Server": { channel_id: 692792665082691695, key: jd => jd.server === "SMO Trickjumping Server" && jd.diff !== "Unproven" },
        "Unproven": { channel_id: 692800140070748279, key: jd => jd.diff === "Unproven" }
    };

    await message.channel.send("**Generating new lists in the Trickjump Database!**\n*This might take a minute...*");

    try {
        for (const [lstName, lstInfo] of Object.entries(LIST_INFOS)) {
            const validJumps = {};

            const channel = CLIENT.channels.cache.get(lstInfo.channel_id);
            if (!channel) {
                await message.channel.send(`The channel for \`${lstName}\` is invalid! (Channel ID: ${lstInfo.channel_id})`);
                continue;
            }

            for (const jd of Object.values(database.DATABASE)) {
                if (lstInfo.key(jd)) {
                    validJumps[jd.location[0]] = validJumps[jd.location[0]] || [];
                    validJumps[jd.location[0]].push(jd);
                }
            }

            const allMsgs = [`# ${lstName} List ${new Date().toLocaleDateString()}\n`];
            for (const loc of LOCATION_ORDER) {
                if (!validJumps[loc]) continue;

                const sorted = validJumps[loc].sort((a,b) => DIFF_ORDER.indexOf(a.diff) - DIFF_ORDER.indexOf(b.diff) || a.name.localeCompare(b.name));
                let singleMsg = [`### ${loc}\n`];
                let singleLen = singleMsg.join('\n').length;

                for (const jump of sorted) {
                    const text = `${jump.name} | ${jump.diff}\n`;
                    if (singleLen + text.length <= MAX_DISCORD_MSG_LEN) {
                        singleMsg.push(text);
                        singleLen += text.length;
                    } else {
                        allMsgs.push(singleMsg);
                        singleMsg = [text];
                        singleLen = text.length;
                    }
                }
                if (singleMsg.length) allMsgs.push(singleMsg);
            }

            for (const msgPart of allMsgs) {
                await channel.send(msgPart.join(''));
            }
            await message.channel.send(`The list in <#${lstInfo.channel_id}> was successfully updated!`);
        }
        await message.channel.send("**All lists in the Trickjump Database were successfully updated!**");
    } catch (err) {
        console.error(err);
        await message.channel.send("An error occurred while trying to generate the lists for the Trickjump Database!");
    }
}

// ==== Backup ====
async function _backupRecursive(infoChannel, backupChannel, dirName) {
    for (const fileName of fs.readdirSync(dirName)) {
        const filePath = path.join(dirName, fileName);
        if (fs.lstatSync(filePath).isDirectory()) {
            if (/^(\.|__)/.test(path.basename(filePath))) continue;
            await _backupRecursive(infoChannel, backupChannel, filePath);
        } else {
            let content = fs.readFileSync(filePath, 'utf8');
            const chunks = content.length > MAX_DISCORD_FILE_SIZE
                ? content.match(new RegExp(`.{1,${MAX_DISCORD_FILE_SIZE}}`, 'gs'))
                : [content];
            const sanitizedPath = filePath.replace(/^\.\//, '').replace(/[\\\/]/g, '_DIR_');

            for (let i = 0; i < chunks.length; i++) {
                try {
                    await backupChannel.send({ files: [new Discord.MessageAttachment(Buffer.from(chunks[i], 'utf8'), chunks.length === 1 ? sanitizedPath : `${sanitizedPath} [Part ${i+1}]`)] });
                } catch (err) {
                    await backupChannel.send(`An error occurred while sending file ${sanitizedPath}!`);
                }
            }
        }
    }
}

async function backupSetup(author, infoChannel, backupChannelId = 1155457840874532944) {
    if (!_isAdmin(author)) return "You must be a Jumpedia Admin to be able to use this command!";
    const backupChannel = CLIENT.channels.cache.get(backupChannelId);

    await infoChannel.send("**The backup process has been started!**");
    await backupChannel.send(`# Jumpedia Backup ${new Date().toLocaleDateString()}`);
    await _backupRecursive(infoChannel, backupChannel, '.');

    return "**The backup process is finished!**";
}

// ==== Daily Updates ====
async function _dailyUpdates(author, message) {
    if (_isTimeForDailyUpdate('backup')) await backupSetup(author, message.channel);
}

// ==== Main Run Function ====
async function run(message, client, developmentMode = false) {
    CLIENT = client;
    const author = message.author;
    let input = message.content;
    const channelId = message.channel.id;

    const QUOT_REPL = /[“”«»“”„‟]/g;
    const SQUOT_REPL = /[‘’‚‛‹›]/g;
    input = input.replace(QUOT_REPL, '"').replace(SQUOT_REPL, "'");

    _addToIDUDB(author);

    const prefix = input.toLowerCase().startsWith(PREFIX);
    if (!prefix && _getChannelConf(channelId).info !== 'short') return;

    let args;
    try { args = shlex.split(input); } 
    catch { return prefix ? "Put arguments with special characters in quotes!" : undefined; }

    const cmd = args[0].slice(PREFIX.length).toLowerCase();
    const rest = args.slice(1).join(' ').toLowerCase();

    if (!prefix && _getChannelConf(channelId).commands !== 'none' && database._getJumpFast(rest)) {
        await message.channel.send(info(rest));
        return;
    }

    let response = null;
    if (cmd === 'channelconf') response = channelconf(args, channelId, author);

    if (!response && _getChannelConf(channelId).commands !== 'none') {
        switch(cmd) {
            case 'help': response = help(); break;
            case 'info': response = info(rest); break;
            case 'list': response = await list_(args, author); break;
            case 'missing': response = await missing(args, author); break;
            case 'give': response = give(args, author); break;
            case 'del':
            case 'rem': response = del_(rest, author); break;
            case 'proof': response = proof(args, author); break;
            case 'rate': response = rate(args, author); break;
            case 'ratings': response = ratings(rest); break;
            case 'donate': response = donate(); break;
            case 'typedyno': response = typedyno(args, author); break;
            case 'batch': response = await batch(channelId, args, message); break;
            case 'genlist':
            case 'genlists': response = await genlists(message); break;
            case 'top100': response = await top100(); break;
            case 'random': response = random_(); break;
            case 'backup': response = await backupSetup(author, message.channel); break;
            default: response = "That command doesn't exist! Enter `!help` if you need assistance!"; break;
        }
    }

    if (response) await message.channel.send(response);
    if (!developmentMode) await _dailyUpdates(author, message);
}
// --- Utilities / Helpers ---

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function _timeToStr() {
    return new Date().toISOString();
}

function _strAuthor(author) {
    return `'${author.username}' (${author.id})`;
}

function _hashString(str) {
    return crypto.createHash("sha256").update(str).digest("hex").slice(0, 128);
}

// Similaire à _userAttrToAttr et _userValToVal en Python
function _userAttrToAttr(attr) {
    const mapping = {
        "tier": "tier",
        "diff": "diff",
        "location": "location",
        "finder": "finder",
        "notes": "notes",
        "server": "server",
        // Ajouter d'autres si nécessaire
    };
    if (!mapping[attr]) throw new Error(`Invalid attribute: ${attr}`);
    return mapping[attr];
}

function _userValToVal(attr, val) {
    // Conversion de valeurs selon l'attribut
    if (attr === "diff") {
        const DIFF_ORDER = ["0/10","0.5/10","1/10","1.5/10","2/10","2.5/10","3/10","3.5/10","4/10","4.5/10","5/10","5.5/10","6/10","6.5/10","7/10","7.5/10","8/10","8.5/10","9/10","9.5/10","10/10"];
        if (!DIFF_ORDER.includes(val)) throw new Error(`Invalid diff value: ${val}`);
        return val;
    }
    if (attr === "tier") return val; // calculé automatiquement ailleurs
    if (attr === "location") return val;
    return val;
}

// Similaire à Python pour gérer IDU database
function _addToIDUDB(author) {
    // Juste un placeholder pour simuler la mise à jour des stats utilisateurs
    // Implémente ton stockage ici
    console.log(`IDUDB updated for ${author.username}`);
}

// --- Subrate command ---
function subrate(args, author) {
    if (!author.roles.cache.some(r => GOD_TIER_RATER_ROLES.includes(r.id)) && !BOT_ADMINS.includes(author.id)) {
        return "You must be a god tier rater or Jumpedia Admin to use this command!";
    }

    // Placeholder: ajouter ton système de god-tier rating ici
    return "Subrate functionality not yet implemented in JS.";
}

// --- Exported functions for commands ---
module.exports = {
    _timeToStr,
    _strAuthor,
    _hashString,
    _userAttrToAttr,
    _userValToVal,
    _addToIDUDB,
    subrate
};
