#!/usr/bin/env node
/* Perfect-policy probe: can a melee hero kill a lone acolyte in open floor?
 * Policy: never end a turn adjacent to a healthy acolyte.
 *  - adjacent at turn start  -> bump (it only gets adjacent by chasing)
 *  - acolyte chanting        -> bump now (it spent its turn)
 *  - distance > 2            -> step closer but land at distance >= 2
 *  - distance == 2           -> WAIT: acolyte chases into adjacency or chants
 */
"use strict";
const fs = require("fs");
const path = require("path");
const windowMock = {
    crypto: {
        getRandomValues: function (buf) {
            for (let i = 0; i < buf.length; i++) { buf[i] = Math.floor(Math.random() * 0x100000000); }
        }
    }
};
global.window = windowMock;
eval(fs.readFileSync(path.join(__dirname, "../js/dungeon.js"), "utf8"));
const PD = windowMock.PocketDungeon;

function curRoom(r) { return PD.getCurrentRoom ? PD.getCurrentRoom(r) : null; }

function tryDescend(r) {
    const room = curRoom(r);
    if (!room) return false;
    for (let y = 0; y < room.tiles.length; y++) {
        for (let x = 0; x < room.tiles[y].length; x++) {
            if (room.tiles[y][x] === ">") {
                const res = PD.tryAct(r, x, y, { seed: 0 });
                if (res && res.ok) return true;
            }
        }
    }
    return false;
}

function liveFoes(r) {
    const room = curRoom(r);
    return room ? (room.enemies || []).filter(e => e.hp > 0) : [];
}
function walkable(room, x, y) {
    const t = room.tiles[y] && room.tiles[y][x];
    return !!t && t !== "#" && t !== "+" && t !== "$";
}

let wins = 0, losses = 0, givesUp = 0, sawWound = 0;
const N = 30;
for (let seed = 1; seed <= N; seed++) {
    const hero = PD.createHero("knight", {});
    const run = PD.createSiteRun(hero, "hold", seed * 7919, {}, "t1");
    let guard = 0;
    while ((run.floor || 1) < 6 && guard++ < 80) { tryDescend(run); }
    if ((run.floor || 1) < 6) { givesUp++; continue; }
    // wander through rooms of this floor until we find exactly one acolyte
    let actions = 0;
    let result = "giveup";
    let e;
    for (let roomGuard = 0; roomGuard < 400 && result === "giveup"; roomGuard++) {
        const room = curRoom(run);
        if (!room) break;
        const foes = (room.enemies || []).filter(f => f.hp > 0);
        if (foes.length === 1 && foes[0].type === "acolyte") { result = "fight"; break; }
        // walk to a door tile and exit to the next room
        let moved = false;
        for (let y = 0; y < room.tiles.length && !moved; y++) {
            for (let x = 0; x < room.tiles[y].length && !moved; x++) {
                const ch = room.tiles[y][x];
                if (ch === "+") {
                    const res = PD.tryAct(run, x, y, { seed: actions++ });
                    moved = !!(res && res.ok);
                    if (moved && curRoom(run) === room) { /* same room: door walk is blocked by foes */ }
                    if (moved) { roomGuard = 0; }
                }
            }
        }
        if (!moved) break;
    }
    if (result !== "fight") { givesUp++; continue; }
    // fight the lone acolyte
    actions = 0;
    for (;;) {
        const foes = liveFoes(run);
        if (foes.length === 0) { result = "win"; break; }
        if (run.hp <= 0) { result = "loss"; break; }
        if (actions++ > 250) { result = "giveup"; break; }
        const foe = foes[0];
        const room = curRoom(run);
        const d = Math.abs(run.x - foe.x) + Math.abs(run.y - foe.y);
        const line = run.x === foe.x || run.y === foe.y;
        const tele = !!foe.telegraph;
        if (foe.hp < foe.maxHp && foe.hp < 6) sawWound = true;
        if (d === 1) {
            const res = PD.tryAct(run, foe.x, foe.y, { seed: actions });
            if (res && res.ok && res.logs) {
                const hit = res.logs.filter(l => /HIT|ACOLYTE|MISS|DEAD/.test(l));
                if (foe.hp < 6 && foe.hp > 0) sawWound = true;
            }
            continue;
        }
        if (tele && d <= 3 && line) {
            // chanting: step to adjacency or bump
            if (d === 1) {
                PD.tryAct(run, foe.x, foe.y, { seed: actions });
            } else {
                // path toward the acolyte one tile
                const path = PD.pathTo(run, foe.x, foe.y);
                if (path && path.length) { PD.tryAct(run, path[0].x, path[0].y, { seed: actions }); }
                else PD.waitTurn(run, { seed: actions });
            }
            continue;
        }
        if (d > 2) {
            // step closer, but land >= 2 away
            let best = null, bestD = 1e9;
            for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
                if ((dx && dy) || (!dx && !dy)) continue;
                const nx = run.x + dx, ny = run.y + dy;
                if (!walkable(room, nx, ny)) continue;
                if (nx === foe.x && ny === foe.y) continue;
                const nd = Math.abs(nx - foe.x) + Math.abs(ny - foe.y);
                if (nd >= 2 && nd < bestD) { bestD = nd; best = { x: nx, y: ny }; }
            }
            if (best) { PD.tryAct(run, best.x, best.y, { seed: actions }); }
            else PD.waitTurn(run, { seed: actions });
            continue;
        }
        // d === 2: wait for it to chase into adjacency or chant
        PD.waitTurn(run, { seed: actions });
    }
    if (result === "win") wins++;
    else if (result === "loss") losses++;
    else givesUp++;
    if (run.hp <= 0 && result === "win") { /* dead but foes cleared? shouldn't happen */ }
}
console.log("lone-acolyte open-room melee probe: wins=" + wins + " losses=" + losses + " giveups=" + givesUp + " (sawAcolyteWounded=" + sawWound + ") over " + N + " hold seeds");
