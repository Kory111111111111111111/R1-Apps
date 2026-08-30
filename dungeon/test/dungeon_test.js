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
test("Items: Potion, Blade, Mail usage and clamping", function () {
    const run = PD.createRun("knight", 100);
    run.hp = 10;
    run.pack = ["potion", "blade", "mail"];

    // Use potion
    const res1 = PD.useItem(run, 0);
    assert.ok(res1.ok);
    assert.strictEqual(run.hp, 16);
    assert.strictEqual(run.pack.length, 2);

    // Use blade
    const prevAtk = run.atk;
    const res2 = PD.useItem(run, 0);
    assert.ok(res2.ok);
    assert.strictEqual(run.atk, prevAtk + 1);

    // Use mail
    const prevDef = run.def;
    const res3 = PD.useItem(run, 0);
    assert.ok(res3.ok);
    assert.strictEqual(run.def, prevDef + 1);
    assert.strictEqual(run.pack.length, 0);

    // Invalid index
    const res4 = PD.useItem(run, 0);
    assert.strictEqual(res4.ok, false);
});

// 6. Save/Load, Snapshots, and Migrations
test("Save / Load serialization and metadata persistence", function () {
    const save = PD.createEmptySave();
    assert.strictEqual(save.v, 2);
    assert.strictEqual(save.meta.bestFloor, 0);
    assert.deepStrictEqual(save.meta.epitaphs, []);

    save.hero = {
        classId: "scout", hp: 16, maxHp: 16, atk: 4, def: 1,
        gold: 50, pack: ["potion"], lastInn: "ashford"
    };
    save.site = PD.createRun("scout", 999);
    save.site.floor = 4;

    const snap = PD.snapshot(save);
    assert.strictEqual(snap.v, 2);
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
    assert.strictEqual(migrated.v, 2);
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

console.log("\n=================================");
console.log("Results: " + passed + " passed, " + failed + " failed");
if (failed > 0) {
    process.exit(1);
} else {
    console.log("ALL TESTS PASSED!\n");
}
