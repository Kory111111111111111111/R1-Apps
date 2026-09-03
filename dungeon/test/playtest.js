#!/usr/bin/env node
/*
 * playtest.js — deterministic headless playtest harness for Pocket Dungeon.
 *
 * Drives the REAL engine (js/dungeon.js + js/world.js) exactly like the UI does:
 * a policy agent enters sites, walks rooms tile-by-tile through PD.tryAct, uses
 * class abilities, opens chests, drinks from wells, resolves route choices and
 * boss rewards, uses potions/gear, and leaves through doors and stairs. Every
 * rule mutation goes through engine functions, so the numbers it reports apply
 * to the shipped game — not to a reimplementation of it.
 *
 * Usage (from dungeon/):
 *   node test/playtest.js                             # default sweep
 *   node test/playtest.js --runs 40                   # more seeds per combo
 *   node test/playtest.js --class mage --site hold --runs 60
 *   node test/playtest.js --tier 1
 *   node test/playtest.js --chain 3                   # persistent-hero town loop
 *   node test/playtest.js --json                      # machine-readable summary
 *   node test/playtest.js --trace                     # deep trace on failure
 *
 * Flags:
 *   --runs N     seeds per (class, site, tier)   [default 20]
 *   --seed N     base seed offset                [default 1]
 *   --class c    knight | scout | mage | all     [default all]
 *   --site s     cellar | crypt | hold | all     [default all]
 *   --tier t     0..3 (0 = plain run)            [default 0]
 *   --chain n    persistent-hero campaigns       [default 0]
 *   --verbose    one-line per run
 *   --trace      deep state dump on the first non-terminating run
 *   --json       aggregate + findings as JSON
 *
 * Deterministic: identical flags produce identical output.
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name, fallback) {
    const i = args.indexOf("--" + name);
    if (i === -1) {
        return fallback;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
        return true;
    }
    return value;
}
const RUNS = Math.max(1, Math.round(Number(flag("runs", 20)) || 20));
const BASE_SEED = Math.max(1, Math.round(Number(flag("seed", 1)) || 1));
const CLASS_ARG = String(flag("class", "all")).toLowerCase();
const SITE_ARG = String(flag("site", "all")).toLowerCase();
const TIER = Math.max(0, Math.min(3, Math.round(Number(flag("tier", 0)) || 0)));
const CHAIN = Math.max(0, Math.round(Number(flag("chain", 0)) || 0));
const VERBOSE = flag("verbose", false) === true;
const JSON_OUT = flag("json", false) === true;
const TRACE = flag("trace", false) === true;

const ALL_CLASSES = ["knight", "scout", "mage"];
const ALL_SITES = ["cellar", "crypt", "hold"];
const CLASSES = CLASS_ARG === "all" ? ALL_CLASSES : [CLASS_ARG];
const SITES = SITE_ARG === "all" ? ALL_SITES : [SITE_ARG];
for (const c of CLASSES) {
    if (!ALL_CLASSES.includes(c)) {
        console.error("Unknown class '" + c + "' (knight|scout|mage|all)");
        process.exit(2);
    }
}
for (const s of SITES) {
    if (!ALL_SITES.includes(s)) {
        console.error("Unknown site '" + s + "' (cellar|crypt|hold|all)");
        process.exit(2);
    }
}

// ---------------------------------------------------------------------------
// Load the real engine (mirrors dungeon/test/dungeon_test.js)
// ---------------------------------------------------------------------------
const windowMock = {
    crypto: {
        getRandomValues: function (buf) {
            for (let i = 0; i < buf.length; i++) {
                buf[i] = Math.floor(Math.random() * 0x100000000);
            }
        }
    }
};
global.window = windowMock;
eval(fs.readFileSync(path.join(__dirname, "../js/dungeon.js"), "utf8"));
const PD = windowMock.PocketDungeon;
eval(fs.readFileSync(path.join(__dirname, "../js/world.js"), "utf8"));
const WORLD = windowMock.PocketDungeonWorld;

const DIRS = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } };
const FACINGS = ["N", "E", "S", "W"];
// Door cells live on the map border, one per facing.
const DOOR_CELL = {
    N: { x: 3, y: 0 },
    S: { x: 3, y: 6 },
    W: { x: 0, y: 3 },
    E: { x: 6, y: 3 }
};

function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function tileAt(room, x, y) {
    if (y < 0 || y >= room.tiles.length) {
        return "#";
    }
    const row = room.tiles[y] || "";
    return row[x] === undefined ? "#" : row[x];
}
function foeAt(room, x, y) {
    if (!room.enemies) {
        return null;
    }
    for (let i = 0; i < room.enemies.length; i++) {
        const e = room.enemies[i];
        if (e.hp > 0 && e.x === x && e.y === y) {
            return e;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Path planning (agent side; execution still goes through engine tryAct)
// ---------------------------------------------------------------------------
// Two passes: clean floors first (trap tiles cost 6), any floor second.
function planTo(run, tx, ty, trapTolerant) {
    const room = PD.currentRoom(run);
    if (!room) {
        return null;
    }
    const key = (x, y) => x + "," + y;
    const start = key(run.x, run.y);
    const goal = key(tx, ty);
    if (start === goal) {
        return [];
    }
    if (!passable(room, run, tx, ty, true, trapTolerant)) {
        return null;
    }
    const dist = {};
    const prev = {};
    dist[start] = 0;
    const queue = [{ x: run.x, y: run.y, d: 0 }];
    const bumped = trapTolerant ? 0 : 6;
    let found = null;
    while (queue.length) {
        queue.sort(function (a, b) { return a.d - b.d; });
        const cur = queue.shift();
        if (key(cur.x, cur.y) === goal) {
            found = cur;
            break;
        }
        for (const dir of FACINGS) {
            const vec = DIRS[dir];
            const nx = cur.x + vec.x;
            const ny = cur.y + vec.y;
            const k = key(nx, ny);
            if (dist[k] !== undefined) {
                continue;
            }
            if (!passable(room, run, nx, ny, nx === tx && ny === ty, trapTolerant)) {
                continue;
            }
            const t = tileAt(room, nx, ny);
            const cost = cur.d + ((t === "^" || t === "~") ? bumped : 1);
            dist[k] = cost;
            prev[k] = { x: cur.x, y: cur.y };
            queue.push({ x: nx, y: ny, d: cost });
        }
    }
    if (!found) {
        return null;
    }
    const cells = [];
    let c = { x: tx, y: ty };
    while (c && prev[key(c.x, c.y)]) {
        cells.unshift(c);
        c = prev[key(c.x, c.y)];
    }
    return cells;
}

function passable(room, run, x, y, isDest, trapTolerant) {
    const t = tileAt(room, x, y);
    if (t === "#") {
        return false;
    }
    if (foeAt(room, x, y)) {
        return !!isDest; // bump combat: only the destination may hold a foe
    }
    if (t === "^" || t === "~") {
        return trapTolerant; // clean-pass avoids hazards unless needed
    }
    if (t === "$" || t === "+" || t === ">") {
        return !!isDest; // interactables are reachable targets, never walk-through
    }
    if (t === "." || t === "!" || t === "S" || t === "R") {
        return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Agent state
// ---------------------------------------------------------------------------
function makeAgent() {
    return {
        actions: 0,
        waits: 0,
        abilities: 0,
        potionsUsed: 0,
        chestsOpened: 0,
        chestsSkipped: 0,
        sanctumUses: 0,
        safeRoutes: 0,
        riskRoutes: 0,
        rewardClaims: 0,
        damageTaken: 0,
        roomsEntered: 0,
        floorWaits: 0, // waits since last room change
        floorRoomSeen: new Set(), // room ids seen on this floor
        skippedChests: new Set(), // room ids whose chest is unopenable
        lastFloor: 1
    };
}

function onRoomChanged(agent, run, roomId) {
    if (run.floor !== agent.lastFloor) {
        agent.lastFloor = run.floor;
        agent.floorRoomSeen = new Set();
        agent.skippedChests = new Set();
    }
    if (roomId !== agent.lastRoomId) {
        agent.lastRoomId = roomId;
        agent.roomsEntered++;
        agent.floorRoomSeen.add(roomId);
        agent.roomActions = agent.actions;
        agent.waitStreak = 0;
        agent.prevWait = false;
        agent.acolyteRoomSince = null;
        agent.acolyteHurt = false;
    }
}

// ---------------------------------------------------------------------------
// Engine wrapper: one step (a tryAct) with bookkeeping
// ---------------------------------------------------------------------------
function step(agent, run, result) {
    agent.actions++;
    agent.waits = 0; // any real step breaks a wait streak
    if (result && !result.died && !result.skipEnemies) {
        const before = run.hp;
        // (hp delta observed by caller when needed)
    }
    return result;
}

function wait(agent, run) {
    agent.actions++;
    agent.waits++;
    agent.waitStreak = agent.prevWait ? (agent.waitStreak || 0) + 1 : 1;
    agent.prevWait = true;
    return PD.waitTurn(run);
}

// Turn outcomes the harness understands.
function endedFrom(result) {
    if (!result) {
        return null;
    }
    if (result.died) {
        return "death";
    }
    if (result.won) {
        return "win";
    }
    if (result.siteCleared) {
        return result.siteCleared === "hold" ? "win" : "clear";
    }
    return null;
}

// ---------------------------------------------------------------------------
// Decision maker — plays one "turn"; returns an end state or null to continue.
// ---------------------------------------------------------------------------
function markOp(run, op) {
    run._op = op;
    run._opCounts = run._opCounts || {};
    run._opCounts[op] = (run._opCounts[op] || 0) + 1;
}

function agentTurn(run, agent, traceFn) {
    const room = PD.currentRoom(run);
    if (!room || run.hp <= 0) {
        return "death";
    }
    onRoomChanged(agent, run, room.roomId);
    // Kite watch: a room with a living acolyte that we can never catch should be
    // called out honestly (melee classes can be kited forever in open geometry).
    const livingFoes = room.enemies.filter(function (e) { return e.hp > 0; });
    const anyCaster = livingFoes.some(function (e) { return e.type === "acolyte"; });
    if (anyCaster) {
        if (agent.acolyteRoomSince == null) {
            agent.acolyteRoomSince = agent.actions;
        }
        const logStr = (run._lastLogs || []).join(" ");
        if (logStr.indexOf("HIT ACOLYTE") !== -1 || logStr.indexOf("ACOLYTE DOWN") !== -1) {
            agent.acolyteHurt = true;
        }
    } else {
        agent.acolyteRoomSince = null;
    }

    // 1) Boss reward (claimed before the hero steps off the stairs room).
    if (room.reward && room.reward.active && !room.reward.choice) {
        const options = room.reward.options && room.reward.options.length ? room.reward.options : ["gold", "heal", "renown"];
        const hpFrac = run.hp / run.maxHp;
        const want = options.includes("heal") && hpFrac < 0.55 ? "heal" : options[0];
        markOp(run, "reward:" + want);
        const res = PD.claimReward(run, want);
        agent.actions++;
        agent.rewardClaims++;
        agent.prevWait = false;
        if (traceFn) { traceFn(res, run); }
        return endedFrom(res) || null;
    }

    // 2) Route branch rooms (safe clears foes; risk pays but can spawn + frenzy).
    if (room.choice && room.choice.active) {
        const hpFrac = run.hp / run.maxHp;
        const frenzy = run.floor >= 6 && room.hazard === "blood";
        const risk = hpFrac >= 0.6 && !frenzy;
        markOp(run, "route:" + (risk ? "risk" : "safe"));
        const res = PD.chooseRoomRoute(run, risk ? "risk" : "safe");
        agent.actions++;
        agent.prevWait = false;
        if (risk) { agent.riskRoutes++; } else { agent.safeRoutes++; }
        if (traceFn) { traceFn(res, run); }
        return endedFrom(res) || null;
    }

    // 3) Emergency potion (mid-fight survival).
    if (run.hp <= Math.max(3, Math.ceil(run.maxHp * 0.22)) && room.enemies.length) {
        let idx = -1;
        for (let i = 0; i < run.pack.length; i++) {
            if (run.pack[i] === "greater_potion" || run.pack[i] === "potion") {
                idx = i;
                break;
            }
        }
        if (idx !== -1) {
            markOp(run, "potion");
            const res = PD.useItem(run, idx);
            agent.actions++;
            agent.prevWait = false;
            if (res.died) { return "death"; }
            if (res.logs && res.logs.join(" ").indexOf("USED") !== -1) {
                agent.potionsUsed++;
            }
            return endedFrom(res) || null;
        }
    }

    // 4) Retreat (hopeless, no heals).
    if (room.enemies.length && run.hp <= 2) {
        let hasPotion = false;
        for (let i = 0; i < run.pack.length; i++) {
            if (run.pack[i] === "potion" || run.pack[i] === "greater_potion") {
                hasPotion = true;
            }
        }
        if (!hasPotion) {
            return "retreat";
        }
    }

    // 5) Class tools.
    const tools = classTool(run, room, agent);
    if (tools) {
        agent.abilities++;
        markOp(run, "ability:" + tools);
        const res = PD.useAbility(run);
        agent.actions++;
        agent.prevWait = false;
        if (traceFn) { traceFn(res, run); }
        return endedFrom(res) || null;
    }

    // 5b) Caster counter: kill casters first, in acolyte-only AND mixed rooms.
    // An acolyte backs away whenever the hero is adjacent and never melees, so
    // melee heroes must convert the caster's OWN turns into hits:
    //   * acolyte adjacent at our turn start -> it closed in last turn, bump it
    //   * acolyte chanting (telegraph) in line -> it cannot flee or move this
    //     turn, so step adjacent now; it spends its turn resolving the bolt,
    //     and we bump on the next turn
    //   * otherwise park IN LINE exactly 2 tiles away and wait: every acolyte
    //     phase is then either a chant (free step-in window) or a chase that
    //     lands it adjacent (free bump next turn). Do NOT end turns adjacent
    //     by walking at it, and never re-park a spot we are already on.
    // Melee adds around the caster are bumped opportunistically (free hits)
    // but never pursued; focus fire the weakest acolyte first.
    // Applies to every class: even a mage must never chase an acolyte into
    // adjacency (its cast needs range >= 2, and a mage-only room with no line
    // degenerates into the same flee loop as melee). Class tools in block 5
    // fire first, so a mage in line at range 2-3 still casts every turn.
    if (anyCaster) {
        const adjAdd = livingFoes.find(function (e) {
            return e.type !== "acolyte" && manhattan(run.x, run.y, e.x, e.y) === 1;
        });
        if (adjAdd) {
            markOp(run, "bump");
            const res = faceAndAct(run, adjAdd.x, adjAdd.y, agent);
            agent.actions++;
            run._lastLogs = res.logs || [];
            if (traceFn) { traceFn(res, run); }
            return endedFrom(res) || null;
        }
        const acolytes = livingFoes.filter(function (e) { return e.type === "acolyte"; });
        acolytes.sort(function (a, b) { return a.hp - b.hp; });
        const ac = acolytes[0];
        const d = manhattan(run.x, run.y, ac.x, ac.y);
        const inLine = run.x === ac.x || run.y === ac.y;
        if (d === 1) {
            markOp(run, "bump");
            const res = faceAndAct(run, ac.x, ac.y, agent);
            agent.actions++;
            run._lastLogs = res.logs || [];
            if (traceFn) { traceFn(res, run); }
            return endedFrom(res) || null;
        }
        // Chant window: the caster is committed this turn and cannot back away.
        if (ac.telegraph && d >= 2 && d <= 3 && inLine) {
            const path = planTo(run, ac.x, ac.y, false) || planTo(run, ac.x, ac.y, true);
            if (path && path.length) {
                markOp(run, "chant-in");
                const res = faceAndAct(run, path[0].x, path[0].y, agent);
                agent.actions++;
                if (traceFn) { traceFn(res, run); }
                return endedFrom(res) || null;
            }
        }
        // In line at 2-3 tiles: HOLD GROUND and never re-park. The caster's
        // only moves from here are a chant (35%: the chant-window branch above
        // steps in and we bump next turn) or a chase that lands it adjacent
        // (we bump next turn). It cannot back away while we are not adjacent,
        // so every turn converges on a hit instead of churning spots.
        if (inLine && d >= 2 && d <= 3) {
            markOp(run, "kite-wait");
            const w = wait(agent, run);
            if (traceFn) { traceFn(w, run); }
            return endedFrom(w) || null;
        }
        // Off its line or out of range: walk to an in-line tile 2-3 away.
        // Chasing to adjacency is forbidden — it only makes the caster flee.
        let spot = null;
        let bestDist = 1e9;
        for (let y = 0; y < room.tiles.length; y++) {
            const row = room.tiles[y] || "";
            for (let x = 0; x < row.length; x++) {
                if ((x === run.x && y === run.y) || foeAt(room, x, y)) {
                    continue;
                }
                const t = tileAt(room, x, y);
                if (t === "#" || t === "+" || t === "$" || t === ">") {
                    continue;
                }
                const nd = manhattan(x, y, ac.x, ac.y);
                // In line with the caster, 2-3 tiles away, closest approach.
                if (nd >= 2 && nd <= 3 && (x === ac.x || y === ac.y)) {
                    const stepDist = manhattan(x, y, run.x, run.y);
                    if (stepDist < bestDist) {
                        bestDist = stepDist;
                        spot = { x: x, y: y };
                    }
                }
            }
        }
        if (spot) {
            const path = planTo(run, spot.x, spot.y, false) || planTo(run, spot.x, spot.y, true);
            if (path && path.length) {
                markOp(run, "kite-pos");
                const res = faceAndAct(run, path[0].x, path[0].y, agent);
                agent.actions++;
                if (traceFn) { traceFn(res, run); }
                return endedFrom(res) || null;
            }
        }
        // No safe park reachable (geometry tight): stand still and punish chases.
        markOp(run, "kite-wait");
        const w = wait(agent, run);
        if (traceFn) { traceFn(w, run); }
        return endedFrom(w) || null;
    }

    // 6) Combat.
    const foe = nearestFoe(run, room);
    if (foe) {
        if (manhattan(run.x, run.y, foe.x, foe.y) === 1) {
            markOp(run, "bump");
            const res = faceAndAct(run, foe.x, foe.y, agent);
            agent.actions++;
            run._lastLogs = res.logs || [];
            if (traceFn) { traceFn(res, run); }
            return endedFrom(res) || null;
        }
        const path = planTo(run, foe.x, foe.y, false) || planTo(run, foe.x, foe.y, true);
        if (path && path.length) {
            const next = path[0];
            markOp(run, "chase");
            const res = faceAndAct(run, next.x, next.y, agent);
            agent.actions++;
            if (traceFn) { traceFn(res, run); }
            return endedFrom(res) || null;
        }
        // No route: hold ground and let the enemy close (bounded waits below).
        markOp(run, "wait-foe");
        const w = wait(agent, run);
        if (traceFn) { traceFn(w, run); }
        return endedFrom(w) || null;
    }

    // 7) No living enemies — loot / heal / advance.
    // 7a) Sanctum well.
    markOp(run, "well");
    const well = findTile(room, "!");
    if (well && !room.sanctumUsed && run.hp < run.maxHp * 0.9) {
        const path = planTo(run, well.x, well.y, false) || planTo(run, well.x, well.y, true);
        if (path) {
            const last = walkPath(run, path, agent, traceFn);
            return endedFrom(last) || null;
        }
    }
    // 7b) Chest.
    markOp(run, "chest");
    const chestTile = findTile(room, "$");
    if (chestTile && !agent.skippedChests.has(room.roomId)) {
        const path = planTo(run, chestTile.x, chestTile.y, false) || planTo(run, chestTile.x, chestTile.y, true);
        if (path) {
            const last = walkPath(run, path, agent, traceFn);
            const joined = (last.logs || []).join(" ");
            if (joined.indexOf("OPEN") === 0) {
                agent.chestsOpened++;
            } else if (joined.indexOf("PACK FULL") !== -1) {
                agent.chestsSkipped++;
                agent.skippedChests.add(room.roomId);
            }
            return endedFrom(last) || null;
        }
    }
    // 7c) Stairs / exit.
    markOp(run, "exit");
    const exitTile = findTile(room, ">");
    if (exitTile) {
        const approach = findApproach(run, room, exitTile);
        if (approach) {
            const last = walkPath(run, approach.path, agent, traceFn);
            if (endedFrom(last)) { return endedFrom(last); }
            if (!last || (last.roomChanged === undefined && last.ok !== false)) {
                // Stand on the approach cell, face the exit tile, and step down.
                const res = faceAndAct(run, exitTile.x, exitTile.y, agent);
                agent.actions++;
                if (traceFn) { traceFn(res, run); }
                return endedFrom(res) || null;
            }
            return null;
        }
        // No interior approach cell (should not happen on a 7x7); face it and go.
        const res = faceAndAct(run, exitTile.x, exitTile.y, agent);
        agent.actions++;
        if (traceFn) { traceFn(res, run); }
        return endedFrom(res) || null;
    }
    // 7d) Door to the next room.
    markOp(run, "door");
    const doorDir = pickDoorDir(run, room, agent);
    if (doorDir) {
        const spot = interiorApproach(room, doorDir);
        const vec = DIRS[doorDir];
        const path = planTo(run, spot.x, spot.y, false) || planTo(run, spot.x, spot.y, true);
        agent.lastDoor = { dir: doorDir, spot: spot, doorCell: { x: spot.x + vec.x, y: spot.y + vec.y }, pathLen: path ? path.length : -1, first: path && path.length ? path[0] : null, hero: { x: run.x, y: run.y } };
        if (path) {
            const last = walkPath(run, path, agent, traceFn);
            if (endedFrom(last)) { return endedFrom(last); }
        }
        // Face the door cell and step through (triggers enterRoom on the '+' tile).
        const res = faceAndAct(run, spot.x + vec.x, spot.y + vec.y, agent);
        agent.actions++;
        if (traceFn) { traceFn(res, run); }
        const ended = endedFrom(res);
        if (ended) { return ended; }
        return null; // roomChanged or a single step closer; loop again
    }

    // 8) Nothing to do — bounded stall guard.
    markOp(run, "stall");
    if ((agent.waitStreak || 0) > 45) {
        return "stuck";
    }
    const w = wait(agent, run);
    if (traceFn) { traceFn(w, run); }
    return endedFrom(w) || null;
}

function nearestFoe(run, room) {
    let best = null;
    let bestD = Infinity;
    for (const e of room.enemies) {
        if (e.hp <= 0) { continue; }
        const d = manhattan(run.x, run.y, e.x, e.y);
        if (d < bestD) { bestD = d; best = e; }
    }
    return best;
}

// Knight guards when outnumbered or hurt; scout disarms an adjacent trap;
// mage fires at an in-line target 2-3 tiles out.
function classTool(run, room, agent) {
    if (run.classId === "knight") {
        const foes = room.enemies.filter(function (e) { return e.hp > 0; }).length;
        if (foes && run.guardTurns <= 0 && (foes >= 2 || run.hp < run.maxHp * 0.75)) {
            return "guard";
        }
        return null;
    }
    if (run.classId === "scout") {
        for (const dir of FACINGS) {
            const vec = DIRS[dir];
            const t = tileAt(room, run.x + vec.x, run.y + vec.y);
            if ((t === "^" || t === "~") && !foeAt(room, run.x + vec.x, run.y + vec.y)) {
                run.facing = dir;
                return "disarm";
            }
        }
        return null;
    }
    if (run.classId === "mage") {
        for (const dir of FACINGS) {
            let foe = null;
            let blocked = false;
            for (let r = 1; r <= 3; r++) {
                const vec = DIRS[dir];
                const t = tileAt(room, run.x + vec.x * r, run.y + vec.y * r);
                if (t === "#") { blocked = true; break; }
                foe = foeAt(room, run.x + vec.x * r, run.y + vec.y * r);
                if (foe) { break; }
            }
            if (foe && manhattan(run.x, run.y, foe.x, foe.y) >= 2) {
                run.facing = dir;
                return "cast";
            }
        }
        return null;
    }
    return null;
}

function findTile(room, ch) {
    for (let y = 0; y < room.tiles.length; y++) {
        const row = room.tiles[y] || "";
        for (let x = 0; x < row.length; x++) {
            if (row[x] === ch) {
                return { x: x, y: y };
            }
        }
    }
    return null;
}

// Pick a door that leads somewhere (room.doors may include null on some faces).
function pickDoorDir(run, room, agent) {
    const seen = agent.floorRoomSeen;
    const present = FACINGS.filter(function (dir) {
        if (!room.doors || room.doors[dir] == null) {
            return false;
        }
        const cell = DOOR_CELL[dir];
        return tileAt(room, cell.x, cell.y) === "+";
    });
    if (!present.length) {
        return null;
    }
    const unseen = present.filter(function (dir) {
        return !seen.has(room.doors[dir]);
    });
    const dir = (unseen.length ? unseen : present)[0];
    // Immediately record intent so looping doors do not starve exploration.
    seen.add(room.doors[dir]);
    return dir;
}

function interiorApproach(room, dir) {
    const cell = DOOR_CELL[dir];
    const vec = DIRS[dir];
    const out = { x: cell.x - vec.x, y: cell.y - vec.y };
    if (TRACE && !isFinite(out.x)) {
        console.error("PD_DEBUG interiorApproach", JSON.stringify({ dir: dir, cell: cell, vec: vec, cellKeys: Object.keys(DOOR_CELL), out: out }));
    }
    return out;
}

function standable(room, x, y) {
    // Tiles the hero can actually occupy after acting (interactables like $,
    // + and > are reachable targets but never standing spots). Hazards (^, ~)
    // are excluded so an approach never parks the hero in a damaging tile.
    const t = tileAt(room, x, y);
    return t === "." || t === "!" || t === "S" || t === "R";
}

function findApproach(run, room, target) {
    // Interior cell next to the target that the hero can reach AND stand on.
    // (A chest or door tile must never be chosen as an approach spot: walking
    // "to" it succeeds without moving, then the follow-up act hits the wrong
    // cell forever.)
    const neighbours = [];
    for (const dir of FACINGS) {
        const vec = DIRS[dir];
        const x = target.x - vec.x;
        const y = target.y - vec.y;
        const t = tileAt(room, x, y);
        if (standable(room, x, y) && !foeAt(room, x, y)) {
            neighbours.push({ x: x, y: y });
        }
    }
    for (const spot of neighbours) {
        const path = planTo(run, spot.x, spot.y, false) || planTo(run, spot.x, spot.y, true);
        if (path) {
            return { spot: spot, path: path };
        }
    }
    return null;
}

// Face a target neighbour, then call the engine. The engine only ever acts
// along run.facing, so the agent must aim before every single tryAct.
function faceAndAct(run, tx, ty, agent) {
    const dx = tx - run.x;
    const dy = ty - run.y;
    if (agent) {
        agent.prevWait = false;
        agent.waitStreak = 0;
    }
    if (dx === 0 && dy === 0) {
        return PD.tryAct(run);
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
        run.facing = dx > 0 ? "E" : "W";
    } else {
        run.facing = dy > 0 ? "S" : "N";
    }
    return PD.tryAct(run);
}

// Execute a planned path through the engine. Each cell is a real tryAct.
function walkPath(run, cells, agent, traceFn) {
    let last = null;
    for (const cell of cells) {
        if (!PD.currentRoom(run) || run.hp <= 0) {
            break;
        }
        const roomBefore = run.roomId;
        const floorBefore = run.floor;
        const xBefore = run.x;
        const yBefore = run.y;
        last = faceAndAct(run, cell.x, cell.y);
        agent.actions++;
        if (traceFn) { traceFn(last, run); }
        if (endedFrom(last) || run.roomId !== roomBefore || run.floor !== floorBefore) {
            break;
        }
        if (last.ok === false && last.blocked) {
            break;
        }
        if (last.ok === false && last.logs && last.logs.indexOf("BLOCKED") !== -1) {
            break;
        }
        // Interceptions (bump) or refusals leave the hero in place: stop the
        // batch walk and let the outer loop re-plan from the new situation.
        if (run.x === xBefore && run.y === yBefore) {
            break;
        }
    }
    return last;
}

// ---------------------------------------------------------------------------
// One-run driver
// ---------------------------------------------------------------------------
function playRun(hero, siteId, seed, tier) {
    const run = PD.createSiteRun(hero, siteId, seed, {}, tier);
    const agent = makeAgent();
    const startGold = run.gold;
    let traceLogs = [];
    const traceFn = TRACE ? function (res, r) {
        traceLogs.push({
            op: r._op || "",
            logs: (res && res.logs) || [],
            hp: r.hp,
            maxHp: r.maxHp,
            x: r.x,
            y: r.y,
            facing: r.facing,
            floor: r.floor,
            room: r.roomId,
            gold: r.gold
        });
    } : null;

    // Equip any gear already in the pack (mage blade etc.).
    for (let i = run.pack.length - 1; i >= 0; i--) {
        const id = run.pack[i];
        if (PD.GEAR_DEFS && PD.GEAR_DEFS[id]) {
            const slot = PD.GEAR_DEFS[id].slot;
            if (!run.gear || !run.gear[slot]) {
                const res = PD.useItem(run, i);
                if (res && res.equip) {
                    agent.actions++;
                }
            }
        }
    }

    let end = null;
    let guard = 0;
    while (agent.actions < 9000) {
        const roomNow = PD.currentRoom(run);
        if (!roomNow) {
            end = "unfinished";
            break;
        }
        if (run.hp <= 0) {
            end = "death";
            break;
        }
        // An acolyte-only room chased for a very long time without any hit means
        // the fight is unwinnable by this melee policy in this geometry.
        if (agent.acolyteRoomSince != null && !agent.acolyteHurt && agent.actions - agent.acolyteRoomSince > 260) {
            end = "kited";
            break;
        }
        // A room should never need more than ~600 agent actions.
        if (agent.actions - (agent.roomActions || 0) > 600) {
            // Separate true wedges from fights the policy cannot close:
            //   * living acolyte  -> kited     (melee vs caster flee: clarity/difficulty finding)
            //   * any living foe  -> unclosed  (mid-fight stall: balance/policy finding)
            //   * no foes left    -> stuck     (navigation soft-lock: engine defect)
            const roomCap = PD.currentRoom(run);
            const foesCap = roomCap && roomCap.enemies && roomCap.enemies.some(function (e) { return e.hp > 0; });
            const acCap = foesCap && roomCap.enemies.some(function (e) { return e.hp > 0 && e.type === "acolyte"; });
            end = acCap ? "kited" : foesCap ? "unclosed" : "stuck";
            break;
        }
        const res = agentTurn(run, agent, traceFn);
        if (typeof res === "string") {
            end = res;
            break;
        }
        guard++;
        if (guard > 12000) {
            end = "unfinished";
            break;
        }
    }

    let traceText = "";
    if (traceLogs.length && end) {
        const head = traceLogs.slice(0, 40);
        const tail = traceLogs.length > 80 ? traceLogs.slice(-40) : [];
        traceText = end + " :: " + JSON.stringify(head.concat(tail));
    }

    let debugBoard = null;
    if (end === "stuck" || end === "kited" || end === "unclosed" || end === "unfinished") {
        const room = PD.currentRoom(run);
        if (room) {
            debugBoard = {
                kind: room.kind,
                tiles: room.tiles,
                doors: room.doors,
                hero: { x: run.x, y: run.y, facing: run.facing },
                foes: (room.enemies || []).map(function (e) { return { type: e.type, x: e.x, y: e.y, hp: e.hp }; }),
                floor: run.floor,
                roomId: room.roomId,
                reward: room.reward ? { active: room.reward.active, boss: room.reward.boss, choice: room.reward.choice } : null,
                choice: room.choice ? { active: room.choice.active, route: room.choice.route } : null,
                chest: room.chest ? { open: room.chest.open, item: room.chest.item } : null,
                sanctumUsed: !!room.sanctumUsed,
                waitStreak: agent.waitStreak,
                roomActions: agent.actions - (agent.roomActions || 0),
                lastDoor: agent.lastDoor || null,
                opCounts: run._opCounts || {}
            };
        }
    }

    const outcome = {
        classId: run.classId,
        site: siteId,
        tier: tier,
        seed: seed,
        result: end || "unfinished",
        deathFloor: end === "death" ? run.floor : 0,
        kills: run.kills || 0,
        goldEarned: Math.max(0, run.gold - startGold),
        hpEnd: run.hp,
        hpMaxEnd: run.maxHp,
        hpPctEnd: run.maxHp ? Math.round(run.hp / run.maxHp * 100) : 0,
        levelEnd: run.level,
        xpEarned: run.xpEarned || 0,
        actions: agent.actions,
        waits: agent.waits,
        abilities: agent.abilities,
        potionsUsed: agent.potionsUsed,
        chestsOpened: agent.chestsOpened,
        chestsSkipped: agent.chestsSkipped,
        sanctumUses: agent.sanctumUses,
        rewardClaims: agent.rewardClaims,
        safeRoutes: agent.safeRoutes,
        riskRoutes: agent.riskRoutes,
        roomsEntered: agent.roomsEntered,
        trace: traceText || undefined,
        debug: debugBoard
    };
    return outcome;
}

// ---------------------------------------------------------------------------
// World/campaign loop (persistent hero + inn + shop between runs)
// ---------------------------------------------------------------------------
function newHero(classId) {
    const hero = PD.createHero(classId, {});
    hero.lastInn = "ashford";
    return hero;
}

function innRest(hero) {
    for (const id of ["ashford", "saltmere", "keepgate"]) {
        const res = WORLD.restAtInn(hero, id);
        if (res.ok) {
            return true;
        }
    }
    return false;
}

function shopSmart(hero) {
    if (hero.gold >= 8 && !hero.pack.some(function (i) { return i === "potion" || i === "greater_potion"; })) {
        const res = WORLD.buy(hero, "potion", hero.lastInn || "ashford");
        if (res.ok) { return true; }
    }
    if (hero.gold >= 25 && hero.gear && !hero.gear.armor) {
        const res = WORLD.buy(hero, "mail", hero.lastInn || "ashford");
        if (res.ok) { return true; }
    }
    if (hero.gold >= 25 && hero.gear && !hero.gear.weapon) {
        const res = WORLD.buy(hero, "blade", hero.lastInn || "ashford");
        if (res.ok) { return true; }
    }
    return false;
}

function runCampaign(classId, campaigns) {
    let hero = newHero(classId);
    const flags = {};
    const rows = [];
    const siteOrder = ["cellar", "crypt", "hold"];
    for (let c = 0; c < campaigns; c++) {
        for (const siteId of siteOrder) {
            const site = WORLD.sites[siteId];
            if (siteId !== "cellar" && !flags[site.clear]) {
                continue; // road is still locked, same as a real player
            }
            const seed = BASE_SEED + c * 997 + siteOrder.indexOf(siteId) * 113;
            const out = playRun(hero, siteId, seed, 0);
            if (out.result === "clear" || out.result === "win") {
                flags[site.clear] = 1;
                const stateLike = {
                    hero: hero,
                    flags: flags,
                    meta: { journal: [], bestiary: {}, contractTiers: {} },
                    site: null,
                    run: null,
                    location: { kind: "town", id: site.town }
                };
                const done = WORLD.completeSite(stateLike, siteId);
                hero = done.state.hero;
            } else if (out.result === "death") {
                hero.gold = Math.floor((hero.gold || 0) / 2);
            }
            if (hero.hp < hero.maxHp * 0.6) {
                innRest(hero);
            }
            shopSmart(hero);
            rows.push({
                campaign: c + 1,
                site: siteId,
                result: out.result,
                gold: hero.gold,
                level: hero.level,
                hp: hero.hp,
                maxHp: hero.maxHp,
                atk: hero.atk,
                def: hero.def
            });
        }
    }
    return rows;
}

// ---------------------------------------------------------------------------
// Analysis + reporting
// ---------------------------------------------------------------------------
function runAll() {
    const outcomes = [];
    for (const classId of CLASSES) {
        for (const siteId of SITES) {
            for (let i = 0; i < RUNS; i++) {
                outcomes.push(playRun(newHero(classId), siteId, BASE_SEED + i, TIER));
            }
        }
    }
    const campaigns = CHAIN > 0
        ? CLASSES.map(function (c) { return { classId: c, rows: runCampaign(c, CHAIN) }; })
        : [];

    const report = analyze(outcomes, campaigns);
    if (JSON_OUT) {
        console.log(JSON.stringify(report, null, 1));
        return;
    }
    print(outcomes, campaigns, report);
}

function mean(list, fn) {
    if (!list.length) { return 0; }
    return list.reduce(function (a, b) { return a + fn(b); }, 0) / list.length;
}
function share(list, fn) {
    if (!list.length) { return 0; }
    return Math.round(list.filter(fn).length / list.length * 100);
}

function analyze(outcomes, campaigns) {
    const byCombo = {};
    for (const o of outcomes) {
        const k = o.classId + "|" + o.site;
        byCombo[k] = byCombo[k] || [];
        byCombo[k].push(o);
    }
    const table = Object.keys(byCombo).sort().map(function (k) {
        const list = byCombo[k];
        return {
            combo: k,
            runs: list.length,
            clearPct: share(list, function (o) { return o.result === "clear" || o.result === "win"; }),
            winPct: share(list, function (o) { return o.result === "win"; }),
            deathPct: share(list, function (o) { return o.result === "death"; }),
            retreatPct: share(list, function (o) { return o.result === "retreat"; }),
            avgHpEnd: Math.round(mean(list, function (o) { return o.hpPctEnd; })),
            avgKills: Math.round(mean(list, function (o) { return o.kills; })),
            avgGold: Math.round(mean(list, function (o) { return o.goldEarned; })),
            avgLevel: Math.round(mean(list, function (o) { return o.levelEnd; }) * 10) / 10,
            avgActions: Math.round(mean(list, function (o) { return o.actions; }))
        };
    });

    const deathFloors = {};
    for (const o of outcomes) {
        if (o.result === "death") {
            deathFloors[o.deathFloor] = (deathFloors[o.deathFloor] || 0) + 1;
        }
    }
    const anomalies = outcomes.filter(function (o) { return o.result === "stuck" || o.result === "kited" || o.result === "unclosed" || o.result === "unfinished"; });

    return {
        meta: {
            classes: CLASSES,
            sites: SITES,
            runsPerCombo: RUNS,
            baseSeed: BASE_SEED,
            tier: TIER,
            totalRuns: outcomes.length
        },
        table: table,
        deathFloors: deathFloors,
        totals: {
            chestsSkipped: outcomes.reduce(function (a, o) { return a + o.chestsSkipped; }, 0),
            potionsUsed: outcomes.reduce(function (a, o) { return a + o.potionsUsed; }, 0),
            rewardsClaimed: outcomes.reduce(function (a, o) { return a + o.rewardClaims; }, 0),
            firstFloorDeaths: outcomes.filter(function (o) { return o.result === "death" && o.deathFloor === 1; }).length
        },
        anomalies: anomalies,
        campaigns: campaigns,
        worstRuns: outcomes.slice().sort(function (a, b) { return (b.result === "death" ? 0 : 1) - (a.result === "death" ? 0 : 1) || b.kills - a.kills; }).slice(0, 5).map(function (o) {
            return o.classId + "|" + o.site + "#" + o.seed + " " + o.result + " fl" + o.deathFloor + " k" + o.kills;
        })
    };
}

function print(outcomes, campaigns, report) {
    console.log("=== POCKET DUNGEON PLAYTEST HARNESS ===");
    console.log("sweep: " + report.meta.classes.join(",") + " x " + report.meta.sites.join(",") + " tier=" + report.meta.tier + " runs/combo=" + report.meta.runsPerCombo + " baseSeed=" + report.meta.baseSeed + " total=" + report.meta.totalRuns);
    console.log("");
    console.log("combo\truns\tclear%\twin%\tdeath%\tretr%\thpEnd%\tkills\tgold+\tlvl\tacts");
    for (const row of report.table) {
        console.log(row.combo + "\t" + row.runs + "\t" + row.clearPct + "\t" + row.winPct + "\t" + row.deathPct + "\t" + row.retreatPct + "\t" + row.avgHpEnd + "\t" + row.avgKills + "\t" + row.avgGold + "\t" + row.avgLevel + "\t" + row.avgActions);
    }
    console.log("");
    console.log("death profile by floor:");
    if (Object.keys(report.deathFloors).length) {
        Object.keys(report.deathFloors).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (fl) {
            console.log("  FL" + fl + ": " + report.deathFloors[fl]);
        });
    } else {
        console.log("  (no deaths)");
    }
    console.log("chests skipped(pack-full): " + report.totals.chestsSkipped + "  potions drunk: " + report.totals.potionsUsed + "  rewards claimed: " + report.totals.rewardsClaimed + "  FL1 deaths: " + report.totals.firstFloorDeaths);
    console.log("");

    if (report.anomalies.length) {
        const kinds = report.anomalies.map(function (a) { return a.result; }).filter(function (v, i, s) { return s.indexOf(v) === i; }).join(",");
        console.log("ANOMALIES (" + kinds + ") — investigate:");
        for (const a of report.anomalies.slice(0, 10)) {
            let why = "";
            if (a.result === "kited") { why = " (living acolyte never closed — clarity finding)"; }
            if (a.result === "unclosed") { why = " (mid-fight stall — balance/policy finding)"; }
            if (a.result === "stuck") { why = " (no fightable foe left — possible navigation soft-lock)"; }
            console.log("  " + a.classId + "|" + a.site + "#" + a.seed + " -> " + a.result + why);
            if (a.debug) {
                console.log("    board: " + JSON.stringify(a.debug));
            }
            if (a.trace) {
                console.log("    trace: " + a.trace);
            }
        }
    } else {
        console.log("No stuck or unfinished runs in the sweep.");
    }

    if (report.campaigns.length) {
        console.log("");
        console.log("=== CAMPAIGN (persistent hero + town economy) ===");
        for (const camp of report.campaigns) {
            const last = camp.rows[camp.rows.length - 1];
            const deaths = camp.rows.filter(function (r) { return r.result === "death"; }).length;
            console.log("  " + camp.classId + " deaths=" + deaths + " end=" + JSON.stringify(last));
        }
    }

    console.log("");
    console.log("=== OBSERVATIONS (candidate improvement areas) ===");
    for (const row of report.table) {
        if (row.clearPct < 40) {
            console.log("  [difficulty] " + row.combo + " clears " + row.clearPct + "% (" + row.deathPct + "% death) — look at the death-floor mix below.");
        } else if (row.clearPct >= 95) {
            console.log("  [difficulty] " + row.combo + " clears " + row.clearPct + "% — possibly too generous for a mid-skill agent.");
        }
        if (row.avgHpEnd < 25 && row.clearPct >= 40) {
            console.log("  [tension] " + row.combo + " wins arrive nearly dead (avg " + row.avgHpEnd + "% HP end) — healing cadence is tight.");
        }
        if (row.avgGold < 12 && row.clearPct >= 40) {
            console.log("  [economy] " + row.combo + " clears but nets only " + row.avgGold + "G — shop buys may feel unreachable.");
        }
        if (row.winPct > 0 && row.winPct < 20) {
            console.log("  [endgame] " + row.combo + " reaches the Ogre only " + row.winPct + "% of the time.");
        }
    }
    if (report.totals.chestsSkipped > 0) {
        console.log("  [pack] " + report.totals.chestsSkipped + " chest opens refused at full pack — no drop/sell option exists.");
    }
    if (report.totals.firstFloorDeaths > 0) {
        console.log("  [onboarding] " + report.totals.firstFloorDeaths + " deaths on floor 1 — early encounters may outweigh fresh kits.");
    }
    const nStuck = report.anomalies.filter(function (a) { return a.result === "stuck"; }).length;
    const nKited = report.anomalies.filter(function (a) { return a.result === "kited"; }).length;
    const nUnclosed = report.anomalies.filter(function (a) { return a.result === "unclosed"; }).length;
    if (nStuck) {
        console.log("  [engine] " + nStuck + " runs could not terminate with no fightable foe — possible navigation soft-lock (see trace).");
    }
    if (nKited) {
        console.log("  [clarity] " + nKited + " runs stalled on a living ACOLYTE — melee vs its back-away flee is obscure/hard; consider a bounded flee or clearer telegraph.");
    }
    if (nUnclosed) {
        console.log("  [balance] " + nUnclosed + " runs stalled mid-fight with foes alive (non-caster) — agent could not close; check the trace.");
    }
    const deep = Object.keys(report.deathFloors).map(Number).filter(function (f) { return f >= 6; });
    if (deep.length) {
        const worst = deep.reduce(function (a, b) { return report.deathFloors[a] >= report.deathFloors[b] ? a : b; });
        console.log("  [floor] deepest death spike is FL" + worst + " (" + report.deathFloors[worst] + " deaths).");
    }
    console.log("");
}

// ---------------------------------------------------------------------------
runAll();
