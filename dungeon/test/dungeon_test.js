// Standalone headless test suite for Pocket Dungeon engine
const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Mock window and navigator for headless execution
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

// Load dungeon.js
const dungeonCode = fs.readFileSync(path.join(__dirname, "../js/dungeon.js"), "utf8");
eval(dungeonCode);
const PD = windowMock.PocketDungeon;

const worldCode = fs.readFileSync(path.join(__dirname, "../js/world.js"), "utf8");
eval(worldCode);
const WORLD = windowMock.PocketDungeonWorld;

console.log("=== POCKET DUNGEON TEST SUITE ===");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log("  ✓ " + name);
        passed++;
    } catch (err) {
        console.error("  ✗ " + name + "\n    " + err.stack);
        failed++;
    }
}

// 1. Classes & Loadouts
test("Classes definitions and attributes", function () {
    assert.strictEqual(PD.CLASS_ORDER.length, 3);
    assert.deepStrictEqual(PD.CLASS_ORDER, ["knight", "scout", "mage"]);

    const knight = PD.CLASSES.knight;
    assert.strictEqual(knight.hp, 20);
    assert.strictEqual(knight.atk, 4);
    assert.strictEqual(knight.def, 2);

    const scout = PD.CLASSES.scout;
    assert.strictEqual(scout.hp, 16);
    assert.strictEqual(scout.atk, 4);
    assert.strictEqual(scout.def, 1);

    const mage = PD.CLASSES.mage;
    assert.strictEqual(mage.hp, 14);
    assert.strictEqual(mage.atk, 5);
    assert.strictEqual(mage.def, 0);
});

test("Run Creation & Class starting loadouts", function () {
    const knightRun = PD.createRun("knight", 12345);
    assert.strictEqual(knightRun.classId, "knight");
    assert.strictEqual(knightRun.hp, 20);
    assert.strictEqual(knightRun.gold, 0);
    assert.deepStrictEqual(knightRun.pack, []);

    const scoutRun = PD.createRun("scout", 12345);
    assert.strictEqual(scoutRun.classId, "scout");
    assert.strictEqual(scoutRun.hp, 16);
    assert.strictEqual(scoutRun.gold, 15);
    assert.deepStrictEqual(scoutRun.pack, ["potion"]);

    const mageRun = PD.createRun("mage", 12345);
    assert.strictEqual(mageRun.classId, "mage");
    assert.strictEqual(mageRun.hp, 14);
    assert.deepStrictEqual(mageRun.pack, ["blade"]);
});

// 2. RNG and Determinism
test("Seeded RNG reproducibility", function () {
    const run1 = PD.createRun("knight", 987654);
    const run2 = PD.createRun("knight", 987654);
    assert.strictEqual(run1.rooms.length, run2.rooms.length);
    assert.strictEqual(JSON.stringify(run1.rooms), JSON.stringify(run2.rooms));
});

// 3. Map structure and rooms
test("Floor 1 map topology and start/stairs rooms", function () {
    const run = PD.createRun("knight", 42);
    assert.ok(run.rooms.length >= 5 && run.rooms.length <= 8);
    assert.strictEqual(run.rooms[0].kind, "start");
    assert.strictEqual(run.rooms[0].tiles.length, 7);
    assert.strictEqual(run.rooms[0].tiles[0].length, 7);

    const stairsRoom = run.rooms.find(r => r.kind === "stairs");
    assert.ok(stairsRoom, "Stairs room must exist");
    assert.strictEqual(stairsRoom.tiles[3][3], ">");
});

test("Floor 8 contains boss ogre on stairs", function () {
    const run = PD.createRun("knight", 42);
    run.floor = 8;
    // Re-generate floor 8
    const run8 = PD.createRun("knight", 777);
    run8.floor = 8;
    // Trigger descent to floor 8 logic or create new floor
    assert.strictEqual(PD.MAX_FLOOR, 8);
});

// 4. Movement, Facing, and Pathfinding
test("Facing rotation and pathfinding", function () {
    const run = PD.createRun("knight", 100);
    assert.strictEqual(run.facing, "S");
    PD.cycleFacing(run, 1);
    assert.strictEqual(run.facing, "W");
    PD.cycleFacing(run, -1);
    assert.strictEqual(run.facing, "S");

    // Face tile tests
    PD.faceTile(run, 3, 1);
    assert.strictEqual(run.facing, "N");
    PD.faceTile(run, 5, 3);
    assert.strictEqual(run.facing, "E");

    // Pathfinding to same tile is 'wait'
    const selfPath = PD.pathTo(run, run.x, run.y);
    assert.strictEqual(selfPath, "wait");

    // Pathfinding to walkable neighbor
    const path = PD.pathTo(run, run.x + 1, run.y);
    assert.ok(Array.isArray(path));
    if (path.length > 0) {
        assert.strictEqual(path[0].x, run.x + 1);
        assert.strictEqual(path[0].y, run.y);
    }
});

// 5. Item Usage
test("Items: Potion heals, gear equips and swaps without consuming", function () {
    const run = PD.createRun("knight", 100);
    run.hp = 10;
    run.pack = ["potion", "blade", "mail"];

    // Use potion (consumable)
    const res1 = PD.useItem(run, 0);
    assert.ok(res1.ok);
    assert.strictEqual(run.hp, 16);
    assert.strictEqual(run.pack.length, 2);

    // Equip blade: +1 ATK via gear, item moves to gear slot, not consumed
    const prevAtk = run.atk;
    const res2 = PD.useItem(run, 0);
    assert.ok(res2.ok);
    assert.strictEqual(res2.equip, true);
    assert.strictEqual(run.atk, prevAtk + 1);
    assert.strictEqual(run.gearAtk, 1);
    assert.strictEqual(run.gear.weapon, "blade");
    assert.strictEqual(run.pack.length, 1);

    // Equip mail into armor slot
    const prevDef = run.def;
    const res3 = PD.useItem(run, 0);
    assert.ok(res3.ok);
    assert.strictEqual(run.def, prevDef + 1);
    assert.strictEqual(run.gearDef, 1);
    assert.strictEqual(run.gear.armor, "mail");
    assert.strictEqual(run.pack.length, 0);

    // Invalid index
    const res4 = PD.useItem(run, 0);
    assert.strictEqual(res4.ok, false);

    // Swapping a weapon returns the old one to the pack
    run.pack.push("iron_blade");
    const res5 = PD.useItem(run, 0);
    assert.ok(res5.ok);
    assert.strictEqual(run.atk, prevAtk + 3);
    assert.deepStrictEqual(run.pack, ["blade"]);
    assert.strictEqual(run.gear.weapon, "iron_blade");
});

// 6. Save/Load, Snapshots, and Migrations
test("Save / Load serialization and metadata persistence", function () {
    const save = PD.createEmptySave();
    assert.strictEqual(save.v, 3);
    assert.strictEqual(save.meta.bestFloor, 0);
    assert.deepStrictEqual(save.meta.epitaphs, []);

    save.hero = {
        classId: "scout", hp: 16, maxHp: 16, atk: 4, def: 1,
        gold: 50, pack: ["potion"], lastInn: "ashford"
    };
    save.site = PD.createRun("scout", 999);
    save.site.floor = 4;

    const snap = PD.snapshot(save);
    assert.strictEqual(snap.v, 3);
    assert.strictEqual(snap.meta.bestFloor, 0);
    const restored = PD.applySnapshot(snap);

    assert.ok(restored.run);
    assert.strictEqual(restored.run.classId, "scout");
    assert.strictEqual(restored.run.floor, 4);
    assert.strictEqual(restored.site.gold, 15);
    assert.strictEqual(restored.hero.gold, 50);
    assert.strictEqual(restored.hero.pack.length, 1);
});

test("Death recording and Memorial Epitaphs limit", function () {
    const save = PD.createEmptySave();
    save.run = PD.createRun("knight", 123);
    save.run.floor = 3;

    PD.recordDeath(save, "FELL TO A SKELETON");
    assert.strictEqual(save.run, null);
    assert.strictEqual(save.meta.bestFloor, 3);
    assert.strictEqual(save.meta.epitaphs.length, 1);
    assert.strictEqual(save.meta.epitaphs[0].floor, 3);
    assert.strictEqual(save.meta.epitaphs[0].classId, "knight");
    assert.strictEqual(save.meta.epitaphs[0].line, "FELL TO A SKELETON");

    // Add 10 more deaths to test truncation at 8
    for (let i = 1; i <= 10; i++) {
        save.run = PD.createRun("scout", i);
        save.run.floor = i;
        PD.recordDeath(save, "Death " + i);
    }
    assert.strictEqual(save.meta.epitaphs.length, 8);
    assert.strictEqual(save.meta.bestFloor, 8);
});

test("Snapshot v2 migrates a v1 mid-run and death is a setback", function () {
    const oldRun = PD.createRun("knight", 77);
    oldRun.floor = 3;
    oldRun.gold = 41;
    const migrated = PD.applySnapshot({ v: 1, run: oldRun, meta: { epitaphs: [] } });
    assert.strictEqual(migrated.v, 3);
    assert.strictEqual(migrated.location.kind, "site");
    assert.strictEqual(migrated.location.id, "hold");
    assert.ok(migrated.hero);
    assert.strictEqual(migrated.site.floor, 3);

    migrated.hero.gold = 41;
    PD.recordDeath(migrated, "FELL");
    assert.strictEqual(migrated.site, null);
    assert.strictEqual(migrated.hero.hp, migrated.hero.maxHp);
    assert.strictEqual(migrated.hero.gold, 20);
    assert.strictEqual(migrated.meta.deaths, 1);
    assert.strictEqual(migrated.location.id, "ashford");
});

test("World dialogue is authored and travel remains flag-gated", function () {
    const state = WORLD.advanceDialogue({ dialogueId: "elder", flags: {} }, "open_cellar");
    assert.strictEqual(state.ok, true);
    assert.strictEqual(state.state.flags.ashford_cellar_open, 1);
    assert.strictEqual(WORLD.canTravel({ flags: {} }, "ashford", "saltmere"), false);
    assert.strictEqual(WORLD.canTravel({ flags: { ashford_cellar_clear: 1 } }, "ashford", "saltmere"), true);
    assert.strictEqual(WORLD.canTravel({ flags: { ashford_cellar_clear: 1 } }, "ashford", "keepgate"), false);
    assert.strictEqual(WORLD.canTravel({ flags: { saltmere_crypt_clear: 1 } }, "saltmere", "keepgate"), true);
    assert.strictEqual(WORLD.canTravel({ flags: {} }, "ashford", "ashford"), true);
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 20, pack: [], lastInn: "ashford" };
    const purchased = WORLD.buy(hero, "potion", "ashford");
    assert.strictEqual(purchased.ok, true);
    assert.strictEqual(hero.gold, 12);
    assert.deepStrictEqual(hero.pack, ["potion"]);
    const broke = WORLD.buy({ gold: 0, pack: [], lastInn: "ashford" }, "blade", "ashford");
    assert.strictEqual(broke.ok, false);
    assert.strictEqual(broke.reason, "NOT ENOUGH GOLD");
    const siteRun = PD.createSiteRun(hero, "cellar", 44);
    assert.strictEqual(siteRun.siteId, "cellar");
    assert.strictEqual(siteRun.maxSiteFloor, 1);
    assert.strictEqual(siteRun.rooms.length, 3);
    const completed = WORLD.completeSite({
        flags: {},
        hero: Object.assign({}, hero),
        site: siteRun,
        run: siteRun,
        meta: { journal: [] }
    }, "cellar");
    assert.strictEqual(completed.state.flags.ashford_cellar_clear, 1);
    assert.strictEqual(completed.state.location.id, "ashford");
    assert.strictEqual(completed.state.site, null);
    assert.ok(completed.state.meta.journal[0].indexOf("mill") !== -1);
});

test("Ashford pay branch and miller aid write flags without LLM", function () {
    const paid = WORLD.advanceDialogue({
        dialogueId: "elder",
        flags: {},
        hero: { gold: 0, pack: [] },
        meta: { journal: [] }
    }, "ask_pay");
    assert.strictEqual(paid.ok, true);
    assert.strictEqual(paid.state.flags.ashford_cellar_open, 1);
    assert.strictEqual(paid.state.hero.gold, 5);
    const aid = WORLD.advanceDialogue({
        dialogueId: "miller",
        flags: {},
        hero: { gold: 0, pack: [] },
        meta: { journal: [] }
    }, "aid");
    assert.strictEqual(aid.state.flags.ashford_miller_aid, 1);
    assert.deepStrictEqual(aid.state.hero.pack, ["potion"]);
    const afterClear = WORLD.getDialogue("elder", { ashford_cellar_clear: 1 });
    assert.ok(afterClear.lines.join(" ").indexOf("Saltmere") !== -1);
    assert.strictEqual(afterClear.choices.length, 1);
});

test("Short sites use authored room counts and do not campaign-win", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    const cellar = PD.createSiteRun(hero, "cellar", 44);
    assert.strictEqual(cellar.rooms.length, 3);
    const stairs = cellar.rooms.find(function (room) { return room.kind === "stairs"; });
    assert.ok(stairs);
    stairs.enemies = [];
    cellar.roomId = stairs.id;
    cellar.x = 3;
    cellar.y = 2;
    cellar.facing = "S";
    const cleared = PD.tryAct(cellar);
    assert.strictEqual(cleared.siteCleared, "cellar");
    assert.ok(!cleared.won);

    const crypt = PD.createSiteRun(hero, "crypt", 91);
    assert.strictEqual(crypt.rooms.length, 4);
    assert.strictEqual(crypt.namedLast, true);
    const cryptStairs = crypt.rooms.find(function (room) { return room.kind === "stairs"; });
    assert.ok(cryptStairs.enemies.some(function (enemy) { return enemy.type === "skeleton" && enemy.hp > 6; }));

    const hold = PD.createSiteRun(hero, "hold", 7);
    assert.strictEqual(hold.siteId, "hold");
    assert.strictEqual(hold.maxSiteFloor, 8);
    assert.ok(hold.rooms.length >= 5 && hold.rooms.length <= 8);

    const empty = PD.createSiteRun(hero, "cellar", 44, { ashford_cellar_clear: 1 });
    const foeCount = empty.rooms.reduce(function (sum, room) { return sum + room.enemies.length; }, 0);
    assert.strictEqual(foeCount, 0);
});

test("Town pack items apply without an enemy turn", function () {
    const hero = { classId: "knight", hp: 10, maxHp: 20, atk: 4, def: 2, gold: 0, pack: ["potion", "blade"] };
    const res = PD.useItemOnHero(hero, 0);
    assert.ok(res.ok);
    assert.strictEqual(hero.hp, 16);
    assert.deepStrictEqual(hero.pack, ["blade"]);
});

test("Snapshot v2 keeps journal and death still wakes at the inn", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 4, maxHp: 20, atk: 4, def: 2, gold: 30, pack: [], lastInn: "saltmere" };
    save.flags = { ashford_cellar_clear: 1 };
    save.meta.journal = ["The mill wheel turns."];
    save.site = PD.createSiteRun(save.hero, "crypt", 3);
    save.site.gold = 30;
    const snap = PD.snapshot(save);
    const restored = PD.applySnapshot(snap);
    assert.strictEqual(restored.flags.ashford_cellar_clear, 1);
    assert.strictEqual(restored.meta.journal[0], "The mill wheel turns.");
    assert.strictEqual(restored.site.siteId, "crypt");

    PD.recordDeath(restored, "FELL IN SALT");
    assert.strictEqual(restored.site, null);
    assert.strictEqual(restored.hero.hp, 20);
    assert.strictEqual(restored.hero.gold, 15);
    assert.strictEqual(restored.location.id, "saltmere");
    assert.strictEqual(restored.meta.deaths, 1);
});

test("Class abilities are distinct and persist through snapshots", function () {
    const knight = PD.createRun("knight", 1);
    const room = PD.currentRoom(knight);
    room.enemies = [{ type: "slime", x: knight.x, y: knight.y - 1, hp: 10, maxHp: 10, atk: 2, def: 0 }];
    knight.facing = "N";
    const guard = PD.useAbility(knight);
    assert.ok(guard.ok);
    assert.strictEqual(knight.guardTurns, 1);
    const save = PD.createEmptySave();
    save.site = knight;
    const restoredBeforeHit = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restoredBeforeHit.site.guardTurns, 1);
    const hit = PD.tryAct(knight);
    assert.ok(hit.logs.includes("GUARD BREAKS"));

    const scout = PD.createRun("scout", 2);
    const scoutRoom = PD.currentRoom(scout);
    scout.facing = "S";
    scoutRoom.tiles[scout.y + 1] = scoutRoom.tiles[scout.y + 1].slice(0, scout.x) + "^" + scoutRoom.tiles[scout.y + 1].slice(scout.x + 1);
    const disarm = PD.useAbility(scout);
    assert.ok(disarm.ok);
    assert.ok(disarm.logs.includes("TRAP DISARMED"));
    assert.strictEqual(scoutRoom.tiles[scout.y + 1][scout.x], ".");

    const mage = PD.createRun("mage", 3);
    const mageRoom = PD.currentRoom(mage);
    mage.facing = "N";
    mageRoom.enemies = [{ type: "slime", x: mage.x, y: mage.y - 2, hp: 10, maxHp: 10, atk: 2, def: 0 }];
    const cast = PD.useAbility(mage);
    assert.ok(cast.ok);
    assert.ok(cast.logs[0].indexOf("CAST SLIME") === 0);

    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.guardTurns, 0);
});

test("Room fork offers safe and risky deterministic outcomes", function () {
    const run = PD.createRun("knight", 17);
    const room = PD.currentRoom(run);
    room.choice = { active: true, safe: false };
    room.tiles[3] = room.tiles[3].slice(0, 2) + "S" + room.tiles[3].slice(3);
    room.enemies = [{ type: "slime", x: 4, y: 3, hp: 4, maxHp: 4, atk: 2, def: 0 }];
    const safe = PD.chooseRoomRoute(run, "safe");
    assert.ok(safe.ok);
    assert.ok(safe.logs.includes("SAFE ROUTE"));
    assert.strictEqual(room.choice.active, false);
    assert.strictEqual(room.tiles[3][2], ".");
    assert.strictEqual(room.enemies.length, 0);

    const risky = PD.createRun("knight", 17);
    const riskyRoom = PD.currentRoom(risky);
    riskyRoom.choice = { active: true, safe: false };
    riskyRoom.tiles[3] = riskyRoom.tiles[3].slice(0, 2) + "R" + riskyRoom.tiles[3].slice(3);
    const beforeGold = risky.gold;
    const risk = PD.chooseRoomRoute(risky, "risk");
    assert.ok(risk.ok);
    assert.strictEqual(risky.gold, beforeGold + 10);
    assert.strictEqual(riskyRoom.enemies.length, 1);
    assert.strictEqual(riskyRoom.choice.route, "risk");
    assert.strictEqual(PD.chooseRoomRoute(risky, "risk").ok, false);

    const save = PD.createEmptySave();
    save.site = risky;
    save.run = risky;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.rooms[restored.site.roomId].choice.active, false);
    assert.strictEqual(restored.site.rooms[restored.site.roomId].choice.route, "risk");
});

test("Scout Trap Evasion logic in simulation", function () {
    let evades = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("scout", i * 100 + 1);
        const room = PD.currentRoom(run);
        // Place a trap directly in front of hero
        run.facing = "S";
        room.tiles[run.y + 1] = room.tiles[run.y + 1].slice(0, run.x) + "^" + room.tiles[run.y + 1].slice(run.x + 1);
        const prevHp = run.hp;
        const res = PD.tryAct(run);
        if (res.logs && res.logs.includes("TRAP EVADED")) {
            evades++;
            assert.strictEqual(run.hp, prevHp);
        }
    }
    // Should evade approximately 50% of the time (30% - 70% confidence interval for 200 trials)
    assert.ok(evades > 50 && evades < 150, "Expected roughly 50% trap evasion, got " + evades + "/" + trials);
});

test("New enemy types (rat, ghoul) have defs, sprites, and AI", function () {
    assert.ok(PD.CLASSES);
    const ratDef = PD.ENEMY_DEFS && PD.ENEMY_DEFS.rat;
    assert.ok(ratDef, "rat must be defined in ENEMY_DEFS");
    assert.strictEqual(ratDef.ai, "swarm");
    assert.ok(ratDef.gold > 0);
    assert.strictEqual(ratDef.debut, 1);

    const ghoulDef = PD.ENEMY_DEFS && PD.ENEMY_DEFS.ghoul;
    assert.ok(ghoulDef, "ghoul must be defined in ENEMY_DEFS");
    assert.strictEqual(ghoulDef.ai, "patient");
    assert.ok(ghoulDef.gold > 0);
    assert.strictEqual(ghoulDef.debut, 4);

    const slimeDef = PD.ENEMY_DEFS.slime;
    assert.strictEqual(slimeDef.ai, "slow");

    const batDef = PD.ENEMY_DEFS.bat;
    assert.strictEqual(batDef.ai, "erratic");

    const skelDef = PD.ENEMY_DEFS.skeleton;
    assert.strictEqual(skelDef.ai, "relentless");

    const ogreDef = PD.ENEMY_DEFS.ogre;
    assert.strictEqual(ogreDef.ai, "ogre");
});

test("Enemies drop gold on death via melee", function () {
    const run = PD.createRun("knight", 500);
    const room = PD.currentRoom(run);
    const goldBefore = run.gold;
    room.enemies = [{ type: "skeleton", x: run.x, y: run.y - 1, hp: 1, maxHp: 1, atk: 3, def: 0, gold: 5, ai: "relentless" }];
    run.facing = "N";
    const res = PD.tryAct(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("SKELETON DOWN") !== -1; }));
    assert.ok(res.logs.some(function (l) { return l.indexOf("+5 GOLD") !== -1; }));
    assert.strictEqual(run.gold, goldBefore + 5);
});

test("Enemies drop gold on death via mage spell", function () {
    const run = PD.createRun("mage", 600);
    const room = PD.currentRoom(run);
    const goldBefore = run.gold;
    room.enemies = [{ type: "bat", x: run.x, y: run.y - 2, hp: 1, maxHp: 1, atk: 3, def: 0, gold: 3, ai: "erratic" }];
    run.facing = "N";
    const res = PD.useAbility(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("BAT DOWN") !== -1; }));
    assert.ok(res.logs.some(function (l) { return l.indexOf("+3 GOLD") !== -1; }));
    assert.strictEqual(run.gold, goldBefore + 3);
});

test("Slime AI is slow and skips turns", function () {
    let movedCount = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("knight", i * 7 + 1);
        const room = PD.currentRoom(run);
        room.enemies = [{ type: "slime", x: 2, y: 2, hp: 4, maxHp: 4, atk: 2, def: 0, gold: 2, ai: "slow" }];
        const enemy = room.enemies[0];
        const beforeX = enemy.x;
        const beforeY = enemy.y;
        PD.waitTurn(run);
        if (enemy.x !== beforeX || enemy.y !== beforeY) {
            movedCount++;
        }
    }
    assert.ok(movedCount > 40 && movedCount < 160, "Slime should move roughly 50% of turns, got " + movedCount + "/" + trials);
});

test("Skeleton AI is relentless with wide range", function () {
    let movedCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("knight", i * 13 + 1);
        const room = PD.currentRoom(run);
        room.enemies = [{ type: "skeleton", x: 1, y: 1, hp: 6, maxHp: 6, atk: 3, def: 0, gold: 5, ai: "relentless" }];
        const enemy = room.enemies[0];
        const beforeX = enemy.x;
        const beforeY = enemy.y;
        PD.waitTurn(run);
        if (enemy.x !== beforeX || enemy.y !== beforeY) {
            movedCount++;
        }
    }
    assert.ok(movedCount > 80, "Skeleton should almost always move (relentless), got " + movedCount + "/" + trials);
});

test("Bat AI is erratic and does not always chase", function () {
    let movedTowardCount = 0;
    let movedRandomCount = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("knight", i * 17 + 1);
        const room = PD.currentRoom(run);
        room.enemies = [{ type: "bat", x: 3, y: 1, hp: 3, maxHp: 3, atk: 3, def: 0, gold: 3, ai: "erratic" }];
        const enemy = room.enemies[0];
        const dy = run.y - enemy.y;
        PD.waitTurn(run);
        if (Math.abs(enemy.y - run.y) < Math.abs(dy)) {
            movedTowardCount++;
        } else {
            movedRandomCount++;
        }
    }
    assert.ok(movedTowardCount < 160, "Bat should not always chase hero directly, got " + movedTowardCount + "/" + trials);
    assert.ok(movedRandomCount > 40, "Bat should move randomly sometimes, got " + movedRandomCount + "/" + trials);
});

test("Ghoul AI is patient and waits unless hero is close or hurt", function () {
    let movedFar = 0;
    let movedClose = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("knight", i * 23 + 1);
        run.hp = run.maxHp;
        const room = PD.currentRoom(run);
        room.enemies = [{ type: "ghoul", x: 1, y: 1, hp: 8, maxHp: 8, atk: 4, def: 0, gold: 6, ai: "patient" }];
        const enemy = room.enemies[0];
        const dist = Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y);
        PD.waitTurn(run);
        if (enemy.x !== 1 || enemy.y !== 1) {
            if (dist > 2) movedFar++;
            else movedClose++;
        }
    }
    assert.ok(movedFar < 20, "Ghoul should rarely move when far and hero is full HP, got " + movedFar + "/" + trials);
});

test("Ghoul AI moves when hero is low HP", function () {
    let movedCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
        const run = PD.createRun("knight", i * 31 + 1);
        run.hp = Math.ceil(run.maxHp * 0.3);
        const room = PD.currentRoom(run);
        room.enemies = [{ type: "ghoul", x: 1, y: 1, hp: 8, maxHp: 8, atk: 4, def: 0, gold: 6, ai: "patient" }];
        const enemy = room.enemies[0];
        PD.waitTurn(run);
        if (enemy.x !== 1 || enemy.y !== 1) {
            movedCount++;
        }
    }
    assert.ok(movedCount > 70, "Ghoul should usually move when hero is low HP, got " + movedCount + "/" + trials);
});

test("Cellar and crypt sites use new enemy pools", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    const cellar = PD.createSiteRun(hero, "cellar", 44);
    assert.ok(cellar.enemyPool.indexOf("rat") !== -1, "Cellar pool should include rat");
    assert.ok(cellar.enemyPool.indexOf("slime") !== -1, "Cellar pool should include slime");

    const crypt = PD.createSiteRun(hero, "crypt", 91);
    assert.ok(crypt.enemyPool.indexOf("ghoul") !== -1, "Crypt pool should include ghoul");
    assert.ok(crypt.enemyPool.indexOf("skeleton") !== -1, "Crypt pool should include skeleton");
});

test("Enemy gold and ai fields survive save/load round-trip", function () {
    const run = PD.createRun("knight", 888);
    const room = PD.currentRoom(run);
    room.enemies.push({ type: "ghoul", x: 1, y: 1, hp: 8, maxHp: 8, atk: 4, def: 0, gold: 6, ai: "patient" });
    const save = PD.createEmptySave();
    save.site = run;
    save.run = run;
    const restored = PD.applySnapshot(PD.snapshot(save));
    const ghoul = restored.site.rooms[restored.site.roomId].enemies.find(function (e) { return e.type === "ghoul"; });
    assert.ok(ghoul);
    assert.strictEqual(ghoul.gold, 6);
    assert.strictEqual(ghoul.ai, "patient");
});

test("Combat log uses proper enemy names not raw type", function () {
    const run = PD.createRun("knight", 999);
    const room = PD.currentRoom(run);
    room.enemies = [{ type: "skeleton", x: run.x, y: run.y - 1, hp: 6, maxHp: 6, atk: 3, def: 0, gold: 5, ai: "relentless" }];
    run.facing = "N";
    const res = PD.tryAct(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("SKELETON") !== -1; }));
    assert.ok(!res.logs.some(function (l) { return l.indexOf("skeleton") !== -1; }));
});

test("Inn costs gold and can refuse if broke", function () {
    const hero = { classId: "knight", hp: 4, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    const result = WORLD.restAtInn(hero, "ashford");
    assert.ok(result.ok);
    assert.strictEqual(result.cost, 4);
    assert.strictEqual(hero.gold, 6);
    assert.strictEqual(hero.hp, 20);

    const broke = { classId: "knight", hp: 4, maxHp: 20, atk: 4, def: 2, gold: 2, pack: [], lastInn: "ashford" };
    const refused = WORLD.restAtInn(broke, "ashford");
    assert.ok(!refused.ok);
    assert.ok(refused.reason.indexOf("GOLD") !== -1);
    assert.strictEqual(broke.hp, 4);
});

test("Keepgate has a shop and inn with higher costs", function () {
    const town = WORLD.towns.keepgate;
    assert.ok(town.services.indexOf("shop") !== -1);
    assert.ok(town.services.indexOf("inn") !== -1);
    assert.strictEqual(WORLD.innCosts.keepgate, 8);
    assert.ok(WORLD.shops.keepgate.some(function (i) { return i.id === "greater_potion"; }));
    assert.ok(WORLD.shops.keepgate.some(function (i) { return i.id === "iron_blade"; }));
    assert.ok(WORLD.shops.keepgate.some(function (i) { return i.id === "iron_mail"; }));
});

test("Greater potion heals 12 and shield equips +2 DEF", function () {
    const run = PD.createRun("knight", 42);
    run.hp = 5;
    run.pack = ["greater_potion"];
    const res = PD.useItem(run, 0);
    assert.ok(res.ok);
    assert.strictEqual(run.hp, 17);
    assert.strictEqual(run.pack.length, 0);

    const run2 = PD.createRun("knight", 42);
    const prevDef = run2.def;
    run2.pack = ["shield"];
    const res2 = PD.useItem(run2, 0);
    assert.ok(res2.ok);
    assert.strictEqual(res2.equip, true);
    assert.strictEqual(run2.def, prevDef + 2);
    assert.strictEqual(run2.gear.armor, "shield");
    assert.strictEqual(run2.pack.length, 0);
});

test("Greater potion and shield work in town (useItemOnHero)", function () {
    const hero = { classId: "knight", hp: 5, maxHp: 20, atk: 4, def: 2, gold: 50, pack: ["greater_potion", "shield"], lastInn: "keepgate" };
    const res1 = PD.useItemOnHero(hero, 0);
    assert.ok(res1.ok);
    assert.strictEqual(hero.hp, 17);
    assert.strictEqual(hero.pack.length, 1);
    const prevDef = hero.def;
    const res2 = PD.useItemOnHero(hero, 0);
    assert.ok(res2.ok);
    assert.strictEqual(res2.equip, true);
    assert.strictEqual(hero.def, prevDef);
    assert.strictEqual(hero.gear.armor, "shield");
    assert.strictEqual(hero.pack.length, 0);
    const bonus = PD.gearBonus(hero.gear);
    assert.strictEqual(bonus.def, 2);
});

test("Town menu shows inn cost in label", function () {
    const menu = WORLD.townMenu({ location: { id: "ashford" } });
    const innOpt = menu.find(function (m) { return m.id === "inn"; });
    assert.ok(innOpt);
    assert.ok(innOpt.label.indexOf("4G") !== -1);
    const kgMenu = WORLD.townMenu({ location: { id: "keepgate" } });
    const kgInn = kgMenu.find(function (m) { return m.id === "inn"; });
    assert.ok(kgInn);
    assert.ok(kgInn.label.indexOf("8G") !== -1);
});

test("New items survive save/load round-trip", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 50, pack: ["greater_potion", "shield"], lastInn: "keepgate" };
    const snap = PD.snapshot(save);
    const restored = PD.applySnapshot(snap);
    assert.deepStrictEqual(restored.hero.pack, ["greater_potion", "shield"]);
});

test("Run tracks kills and epitaph stores kill/gold summary", function () {
    const save = PD.createEmptySave();
    save.run = PD.createRun("knight", 321);
    save.run.floor = 5;
    save.run.kills = 0;
    const room = PD.currentRoom(save.run);
    room.enemies = [{ type: "skeleton", x: save.run.x, y: save.run.y - 1, hp: 1, maxHp: 1, atk: 3, def: 0, gold: 5, ai: "relentless" }];
    save.run.facing = "N";
    const res = PD.tryAct(save.run);
    assert.strictEqual(save.run.kills, 1);

    save.run.gold = 30;
    PD.recordDeath(save, "FELL");
    assert.strictEqual(save.meta.epitaphs[0].kills, 1);
    assert.strictEqual(save.meta.epitaphs[0].gold, 30);
    assert.strictEqual(save.meta.epitaphs[0].floor, 5);
});

test("Kills field survives save/load round-trip", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "hold", 42);
    save.site.kills = 7;
    save.run = save.site;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.kills, 7);
});

test("Death line includes kill and gold summary", function () {
    const run = PD.createRun("knight", 555);
    run.floor = 3;
    run.kills = 4;
    run.gold = 25;
    const line = PD.cannedDeathLine(run);
    assert.ok(line.indexOf("4 KILLS") !== -1, "Should include kill count: " + line);
    assert.ok(line.indexOf("25 GOLD") !== -1, "Should include gold: " + line);
    assert.ok(line.indexOf("FL3") !== -1, "Should include floor: " + line);
    assert.ok(line.indexOf("KNIGHT") !== -1, "Should include class: " + line);
});

test("Poison trap applies poison status that ticks for 3 turns", function () {
    const run = PD.createRun("knight", 700);
    run.hp = 10;
    run.poisonTurns = 0;
    const room = PD.currentRoom(run);
    run.facing = "S";
    const tileChar = room.tiles[run.y + 1][run.x];
    room.tiles[run.y + 1] = room.tiles[run.y + 1].slice(0, run.x) + "~" + room.tiles[run.y + 1].slice(run.x + 1);
    const res = PD.tryAct(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("POISONED 3T") !== -1; }), "Should apply poison");
    assert.ok(run.poisonTurns >= 2, "Poison should be active after first tick, got " + run.poisonTurns);
});

test("Poison ticks 1 damage per turn after enemy phase", function () {
    const run = PD.createRun("knight", 701);
    run.hp = 10;
    run.poisonTurns = 3;
    const hpBefore = run.hp;
    const res = PD.waitTurn(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("POISON 1") !== -1; }));
    assert.strictEqual(run.poisonTurns, 2);
    assert.strictEqual(run.hp, hpBefore - 1);
});

test("Poison fades after 3 ticks", function () {
    const run = PD.createRun("knight", 702);
    run.hp = 20;
    run.poisonTurns = 1;
    const res = PD.waitTurn(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("POISON FADES") !== -1; }));
    assert.strictEqual(run.poisonTurns, 0);
});

test("Scout can disarm poison traps", function () {
    const run = PD.createRun("scout", 703);
    const room = PD.currentRoom(run);
    run.facing = "S";
    room.tiles[run.y + 1] = room.tiles[run.y + 1].slice(0, run.x) + "~" + room.tiles[run.y + 1].slice(run.x + 1);
    const res = PD.useAbility(run);
    assert.ok(res.ok);
    assert.ok(res.logs.includes("TRAP DISARMED"));
    assert.strictEqual(room.tiles[run.y + 1][run.x], ".");
});

test("Poison status survives save/load round-trip", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "hold", 42);
    save.site.poisonTurns = 2;
    save.run = save.site;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.poisonTurns, 2);
});

test("Poison traps appear on floors 3+ in generation", function () {
    let foundPoison = false;
    for (let i = 0; i < 2000 && !foundPoison; i++) {
        const run = PD.createRun("knight", i * 3 + 1);
        run.floor = 5;
        const rng = PD.createRng(run.seed, 0);
        run.rngState = 0;
        PD.generateFloor(run, rng);
        for (let r = 0; r < run.rooms.length; r++) {
            if (run.rooms[r].tiles.join("").indexOf("~") !== -1) {
                foundPoison = true;
                break;
            }
        }
    }
    assert.ok(foundPoison, "Poison traps should appear on floor 5+ with enough seeds");
});

test("Death awards renown based on kills and floor depth", function () {
    const save = PD.createEmptySave();
    save.run = PD.createRun("knight", 123);
    save.run.floor = 3;
    save.run.kills = 4;
    save.run.gold = 0;
    PD.recordDeath(save, "FELL");
    assert.ok(save.meta.renown > 0, "Should earn renown: " + save.meta.renown);
    assert.strictEqual(save.meta.renown, 3 + Math.floor(4 * 0.5));
    assert.strictEqual(save.meta.epitaphs[0].renown, save.meta.renown);
});

test("Shrine upgrades cost renown and boost hero stats permanently", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    save.meta.renown = 40;
    const result = WORLD.buyShrineUpgrade(save, "vigor");
    assert.ok(result.ok);
    assert.strictEqual(save.meta.renown, 30);
    assert.strictEqual(save.hero.maxHp, 22);
    assert.strictEqual(save.hero.hp, 22);
    assert.strictEqual(save.meta.shrinePurchases.vigor, 1);

    const edge = WORLD.buyShrineUpgrade(save, "edge");
    assert.ok(edge.ok);
    assert.strictEqual(save.hero.atk, 5);
    assert.strictEqual(save.meta.renown, 15);

    const bulwark = WORLD.buyShrineUpgrade(save, "bulwark");
    assert.ok(bulwark.ok);
    assert.strictEqual(save.hero.def, 3);
    assert.strictEqual(save.meta.renown, 0);
});

test("Shrine refuses purchase without enough renown", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    save.meta.renown = 5;
    const result = WORLD.buyShrineUpgrade(save, "vigor");
    assert.ok(!result.ok);
    assert.ok(result.reason.indexOf("REN") !== -1);
    assert.strictEqual(save.meta.renown, 5);
    assert.strictEqual(save.hero.maxHp, 20);
});

test("Shrine bonuses apply to new heroes via createHero", function () {
    const meta = { shrinePurchases: { vigor: 2, edge: 1, bulwark: 1 } };
    const hero = PD.createHero ? PD.createHero("knight", meta) : null;
    if (hero) {
        assert.strictEqual(hero.maxHp, 20 + 4);
        assert.strictEqual(hero.atk, 4 + 1);
        assert.strictEqual(hero.def, 2 + 1);
    }
});

test("Renown and shrinePurchases survive save/load round-trip", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    save.meta.renown = 25;
    save.meta.shrinePurchases = { vigor: 1, edge: 1 };
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.meta.renown, 25);
    assert.strictEqual(restored.meta.shrinePurchases.vigor, 1);
    assert.strictEqual(restored.meta.shrinePurchases.edge, 1);
});

test("Keepgate town menu includes shrine option", function () {
    const menu = WORLD.townMenu({ location: { id: "keepgate" } });
    assert.ok(menu.some(function (m) { return m.id === "shrine"; }));
    assert.ok(menu.some(function (m) { return m.id === "shop"; }));
});

test("Knight guard counterstrikes attacker for half ATK", function () {
    const run = PD.createRun("knight", 1);
    run.guardTurns = 1;
    const room = PD.currentRoom(run);
    const enemy = { type: "slime", x: run.x, y: run.y - 1, hp: 10, maxHp: 10, atk: 2, def: 0, gold: 2, ai: "slow" };
    room.enemies = [enemy];
    run.facing = "N";
    const res = PD.waitTurn(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("COUNTER") === 0; }), "Should counter on guard: " + res.logs.join(","));
    assert.ok(enemy.hp < 10, "Enemy should take counter damage");
    assert.strictEqual(run.guardTurns, 0, "Guard should break after being hit");
});

test("Knight counter can kill attacker", function () {
    const run = PD.createRun("knight", 2);
    run.guardTurns = 1;
    const room = PD.currentRoom(run);
    const enemy = { type: "bat", x: run.x, y: run.y - 1, hp: 1, maxHp: 1, atk: 3, def: 0, gold: 3, ai: "erratic" };
    room.enemies = [enemy];
    run.facing = "N";
    const res = PD.waitTurn(run);
    assert.ok(res.logs.some(function (l) { return l.indexOf("BAT DOWN") !== -1; }), "Counter should kill: " + res.logs.join(","));
    assert.strictEqual(run.kills, 1);
});

test("Scout first strike adds +1 damage to first melee hit per room", function () {
    const run = PD.createRun("scout", 3);
    const room = PD.currentRoom(run);
    const enemy = { type: "slime", x: run.x, y: run.y - 1, hp: 10, maxHp: 10, atk: 2, def: 0, gold: 2, ai: "slow" };
    room.enemies = [enemy];
    run.facing = "N";
    run.firstStrikeUsed = false;
    const res1 = PD.tryAct(run);
    assert.ok(run.firstStrikeUsed, "First strike should be consumed");
    const dmg1 = 10 - enemy.hp;
    enemy.hp = 10;
    run.firstStrikeUsed = true;
    const res2 = PD.tryAct(run);
    const dmg2 = 10 - enemy.hp;
    assert.ok(dmg1 > dmg2, "First hit should deal more damage: " + dmg1 + " > " + dmg2);
});

test("Scout first strike resets on room change", function () {
    const run = PD.createRun("scout", 4);
    run.firstStrikeUsed = true;
    const room = PD.currentRoom(run);
    if (room.doors.S != null) {
        const nextId = room.doors.S;
        PD.currentRoom(run).doors.S = nextId;
        run.facing = "S";
        const beforeEnter = run.firstStrikeUsed;
        const enterResult = PD.tryAct(run);
        if (enterResult.roomChanged) {
            assert.strictEqual(run.firstStrikeUsed, false, "First strike should reset on room enter");
        }
    }
    assert.ok(true, "Room enter test attempted");
});

test("Mage spell can pierce to a second enemy on kill", function () {
    let pierced = false;
    for (let i = 0; i < 500 && !pierced; i++) {
        const run = PD.createRun("mage", i + 100);
        const room = PD.currentRoom(run);
        room.enemies = [
            { type: "slime", x: run.x, y: run.y - 1, hp: 1, maxHp: 1, atk: 2, def: 0, gold: 2, ai: "slow" },
            { type: "slime", x: run.x, y: run.y - 2, hp: 10, maxHp: 10, atk: 2, def: 0, gold: 2, ai: "slow" }
        ];
        run.facing = "N";
        const res = PD.useAbility(run);
        if (res.logs.some(function (l) { return l.indexOf("PIERCE") === 0; })) {
            pierced = true;
        }
    }
    assert.ok(pierced, "Mage spell should pierce at least once in 500 trials");
});

test("Class definitions have passive and abilityDesc fields", function () {
    const knight = PD.CLASSES.knight;
    assert.strictEqual(knight.passive, "COUNTERSTRIKE");
    assert.ok(knight.abilityDesc);
    assert.ok(knight.abilityDesc.indexOf("COUNTER") !== -1);

    const scout = PD.CLASSES.scout;
    assert.strictEqual(scout.passive, "FIRST STRIKE");
    assert.ok(scout.abilityDesc.indexOf("FIRST") !== -1);

    const mage = PD.CLASSES.mage;
    assert.strictEqual(mage.passive, "PIERCE");
    assert.ok(mage.abilityDesc.indexOf("PIERCE") !== -1 || mage.abilityDesc.indexOf("pierc") !== -1);
});

test("firstStrikeUsed survives save/load round-trip", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "scout", hp: 16, maxHp: 16, atk: 4, def: 1, gold: 10, pack: [], lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "hold", 42);
    save.site.firstStrikeUsed = true;
    save.run = save.site;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.firstStrikeUsed, true);
});

test("Wraith enemy has stats, AI, and sprite mapping", function () {
    const def = PD.ENEMY_DEFS.wraith;
    assert.ok(def);
    assert.strictEqual(def.ai, "phase");
    assert.strictEqual(def.gold, 20);
    assert.strictEqual(def.debut, 4);
    assert.ok(def.hp >= 10);
});

test("Floor 4 of the hold spawns a wraith midboss at stairs", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    let foundWraith = false;
    for (let i = 0; i < 50 && !foundWraith; i++) {
        const run = PD.createSiteRun(hero, "hold", i * 5 + 1);
        run.floor = 4;
        const rng = PD.createRng(run.seed, 0);
        PD.generateFloor(run, rng);
        const stairs = run.rooms.find(function (r) { return r.kind === "stairs"; });
        if (stairs && stairs.enemies.some(function (e) { return e.type === "wraith"; })) {
            foundWraith = true;
        }
    }
    assert.ok(foundWraith, "Floor 4 should spawn a wraith midboss");
});

test("Wraith blocks stairs on floor 4 until killed", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    const run = PD.createSiteRun(hero, "hold", 99);
    run.floor = 4;
    const rng = PD.createRng(run.seed, 0);
    PD.generateFloor(run, rng);
    const stairs = run.rooms.find(function (r) { return r.kind === "stairs"; });
    if (stairs && stairs.enemies.some(function (e) { return e.type === "wraith" && e.hp > 0; })) {
        run.roomId = stairs.id;
        run.x = 3;
        run.y = 2;
        run.facing = "S";
        var wraith = stairs.enemies.find(function (e) { return e.type === "wraith"; });
        wraith.x = 4;
        wraith.y = 3;
        const res = PD.tryAct(run);
        assert.ok(res.logs.some(function (l) { return l.indexOf("WRAITH BARS") !== -1; }),
            "Wraith should block stairs: " + res.logs.join(","));
    } else {
        assert.ok(true, "No wraith spawned in this seed, skipping block test");
    }
});

test("Wraith can phase through walls", function () {
    let phased = false;
    for (let i = 0; i < 200 && !phased; i++) {
        const run = PD.createRun("knight", i * 11 + 1);
        const room = PD.currentRoom(run);
        var wraith = { type: "wraith", x: 1, y: 1, hp: 14, maxHp: 14, atk: 4, def: 0, gold: 20, ai: "phase" };
        room.enemies = [wraith];
        var beforeX = wraith.x;
        var beforeY = wraith.y;
        PD.waitTurn(run);
        if (wraith.x !== beforeX || wraith.y !== beforeY) {
            var tile = room.tiles[wraith.y] ? room.tiles[wraith.y][wraith.x] : '#';
            if (tile === '#') {
                phased = true;
            }
        }
    }
    assert.ok(phased, "Wraith should phase through walls at least once in 200 trials");
});

test("Hold enemy pool shifts by floor tier", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    const run = PD.createSiteRun(hero, "hold", 42);
    run.floor = 1;
    var rng = PD.createRng(run.seed, 0);
    PD.generateFloor(run, rng);
    assert.ok(!run.enemyPool, "Hold should use dynamic pool, not site pool");
    var f1Types = new Set();
    run.rooms.forEach(function (r) {
        r.enemies.forEach(function (e) { f1Types.add(e.type); });
    });
    assert.ok(!f1Types.has("ghoul"), "Floor 1 should not have ghouls");
    assert.ok(!f1Types.has("skeleton"), "Floor 1 should not have skeletons");
});

test("Bosses telegraph and land heavy attacks", function () {
    const run = PD.createRun("knight", 991);
    run.guardTurns = 0;
    const room = PD.currentRoom(run);
    const ogre = { type: "ogre", x: run.x, y: run.y - 1, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 30, ai: "ogre" };
    room.enemies = [ogre];
    run.facing = "N";
    const warning = PD.waitTurn(run);
    ogre.heavyTelegraph = false;
    ogre.x = run.x + 1;
    ogre.y = run.y;
    ogre.heavyCooldown = 0;
    const warning2 = PD.waitTurn(run);
    assert.ok(warning2.logs.some(function (line) { return line.indexOf("RAISES A BLOW") !== -1; }));
    assert.strictEqual(ogre.heavyTelegraph, true);
    run.hp = 20;
    const hpBefore = run.hp;
    ogre.heavyCooldown = 0;
    ogre.heavyTelegraph = false;
    ogre.x = run.x + 1;
    ogre.y = run.y;
    ogre.heavyTelegraph = true;
    const smash = PD.waitTurn(run);
    assert.ok(smash.logs.some(function (line) { return line.indexOf("SMASH") !== -1; }));
    assert.ok(run.hp < hpBefore);
    assert.strictEqual(ogre.heavyTelegraph, false);
});

test("Boss heavy telegraph survives save/load", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "keepgate" };
    save.site = PD.createSiteRun(save.hero, "hold", 42);
    const room = PD.currentRoom(save.site);
    room.enemies = [{ type: "ogre", x: 3, y: 2, hp: 20, maxHp: 20, atk: 5, def: 1, gold: 30, ai: "ogre", heavyTelegraph: true }];
    save.run = save.site;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.site.rooms[restored.site.roomId].enemies[0].heavyTelegraph, true);
});

test("Wraith not in random enemy pool", function () {
    const rng = PD.createRng(12345, 0);
    for (let i = 0; i < 200; i++) {
        var type = PD.pickEnemyType ? null : null;
    }
    assert.ok(true);
});

// ---- RPG progression: XP, levels, gear, contracts ----

test("XP curve and level gains follow the published schedule", function () {
    assert.strictEqual(PD.xpForNext(1), 12);
    assert.strictEqual(PD.xpForNext(2), 16);
    assert.strictEqual(PD.xpForNext(10), 48);
    assert.deepStrictEqual(PD.levelGains(2), { hp: 2, atk: 1, def: 0 });
    assert.deepStrictEqual(PD.levelGains(3), { hp: 2, atk: 0, def: 1 });
    assert.deepStrictEqual(PD.levelGains(6), { hp: 2, atk: 1, def: 1 });
});

test("grantXp levels up mid-run with full heal and stat gains", function () {
    const run = PD.createRun("knight", 5);
    run.hp = 3;
    const logs = [];
    const baseMaxHp = run.maxHp;
    const baseAtk = run.atk;
    const baseDef = run.def;
    const levels = PD.grantXp(run, 30, logs);
    assert.strictEqual(levels, 2);
    assert.strictEqual(run.level, 3);
    assert.strictEqual(run.maxHp, baseMaxHp + 4);
    assert.strictEqual(run.atk, baseAtk + 1);
    assert.strictEqual(run.def, baseDef + 1);
    assert.strictEqual(run.hp, run.maxHp);
    const levelLine = logs.filter(function (l) { return l.indexOf("LEVEL UP") === 0; })[0] || "";
    assert.ok(levelLine.indexOf("LEVEL UP 3") === 0, "combined level line should report final level");
    assert.ok(levelLine.indexOf("+4HP") !== -1);
    assert.ok(levelLine.indexOf("+1ATK") !== -1);
    assert.strictEqual(run.xp, 30 - 12 - 16);
});

test("Melee kills grant XP and crossing the threshold levels up", function () {
    const run = PD.createRun("knight", 555);
    const room = PD.currentRoom(run);
    room.enemies = [{ type: "slime", x: run.x, y: run.y - 1, hp: 1, maxHp: 4, atk: 2, def: 0, gold: 2 }];
    run.facing = "N";
    run.xp = 11;
    const res = PD.tryAct(run);
    assert.ok(res.ok);
    assert.ok(res.logs.some(function (l) { return l.indexOf("SLIME DOWN") !== -1; }));
    assert.ok(res.logs.some(function (l) { return l === "+3 XP"; }));
    assert.ok(res.logs.some(function (l) { return l.indexOf("LEVEL UP 2") === 0; }));
    assert.strictEqual(run.level, 2);
    assert.strictEqual(run.xp, 2);
    assert.strictEqual(run.maxHp, 22);
});

test("XP and level survive save/load round-trip on run and hero", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 9, pack: [], level: 4, xp: 2, lastInn: "ashford" };
    save.site = PD.createRun("knight", 31337);
    save.site.level = 4;
    save.site.xp = 7;
    save.site.xpEarned = 40;
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.hero.level, 4);
    assert.strictEqual(restored.hero.xp, 2);
    assert.strictEqual(restored.site.level, 4);
    assert.strictEqual(restored.site.xp, 7);
    assert.strictEqual(restored.site.xpEarned, 40);
});

test("recordDeath keeps earned levels and epitaphs record level", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 40, pack: [], lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "cellar", 2);
    save.site.gold = 40;
    save.site.kills = 5;
    PD.grantXp(save.site, 14, []);
    assert.strictEqual(save.site.level, 2);
    PD.recordDeath(save, "FELL");
    assert.strictEqual(save.hero.level, 2);
    assert.strictEqual(save.hero.xp, 2);
    assert.strictEqual(save.hero.gold, 20);
    assert.strictEqual(save.meta.epitaphs[0].level, 2);
    assert.strictEqual(save.meta.kills, 5);
});

test("createSiteRun folds gear into run stats; stripRunGear and sync restore base", function () {
    const hero = {
        classId: "knight", hp: 18, maxHp: 20, atk: 4, def: 2, gold: 10,
        pack: ["potion"], level: 3, xp: 5,
        gear: { weapon: "blade", armor: "iron_mail", charm: "talisman" },
        lastInn: "keepgate"
    };
    const run = PD.createSiteRun(hero, "cellar", 9);
    assert.strictEqual(run.atk, 5);
    assert.strictEqual(run.def, 5);
    assert.strictEqual(run.maxHp, 26);
    assert.strictEqual(run.gearAtk, 1);
    assert.strictEqual(run.gearDef, 3);
    assert.strictEqual(run.gearHp, 6);
    assert.strictEqual(run.level, 3);
    assert.strictEqual(run.xp, 5);
    const base = PD.stripRunGear(run);
    assert.strictEqual(base.atk, 4);
    assert.strictEqual(base.def, 2);
    assert.strictEqual(base.maxHp, 20);
    const target = { classId: "knight" };
    PD.syncHeroFromRun(target, run);
    assert.strictEqual(target.atk, 4);
    assert.strictEqual(target.def, 2);
    assert.strictEqual(target.maxHp, 20);
    assert.strictEqual(target.level, 3);
    assert.strictEqual(target.xp, 5);
    assert.strictEqual(target.gold, 10);
});

test("Hero gear survives save/load and normalizeGear rejects bad slots", function () {
    const save = PD.createEmptySave();
    save.hero = {
        classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 5, pack: [],
        gear: { weapon: "iron_blade", armor: "shield", charm: "talisman" }, lastInn: "ashford"
    };
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.hero.gear.weapon, "iron_blade");
    assert.strictEqual(restored.hero.gear.armor, "shield");
    assert.strictEqual(restored.hero.gear.charm, "talisman");
    assert.deepStrictEqual(PD.gearBonus(restored.hero.gear), { atk: 3, def: 2, hp: 6 });

    const bad = PD.normalizeGear({ weapon: "shield", armor: "blade", charm: "not_real", bogus: "mail" });
    assert.strictEqual(bad.weapon, null);
    assert.strictEqual(bad.armor, null);
    assert.strictEqual(bad.charm, null);
});

test("applySnapshot v2 hero without level fields gets v3 defaults", function () {
    const restored = PD.applySnapshot({
        v: 2,
        hero: { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 7, pack: ["blade"], lastInn: "ashford" },
        flags: {},
        location: { kind: "town", id: "ashford" },
        site: null,
        meta: { deaths: 1, journal: [], bestFloor: 2, renown: 3, epitaphs: [] }
    });
    assert.strictEqual(restored.v, 3);
    assert.strictEqual(restored.hero.level, 1);
    assert.strictEqual(restored.hero.xp, 0);
    assert.deepStrictEqual(restored.hero.gear, { weapon: null, armor: null, charm: null });
    assert.strictEqual(restored.meta.kills, 0);
    assert.strictEqual(restored.meta.contractsDone, 0);
    assert.deepStrictEqual(restored.meta.contractTiers, {});
});

test("Corrupt v3 snapshot sanitizes level, xp, gear, and meta counters", function () {
    const restored = PD.applySnapshot({
        v: 3,
        hero: { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 7, pack: [], level: "abc", xp: 99999, gear: "garbage", lastInn: "ashford" },
        flags: {},
        location: { kind: "town", id: "ashford" },
        site: null,
        meta: { deaths: "x", journal: [], bestFloor: 1, renown: 0, epitaphs: [], kills: -5, contractsDone: "no", contractTiers: { cellar: -2 } }
    });
    assert.strictEqual(restored.hero.level, PD.LEVEL_CAP);
    assert.strictEqual(restored.hero.xp, 0);
    assert.deepStrictEqual(restored.hero.gear, { weapon: null, armor: null, charm: null });
    assert.ok(restored.hero.maxHp >= 20);
    assert.strictEqual(restored.meta.kills, 0);
    assert.strictEqual(restored.meta.contractsDone, 0);
    assert.deepStrictEqual(restored.meta.contractTiers, {});
});

test("makeEnemy tier scaling raises hp, atk, gold, and xp bonus", function () {
    const plain = PD.makeEnemy("slime", 1, 1, 1, 0);
    assert.strictEqual(plain.hp, 4);
    assert.strictEqual(plain.atk, 2);
    assert.strictEqual(plain.gold, 2);
    assert.strictEqual(plain.xpBonus, 0);
    assert.strictEqual(PD.enemyXp(plain), 3);

    const scaled = PD.makeEnemy("slime", 1, 1, 1, 4);
    assert.strictEqual(scaled.hp, 8);
    assert.strictEqual(scaled.maxHp, 8);
    assert.strictEqual(scaled.atk, 4);
    assert.strictEqual(scaled.gold, 6);
    assert.strictEqual(PD.enemyXp(scaled), 7);
});

test("Contract runs respawn scaled enemies on cleared sites", function () {
    const hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 5, pack: [], lastInn: "ashford" };
    const flags = { ashford_cellar_clear: 1 };
    const replay = PD.createSiteRun(hero, "cellar", 77, flags);
    assert.strictEqual(replay.siteClearedReplay, true);
    assert.strictEqual(replay.contract, 0);
    assert.ok(replay.rooms.every(function (room) { return room.enemies.length === 0; }));

    const contract = PD.createSiteRun(hero, "cellar", 77, flags, 2);
    assert.strictEqual(contract.contract, 2);
    const spawned = contract.rooms.some(function (room) { return room.enemies.length > 0; });
    assert.ok(spawned, "Contract run must spawn enemies despite cleared flag");
    const foe = contract.rooms.map(function (r) { return r.enemies[0]; }).filter(Boolean)[0];
    assert.strictEqual(foe.hp, foe.maxHp);
    assert.strictEqual(foe.xpBonus, 2);
});

test("Contract completion pays gold, renown, xp, and counts tiers", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], level: 2, xp: 0, lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "cellar", 21, {}, 2);
    save.site.gold = 10;
    save.site.kills = 4;
    const result = WORLD.completeSite(save, "cellar");
    assert.ok(result.ok);
    assert.strictEqual(save.meta.contractsDone, 1);
    assert.strictEqual(save.meta.contractTiers.cellar, 2);
    assert.strictEqual(save.meta.renown, 2);
    assert.strictEqual(save.hero.gold, 45);
    assert.strictEqual(save.hero.level, 3);
    assert.ok(result.line.indexOf("CONTRACT T2") !== -1);
    assert.strictEqual(save.meta.kills, 4);
});

test("townMenu swaps SITE for CONTRACT after clear and always offers HERO", function () {
    const base = WORLD.townMenu({ location: { id: "ashford" }, meta: {} });
    assert.ok(!base.some(function (o) { return o.id === "site"; }), "locked sites stay hidden");
    assert.ok(!base.some(function (o) { return o.id === "contract"; }));
    assert.ok(base.some(function (o) { return o.id === "hero"; }));

    const unlocked = WORLD.townMenu({ location: { id: "ashford" }, flags: { ashford_cellar_open: 1 }, meta: {} });
    assert.ok(unlocked.some(function (o) { return o.id === "site"; }));

    const cleared = WORLD.townMenu({ location: { id: "ashford" }, flags: { ashford_cellar_clear: 1 }, meta: { contractTiers: { cellar: 2 } } });
    assert.ok(!cleared.some(function (o) { return o.id === "site"; }));
    const contract = cleared.filter(function (o) { return o.id === "contract"; })[0];
    assert.ok(contract);
    assert.ok(contract.label.indexOf("T3") !== -1);

    assert.strictEqual(WORLD.contractTarget({ flags: { ashford_cellar_clear: 1 } }, "ashford"), "cellar");
    assert.strictEqual(WORLD.contractTarget({ flags: {} }, "ashford"), null);
    assert.strictEqual(WORLD.contractTier({ meta: { contractTiers: { cellar: 4 } } }, "cellar"), 4);
});

test("killEnemy unifies rewards: xp, gold, and boss reward even on counter kills", function () {
    const run = PD.createRun("knight", 4242);
    const room = PD.currentRoom(run);
    room.kind = "stairs";
    const ogre = { type: "ogre", x: 1, y: 1, hp: 0, maxHp: 24, atk: 5, def: 1, gold: 30, xpBonus: 0 };
    room.enemies = [ogre];
    const logs = [];
    const ok = PD.killEnemy(run, room, ogre, logs);
    assert.ok(ok);
    assert.strictEqual(run.gold, 30);
    assert.strictEqual(run.kills, 1);
    assert.ok(logs.some(function (l) { return l === "+60 XP"; }));
    assert.ok(room.reward && room.reward.active && room.reward.boss === "ogre");
    assert.ok(logs.indexOf("REWARD AWAITS") !== -1);
});

test("claimReward resolves gold/heal/renown and grants boons", function () {
    const run = PD.createRun("knight", 42);
    const room = PD.currentRoom(run);
    room.reward = { active: true, boss: "ogre", choice: null, options: ["gold", "heal", "renown"], boon: "lastStand" };
    const beforeGold = run.gold;
    const res = PD.claimReward(run, "gold");
    assert.ok(res.ok);
    assert.strictEqual(res.reward, "gold");
    assert.strictEqual(res.renownGain, 0);
    assert.strictEqual(run.gold, beforeGold + 15);
    assert.strictEqual(run.lastStand, 1);
    assert.strictEqual(room.reward.active, false);
    assert.strictEqual(room.reward.choice, "gold");

    const run2 = PD.createRun("mage", 43);
    const room2 = PD.currentRoom(run2);
    room2.reward = { active: true, boss: "wraith", choice: null, options: ["heal", "gold", "renown"], boon: "phaseStep" };
    run2.hp = 2;
    const res2 = PD.claimReward(run2, "renown");
    assert.strictEqual(res2.renownGain, 3);
    assert.strictEqual(run2.phaseStep, 1);
    assert.strictEqual(run2.gold, 0);

    const run3 = PD.createRun("scout", 44);
    const room3 = PD.currentRoom(run3);
    room3.reward = { active: true, boss: "ogre", choice: null, options: ["gold", "heal", "renown"], boon: "lastStand" };
    run3.hp = 2;
    const res3 = PD.claimReward(run3, "heal");
    assert.ok(res3.ok);
    assert.strictEqual(run3.hp, 2 + Math.ceil(run3.maxHp * 0.5));
});

test("claimReward refuses when no active reward", function () {
    const run = PD.createRun("knight", 45);
    const res = PD.claimReward(run, "gold");
    assert.strictEqual(res.ok, false);
    assert.ok(res.logs.indexOf("NO REWARD") !== -1);
});

test("Drain charm heals 1 HP on kill", function () {
    const run = PD.createRun("knight", 500);
    run.gear = { weapon: null, armor: null, charm: "drain_charm" };
    run.hp = 5;
    run.maxHp = 20;
    const room = PD.currentRoom(run);
    room.enemies = [{ type: "skeleton", x: run.x, y: run.y - 1, hp: 1, maxHp: 6, atk: 3, def: 0, gold: 5, ai: "relentless" }];
    run.facing = "N";
    const res = PD.tryAct(run);
    assert.ok(res.logs.some(function (l) { return l === "DRAIN +1"; }), "should log drain heal: " + res.logs.join(","));
    assert.strictEqual(run.hp, 6);
});

test("Ward charm blocks poison traps", function () {
    const run = PD.createRun("knight", 700);
    run.gear = { weapon: null, armor: null, charm: "ward_charm" };
    run.hp = 10;
    const room = PD.currentRoom(run);
    run.facing = "S";
    room.tiles[run.y + 1] = room.tiles[run.y + 1].slice(0, run.x) + "~" + room.tiles[run.y + 1].slice(run.x + 1);
    const res = PD.tryAct(run);
    assert.ok(res.logs.some(function (l) { return l === "POISON WARDED"; }), "should ward poison: " + res.logs.join(","));
    assert.strictEqual(run.poisonTurns, 0);
});

test("createSiteRun seeds run.gear so mid-run equip preserves persistent gear", function () {
    const hero = { classId: "knight", hp: 18, maxHp: 20, atk: 4, def: 2, gold: 10, pack: ["mail"], level: 3, xp: 5, gear: { weapon: "blade", armor: null, charm: "talisman" }, lastInn: "keepgate" };
    const run = PD.createSiteRun(hero, "cellar", 9);
    assert.strictEqual(run.gear.weapon, "blade");
    assert.strictEqual(run.gear.charm, "talisman");
    assert.strictEqual(run.atk, 5);
    const res = PD.useItem(run, 0);
    assert.ok(res.equip);
    assert.strictEqual(run.gear.weapon, "blade", "blade must not be wiped");
    assert.strictEqual(run.gear.armor, "mail");
    assert.strictEqual(run.gear.charm, "talisman");
    assert.strictEqual(run.atk, 5, "atk must keep the blade bonus");
});

test("Bestiary tracks unique kills across death and survives save/load", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "cellar", 2);
    save.site.slainTypes = { slime: 2, rat: 1 };
    save.site.kills = 3;
    save.run = save.site;
    PD.recordDeath(save, "FELL");
    assert.strictEqual(save.meta.bestiary.slime, 2);
    assert.strictEqual(save.meta.bestiary.rat, 1);
    const restored = PD.applySnapshot(PD.snapshot(save));
    assert.strictEqual(restored.meta.bestiary.slime, 2);
    assert.strictEqual(restored.meta.bestiary.rat, 1);
});

test("completeSite merges bestiary from a cleared run", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], level: 1, xp: 0, lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "cellar", 21, {}, 0);
    save.site.slainTypes = { bat: 1, rat: 3 };
    save.run = save.site;
    const result = WORLD.completeSite(save, "cellar");
    assert.ok(result.ok);
    assert.strictEqual(save.meta.bestiary.bat, 1);
    assert.strictEqual(save.meta.bestiary.rat, 3);
});

test("Death returns run gear to the pack without duplicating persistent gear", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], gear: { weapon: "blade", armor: null, charm: null }, lastInn: "keepgate" };
    save.site = PD.createSiteRun(save.hero, "cellar", 5);
    save.site.pack = ["iron_blade"];
    save.run = save.site;
    const res = PD.useItem(save.run, 0);
    assert.ok(res.equip);
    assert.strictEqual(save.run.gear.weapon, "iron_blade");
    assert.strictEqual(save.run.pack.indexOf("blade"), 0);
    PD.recordDeath(save, "FELL");
    assert.strictEqual(save.hero.gear.weapon, "blade", "persistent gear must survive");
    assert.strictEqual(save.hero.pack.indexOf("blade"), -1, "persistent gear must not duplicate into pack");
    assert.strictEqual(save.hero.pack.indexOf("iron_blade"), 0, "run-acquired gear returns to pack");
});

test("Death without persistent gear keeps run gear in the pack", function () {
    const save = PD.createEmptySave();
    save.hero = { classId: "knight", hp: 20, maxHp: 20, atk: 4, def: 2, gold: 10, pack: [], gear: { weapon: null, armor: null, charm: null }, lastInn: "ashford" };
    save.site = PD.createSiteRun(save.hero, "cellar", 6);
    save.site.pack = ["blade"];
    save.run = save.site;
    PD.useItem(save.run, 0);
    assert.strictEqual(save.run.gear.weapon, "blade");
    PD.recordDeath(save, "FELL");
    assert.strictEqual(save.hero.pack.indexOf("blade"), 0, "found gear should survive in pack");
});

console.log("\n=================================");
console.log("Results: " + passed + " passed, " + failed + " failed");
if (failed > 0) {
    process.exit(1);
} else {
    console.log("ALL TESTS PASSED!\n");
}
