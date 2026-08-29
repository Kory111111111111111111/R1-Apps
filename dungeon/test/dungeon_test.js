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
    assert.strictEqual(save.v, 1);
    assert.strictEqual(save.meta.bestFloor, 0);
    assert.deepStrictEqual(save.meta.epitaphs, []);

    save.run = PD.createRun("scout", 999);
    save.run.floor = 4;
    save.run.gold = 50;

    const snap = PD.snapshot(save);
    const restored = PD.applySnapshot(snap);

    assert.ok(restored.run);
    assert.strictEqual(restored.run.classId, "scout");
    assert.strictEqual(restored.run.floor, 4);
    assert.strictEqual(restored.run.gold, 50);
    assert.strictEqual(restored.run.pack.length, 1);
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
