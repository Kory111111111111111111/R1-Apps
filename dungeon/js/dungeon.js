(function (global) {
    const MAP_SIZE = 7;
    const MAX_FLOOR = 8;
    const PACK_MAX = 5;
    const SNAPSHOT_VERSION = 1;
    const FACINGS = ["N", "E", "S", "W"];
    const OPP = { N: "S", E: "W", S: "N", W: "E" };
    const DIR = {
        N: { x: 0, y: -1 },
        E: { x: 1, y: 0 },
        S: { x: 0, y: 1 },
        W: { x: -1, y: 0 }
    };
    const DOOR_CELL = {
        N: { x: 3, y: 0 },
        E: { x: 6, y: 3 },
        S: { x: 3, y: 6 },
        W: { x: 0, y: 3 }
    };
    const DOOR_INNER = {
        N: { x: 3, y: 1 },
        E: { x: 5, y: 3 },
        S: { x: 3, y: 5 },
        W: { x: 1, y: 3 }
    };

    const CLASSES = {
        knight: { id: "knight", name: "KNIGHT", hp: 20, atk: 4, def: 2 },
        scout: { id: "scout", name: "SCOUT", hp: 16, atk: 3, def: 1 },
        mage: { id: "mage", name: "MAGE", hp: 14, atk: 5, def: 0 }
    };
    const CLASS_ORDER = ["knight", "scout", "mage"];

    const ENEMY_DEFS = {
        slime: { hp: 4, atk: 2, def: 0, debut: 1 },
        bat: { hp: 3, atk: 3, def: 0, debut: 2 },
        skeleton: { hp: 6, atk: 3, def: 0, debut: 4 },
        ogre: { hp: 20, atk: 5, def: 1, debut: 8 }
    };

    const ITEM_IDS = ["potion", "blade", "mail"];

    let lastCryptoValue = -1;
    let cryptoRepeatStreak = 0;

    function cryptoUint32() {
        const buf = new Uint32Array(1);
        try {
            window.crypto.getRandomValues(buf);
        } catch (error) {
            console.warn("crypto.getRandomValues failed", error);
            return null;
        }
        const value = buf[0];
        if (value === lastCryptoValue) {
            cryptoRepeatStreak += 1;
        } else {
            cryptoRepeatStreak = 0;
        }
        lastCryptoValue = value;
        if (cryptoRepeatStreak >= 3) {
            console.warn("crypto.getRandomValues looks stubbed; falling back");
            return null;
        }
        return value;
    }

    function newSeed() {
        const canCrypto = window.crypto && typeof window.crypto.getRandomValues === "function";
        if (canCrypto) {
            const value = cryptoUint32();
            if (value !== null) {
                return value >>> 0;
            }
        }
        return (Math.floor(Math.random() * 0x100000000) ^ Date.now()) >>> 0;
    }

    function createRng(seed, state) {
        let a = (state == null ? seed : state) | 0;
        function nextU32() {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return (t ^ t >>> 14) >>> 0;
        }
        return {
            getState: function () {
                return a >>> 0;
            },
            random: function () {
                return nextU32() / 4294967296;
            },
            int: function (min, maxInclusive) {
                const range = maxInclusive - min + 1;
                if (range <= 0) {
                    return min;
                }
                return min + (nextU32() % range);
            },
            pick: function (arr) {
                if (!arr.length) {
                    return undefined;
                }
                return arr[this.int(0, arr.length - 1)];
            }
        };
    }

    function rngFromRun(run) {
        return createRng(run.seed, run.rngState);
    }

    function commitRng(run, rng) {
        run.rngState = rng.getState();
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getTile(room, x, y) {
        if (y < 0 || y >= MAP_SIZE || x < 0 || x >= MAP_SIZE) {
            return "#";
        }
        const row = room.tiles[y] || "";
        return row[x] || "#";
    }

    function setTile(room, x, y, ch) {
        const row = room.tiles[y];
        if (typeof row !== "string" || x < 0 || x >= row.length) {
            return;
        }
        room.tiles[y] = row.slice(0, x) + ch + row.slice(x + 1);
    }

    function currentRoom(run) {
        return run.rooms[run.roomId];
    }

    function enemyAt(room, x, y) {
        if (!room || !room.enemies) {
            return null;
        }
        for (let i = 0; i < room.enemies.length; i += 1) {
            const enemy = room.enemies[i];
            if (enemy.hp > 0 && enemy.x === x && enemy.y === y) {
                return enemy;
            }
        }
        return null;
    }

    function hitDamage(atk, def, rng) {
        return Math.max(1, atk - def) + rng.int(0, 1);
    }

    function blankTiles() {
        const tiles = [];
        for (let y = 0; y < MAP_SIZE; y += 1) {
            let row = "";
            for (let x = 0; x < MAP_SIZE; x += 1) {
                const wall = x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1;
                row += wall ? "#" : ".";
            }
            tiles.push(row);
        }
        return tiles;
    }

    function punchDoors(tiles, doors) {
        FACINGS.forEach(function (dir) {
            if (doors[dir] == null) {
                return;
            }
            const cell = DOOR_CELL[dir];
            const row = tiles[cell.y];
            tiles[cell.y] = row.slice(0, cell.x) + "+" + row.slice(cell.x + 1);
        });
    }

    function interiorSpots(room) {
        const spots = [];
        for (let y = 1; y < MAP_SIZE - 1; y += 1) {
            for (let x = 1; x < MAP_SIZE - 1; x += 1) {
                spots.push({ x: x, y: y });
            }
        }
        return spots;
    }

    function isReserved(x, y, doors, extra) {
        if (x === 3 && y === 3) {
            return true;
        }
        for (let i = 0; i < FACINGS.length; i += 1) {
            const dir = FACINGS[i];
            if (doors[dir] == null) {
                continue;
            }
            const inner = DOOR_INNER[dir];
            if (inner.x === x && inner.y === y) {
                return true;
            }
        }
        if (extra) {
            for (let j = 0; j < extra.length; j += 1) {
                if (extra[j].x === x && extra[j].y === y) {
                    return true;
                }
            }
        }
        return false;
    }

    function connectRooms(rooms, a, b, rng) {
        const freeA = FACINGS.filter(function (d) {
            return rooms[a].doors[d] == null;
        });
        const options = freeA.filter(function (d) {
            return rooms[b].doors[OPP[d]] == null;
        });
        if (!options.length) {
            return false;
        }
        const dir = rng.pick(options);
        rooms[a].doors[dir] = b;
        rooms[b].doors[OPP[dir]] = a;
        return true;
    }

    function makeEnemy(type, x, y, floor) {
        const def = ENEMY_DEFS[type];
        const bonus = Math.max(0, floor - def.debut);
        const hp = def.hp + bonus;
        return {
            type: type,
            x: x,
            y: y,
            hp: hp,
            maxHp: hp,
            atk: def.atk,
            def: def.def
        };
    }

    function pickLoot(rng) {
        const roll = rng.int(1, 100);
        if (roll <= 50) {
            return "potion";
        }
        if (roll <= 75) {
            return "coin";
        }
        if (roll <= 90) {
            return "blade";
        }
        return "mail";
    }

    function pickEnemyType(floor, rng) {
        const pool = ["slime", "bat", "skeleton"].filter(function (id) {
            return ENEMY_DEFS[id].debut <= floor;
        });
        return rng.pick(pool);
    }

    function populateRoom(room, floor, rng, opts) {
        const reserved = [];
        punchDoors(room.tiles, room.doors);

        if (opts.stairs) {
            setTile(room, 3, 3, ">");
            reserved.push({ x: 3, y: 3 });
        }

        if (opts.boss) {
            const ogrePos = { x: 3, y: 2 };
            if (getTile(room, ogrePos.x, ogrePos.y) !== ".") {
                ogrePos.y = 4;
            }
            room.enemies.push(makeEnemy("ogre", ogrePos.x, ogrePos.y, floor));
            reserved.push(ogrePos);
            return;
        }

        if (opts.start) {
            return;
        }

        const spots = interiorSpots(room).filter(function (p) {
            return getTile(room, p.x, p.y) === "." && !isReserved(p.x, p.y, room.doors, reserved);
        });

        function takeSpot() {
            if (!spots.length) {
                return null;
            }
            const idx = rng.int(0, spots.length - 1);
            return spots.splice(idx, 1)[0];
        }

        const enemyCount = rng.int(0, 2);
        for (let i = 0; i < enemyCount; i += 1) {
            const spot = takeSpot();
            if (!spot) {
                break;
            }
            room.enemies.push(makeEnemy(pickEnemyType(floor, rng), spot.x, spot.y, floor));
            reserved.push(spot);
        }

        if (rng.int(1, 100) <= 35) {
            const spot = takeSpot();
            if (spot) {
                room.chest = { x: spot.x, y: spot.y, item: pickLoot(rng), open: false };
                setTile(room, spot.x, spot.y, "$");
                reserved.push(spot);
            }
        }

        if (rng.int(1, 100) <= 20) {
            const spot = takeSpot();
            if (spot) {
                setTile(room, spot.x, spot.y, "^");
            }
        }
    }

    function generateFloor(run, rng) {
        const extra = run.floor >= 7 ? 2 : 1;
        const roomCount = clamp(5 + rng.int(0, 3), 5, 8);
        const branchCount = Math.min(extra, roomCount - 2);
        const backbone = roomCount - branchCount;

        const rooms = [];
        for (let i = 0; i < roomCount; i += 1) {
            rooms.push({
                id: i,
                kind: "hall",
                tiles: blankTiles(),
                doors: {},
                enemies: [],
                chest: null
            });
        }

        for (let i = 0; i < backbone - 1; i += 1) {
            if (!connectRooms(rooms, i, i + 1, rng)) {
                console.warn("backbone connect failed", i, i + 1);
            }
        }

        let nextId = backbone;
        for (let b = 0; b < branchCount; b += 1) {
            const parent = rng.int(0, Math.max(0, backbone - 2));
            if (!connectRooms(rooms, parent, nextId, rng)) {
                connectRooms(rooms, 0, nextId, rng);
            }
            rooms[nextId].kind = "branch";
            nextId += 1;
        }

        rooms[0].kind = "start";
        rooms[backbone - 1].kind = "stairs";

        rooms.forEach(function (room) {
            populateRoom(room, run.floor, rng, {
                start: room.kind === "start",
                stairs: room.kind === "stairs",
                boss: room.kind === "stairs" && run.floor === MAX_FLOOR
            });
        });

        run.rooms = rooms;
        run.roomId = 0;
        run.x = 3;
        run.y = 3;
        run.facing = "S";
    }

    function createRun(classId, seed) {
        const cls = CLASSES[classId];
        if (!cls) {
            throw new Error("Unknown class: " + classId);
        }
        const useSeed = (seed == null ? newSeed() : seed) >>> 0;
        const rng = createRng(useSeed);
        const run = {
            seed: useSeed,
            classId: cls.id,
            floor: 1,
            gold: 0,
            hp: cls.hp,
            maxHp: cls.hp,
            atk: cls.atk,
            def: cls.def,
            pack: [],
            facing: "S",
            x: 3,
            y: 3,
            roomId: 0,
            rooms: [],
            rngState: 0
        };
        generateFloor(run, rng);
        commitRng(run, rng);
        return run;
    }

    function cycleFacing(run, delta) {
        const i = FACINGS.indexOf(run.facing);
        const idx = i < 0 ? 0 : i;
        run.facing = FACINGS[(idx + delta + FACINGS.length) % FACINGS.length];
        return run.facing;
    }

    function faceTile(run, tx, ty) {
        const dx = tx - run.x;
        const dy = ty - run.y;
        if (dx === 0 && dy === 0) {
            return run.facing;
        }
        if (Math.abs(dx) >= Math.abs(dy)) {
            run.facing = dx > 0 ? "E" : "W";
        } else {
            run.facing = dy > 0 ? "S" : "N";
        }
        return run.facing;
    }

    function canStepOnto(room, run, x, y, destX, destY) {
        const tile = getTile(room, x, y);
        if (tile === "#") {
            return false;
        }
        const isDest = x === destX && y === destY;
        if (enemyAt(room, x, y)) {
            return isDest;
        }
        if (tile === "$" || tile === "+" || tile === ">") {
            return isDest;
        }
        return tile === "." || tile === "^";
    }

    function pathTo(run, tx, ty) {
        const room = currentRoom(run);
        if (!room || !Number.isFinite(tx) || !Number.isFinite(ty)) {
            return [];
        }
        tx = Math.round(tx);
        ty = Math.round(ty);
        if (tx === run.x && ty === run.y) {
            return "wait";
        }
        if (!canStepOnto(room, run, tx, ty, tx, ty)) {
            return [];
        }
        const key = function (x, y) {
            return x + "," + y;
        };
        const startKey = key(run.x, run.y);
        const destKey = key(tx, ty);
        const prev = Object.create(null);
        prev[startKey] = null;
        const queue = [{ x: run.x, y: run.y }];
        let found = false;
        while (queue.length) {
            const cur = queue.shift();
            if (cur.x === tx && cur.y === ty) {
                found = true;
                break;
            }
            for (let i = 0; i < FACINGS.length; i += 1) {
                const vec = DIR[FACINGS[i]];
                const nx = cur.x + vec.x;
                const ny = cur.y + vec.y;
                const k = key(nx, ny);
                if (prev[k] !== undefined) {
                    continue;
                }
                if (!canStepOnto(room, run, nx, ny, tx, ty)) {
                    continue;
                }
                prev[k] = cur;
                queue.push({ x: nx, y: ny });
            }
        }
        if (!found || prev[destKey] === undefined) {
            return [];
        }
        const cells = [];
        let cursor = { x: tx, y: ty };
        while (cursor && key(cursor.x, cursor.y) !== startKey) {
            cells.push({ x: cursor.x, y: cursor.y });
            cursor = prev[key(cursor.x, cursor.y)];
        }
        cells.reverse();
        return cells;
    }

    function ogreAlive(room) {
        if (!room || !room.enemies) {
            return false;
        }
        return room.enemies.some(function (e) {
            return e.type === "ogre" && e.hp > 0;
        });
    }

    function canEnemyOccupy(run, room, x, y, self) {
        if (x < 1 || y < 1 || x > MAP_SIZE - 2 || y > MAP_SIZE - 2) {
            return false;
        }
        const tile = getTile(room, x, y);
        if (tile === "#" || tile === "+" || tile === "$") {
            return false;
        }
        if (run.x === x && run.y === y) {
            return false;
        }
        const other = enemyAt(room, x, y);
        if (other && other !== self) {
            return false;
        }
        return true;
    }

    function attackHero(run, enemy, rng, logs) {
        const dmg = hitDamage(enemy.atk, run.def, rng);
        run.hp = clamp(run.hp - dmg, 0, run.maxHp);
        logs.push(enemy.type.toUpperCase() + " HIT " + dmg);
    }

    function stepEnemy(run, room, enemy, rng, logs) {
        if (enemy.hp <= 0) {
            return;
        }
        const dist = Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y);
        if (dist === 1) {
            attackHero(run, enemy, rng, logs);
            return;
        }
        if (dist > 4) {
            return;
        }
        const dx = Math.sign(run.x - enemy.x);
        const dy = Math.sign(run.y - enemy.y);
        const tryXFirst = Math.abs(run.x - enemy.x) >= Math.abs(run.y - enemy.y);
        const attempts = tryXFirst
            ? [{ x: enemy.x + dx, y: enemy.y }, { x: enemy.x, y: enemy.y + dy }]
            : [{ x: enemy.x, y: enemy.y + dy }, { x: enemy.x + dx, y: enemy.y }];
        for (let i = 0; i < attempts.length; i += 1) {
            const n = attempts[i];
            if (n.x === enemy.x && n.y === enemy.y) {
                continue;
            }
            if (canEnemyOccupy(run, room, n.x, n.y, enemy)) {
                enemy.x = n.x;
                enemy.y = n.y;
                return;
            }
        }
    }

    function enemyTurn(run, rng, logs) {
        const room = currentRoom(run);
        if (!room) {
            return;
        }
        const foes = room.enemies.filter(function (e) {
            return e.hp > 0;
        });
        for (let i = 0; i < foes.length; i += 1) {
            if (run.hp <= 0) {
                return;
            }
            stepEnemy(run, room, foes[i], rng, logs);
        }
    }

    function finishTurn(run, rng, logs, extra) {
        const result = extra || {};
        if (run.hp > 0 && !result.skipEnemies) {
            enemyTurn(run, rng, logs);
        }
        if (run.hp <= 0) {
            run.hp = 0;
            logs.push("DEAD");
            result.died = true;
        }
        commitRng(run, rng);
        result.logs = logs;
        result.ok = true;
        return result;
    }

    function enterRoom(run, nextId, viaDir) {
        run.roomId = nextId;
        const inner = DOOR_INNER[viaDir];
        run.x = inner.x;
        run.y = inner.y;
        const occupant = enemyAt(currentRoom(run), run.x, run.y);
        if (occupant) {
            const fallback = interiorSpots(currentRoom(run)).find(function (p) {
                return getTile(currentRoom(run), p.x, p.y) === "." && !enemyAt(currentRoom(run), p.x, p.y) && !(p.x === run.x && p.y === run.y);
            });
            if (fallback) {
                occupant.x = fallback.x;
                occupant.y = fallback.y;
            }
        }
    }

    function openChest(run, room, rng, logs) {
        if (!room.chest || room.chest.open) {
            return { consumed: false };
        }
        const item = room.chest.item;
        if (item !== "coin" && run.pack.length >= PACK_MAX) {
            logs.push("PACK FULL");
            return { consumed: false };
        }
        room.chest.open = true;
        setTile(room, room.chest.x, room.chest.y, ".");
        if (item === "coin") {
            run.gold += 10;
            logs.push("OPEN COIN +10");
        } else {
            run.pack.push(item);
            logs.push("OPEN " + item.toUpperCase());
        }
        return { consumed: true };
    }

    function tryAct(run) {
        const logs = [];
        const rng = rngFromRun(run);
        const room = currentRoom(run);
        if (!room) {
            logs.push("NO ROOM");
            return { ok: false, logs: logs };
        }
        const vec = DIR[run.facing];
        const nx = run.x + vec.x;
        const ny = run.y + vec.y;
        const foe = enemyAt(room, nx, ny);
        if (foe) {
            const dmg = hitDamage(run.atk, foe.def, rng);
            foe.hp -= dmg;
            logs.push("HIT " + foe.type.toUpperCase() + " " + dmg);
            if (foe.hp <= 0) {
                foe.hp = 0;
                logs.push(foe.type.toUpperCase() + " DOWN");
                room.enemies = room.enemies.filter(function (e) {
                    return e.hp > 0;
                });
            }
            return finishTurn(run, rng, logs);
        }

        const tile = getTile(room, nx, ny);
        if (tile === "#") {
            logs.push("BLOCKED");
            commitRng(run, rng);
            return { ok: false, blocked: true, logs: logs };
        }
        if (tile === "$") {
            const opened = openChest(run, room, rng, logs);
            if (!opened.consumed) {
                commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            return finishTurn(run, rng, logs);
        }
        if (tile === "+") {
            let usedDir = null;
            for (let i = 0; i < FACINGS.length; i += 1) {
                const d = FACINGS[i];
                const cell = DOOR_CELL[d];
                if (cell.x === nx && cell.y === ny) {
                    usedDir = d;
                    break;
                }
            }
            const nextId = usedDir != null ? room.doors[usedDir] : null;
            if (nextId == null) {
                logs.push("BLOCKED");
                commitRng(run, rng);
                return { ok: false, blocked: true, logs: logs };
            }
            enterRoom(run, nextId, OPP[usedDir]);
            logs.push("ENTER");
            commitRng(run, rng);
            return { ok: true, logs: logs, roomChanged: true, skipEnemies: true };
        }
        if (tile === ">") {
            if (run.floor === MAX_FLOOR) {
                if (ogreAlive(room)) {
                    logs.push("THE OGRE BARS THE WAY");
                    commitRng(run, rng);
                    return { ok: false, logs: logs };
                }
                logs.push("YOU ESCAPE");
                commitRng(run, rng);
                return { ok: true, logs: logs, won: true, skipEnemies: true };
            }
            run.floor += 1;
            generateFloor(run, rng);
            logs.push("FLOOR " + run.floor);
            commitRng(run, rng);
            return { ok: true, logs: logs, floorChanged: true, roomChanged: true, skipEnemies: true };
        }

        run.x = nx;
        run.y = ny;
        if (tile === "^") {
            run.hp = clamp(run.hp - 2, 0, run.maxHp);
            setTile(room, nx, ny, ".");
            logs.push("TRAP 2");
        }
        return finishTurn(run, rng, logs);
    }

    function waitTurn(run) {
        const logs = ["WAIT"];
        const rng = rngFromRun(run);
        return finishTurn(run, rng, logs);
    }

    function useItem(run, index) {
        const logs = [];
        const rng = rngFromRun(run);
        if (index < 0 || index >= run.pack.length) {
            logs.push("NO ITEM");
            commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        const item = run.pack[index];
        if (item === "potion") {
            run.hp = clamp(run.hp + 6, 0, run.maxHp);
            logs.push("USED POTION");
        } else if (item === "blade") {
            run.atk += 1;
            logs.push("USED BLADE");
        } else if (item === "mail") {
            run.def += 1;
            logs.push("USED MAIL");
        } else {
            logs.push("NO ITEM");
            commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        run.pack.splice(index, 1);
        return finishTurn(run, rng, logs);
    }

    function cannedRoomLine(run) {
        const room = currentRoom(run);
        if (!room) {
            return "DARK STONE.";
        }
        if (room.kind === "start" && run.floor === 1) {
            return "THE GATE CLOSES BEHIND YOU.";
        }
        if (room.kind === "stairs" && run.floor === MAX_FLOOR && ogreAlive(room)) {
            return "THE OGRE FILLS THE STAIRWELL.";
        }
        if (room.kind === "stairs") {
            return "STAIRS DOWN. COLD AIR RISES.";
        }
        if (room.enemies.length) {
            return "YOU ARE NOT ALONE.";
        }
        if (room.chest && !room.chest.open) {
            return "METAL LATCH IN THE DUST.";
        }
        if (room.tiles.join("").indexOf("^") !== -1) {
            return "THE FLOOR LOOKS WRONG.";
        }
        return "EMPTY STONE. KEEP MOVING.";
    }

    function cannedDeathLine(run) {
        const cls = CLASSES[run.classId];
        const name = cls ? cls.name : String(run.classId).toUpperCase();
        return "FL" + run.floor + " " + name + ". THE DUNGEON KEEPS THEM.";
    }

    function cannedWinLine() {
        return "LIGHT. YOU CLIMB OUT ALIVE.";
    }

    function getDrawState(run) {
        const room = currentRoom(run);
        if (!room) {
            return { tiles: blankTiles(), hero: null, enemies: [] };
        }
        return {
            tiles: room.tiles,
            hero: {
                x: run.x,
                y: run.y,
                facing: run.facing,
                classId: run.classId
            },
            enemies: room.enemies.map(function (e) {
                return { type: e.type, x: e.x, y: e.y, hp: e.hp };
            })
        };
    }

    function facingName(facing) {
        if (facing === "N") return "NORTH";
        if (facing === "E") return "EAST";
        if (facing === "S") return "SOUTH";
        return "WEST";
    }

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function snapshotRun(run) {
        if (!run) {
            return null;
        }
        return cloneJson({
            seed: run.seed,
            classId: run.classId,
            floor: run.floor,
            gold: run.gold,
            hp: run.hp,
            maxHp: run.maxHp,
            atk: run.atk,
            def: run.def,
            pack: run.pack,
            facing: run.facing,
            x: run.x,
            y: run.y,
            roomId: run.roomId,
            rooms: run.rooms,
            rngState: run.rngState
        });
    }

    function validateRoom(raw, index) {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        if (!Array.isArray(raw.tiles) || raw.tiles.length !== MAP_SIZE) {
            return null;
        }
        const tiles = [];
        for (let y = 0; y < MAP_SIZE; y += 1) {
            if (typeof raw.tiles[y] !== "string" || raw.tiles[y].length !== MAP_SIZE) {
                return null;
            }
            tiles.push(raw.tiles[y]);
        }
        const doors = {};
        if (raw.doors && typeof raw.doors === "object") {
            FACINGS.forEach(function (d) {
                if (typeof raw.doors[d] === "number" && Number.isFinite(raw.doors[d])) {
                    doors[d] = Math.round(raw.doors[d]);
                }
            });
        }
        const enemies = [];
        if (Array.isArray(raw.enemies)) {
            raw.enemies.forEach(function (e) {
                if (!e || !ENEMY_DEFS[e.type]) {
                    return;
                }
                const x = clamp(Math.round(Number(e.x)), 0, MAP_SIZE - 1);
                const y = clamp(Math.round(Number(e.y)), 0, MAP_SIZE - 1);
                const hp = Math.max(0, Math.round(Number(e.hp)));
                if (hp <= 0) {
                    return;
                }
                enemies.push({
                    type: e.type,
                    x: x,
                    y: y,
                    hp: hp,
                    maxHp: Math.max(hp, Math.round(Number(e.maxHp)) || hp),
                    atk: Math.max(0, Math.round(Number(e.atk)) || ENEMY_DEFS[e.type].atk),
                    def: Math.max(0, Math.round(Number(e.def)) || 0)
                });
            });
        }
        let chest = null;
        if (raw.chest && typeof raw.chest === "object") {
            const item = raw.chest.item;
            if (item === "coin" || ITEM_IDS.indexOf(item) !== -1) {
                chest = {
                    x: clamp(Math.round(Number(raw.chest.x)), 0, MAP_SIZE - 1),
                    y: clamp(Math.round(Number(raw.chest.y)), 0, MAP_SIZE - 1),
                    item: item,
                    open: !!raw.chest.open
                };
            }
        }
        const kind = raw.kind === "start" || raw.kind === "stairs" || raw.kind === "branch" ? raw.kind : "hall";
        return {
            id: typeof raw.id === "number" ? raw.id : index,
            kind: kind,
            tiles: tiles,
            doors: doors,
            enemies: enemies,
            chest: chest
        };
    }

    function validateRun(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        if (!CLASSES[raw.classId]) {
            return null;
        }
        if (!Array.isArray(raw.rooms) || raw.rooms.length < 1) {
            return null;
        }
        const rooms = [];
        for (let i = 0; i < raw.rooms.length; i += 1) {
            const room = validateRoom(raw.rooms[i], i);
            if (!room) {
                return null;
            }
            rooms.push(room);
        }
        const roomId = clamp(Math.round(Number(raw.roomId) || 0), 0, rooms.length - 1);
        const facing = FACINGS.indexOf(raw.facing) !== -1 ? raw.facing : "S";
        const pack = Array.isArray(raw.pack)
            ? raw.pack.filter(function (id) {
                return ITEM_IDS.indexOf(id) !== -1;
            }).slice(0, PACK_MAX)
            : [];
        return {
            seed: (Number(raw.seed) || 0) >>> 0,
            classId: raw.classId,
            floor: clamp(Math.round(Number(raw.floor) || 1), 1, MAX_FLOOR),
            gold: Math.max(0, Math.round(Number(raw.gold) || 0)),
            hp: Math.max(0, Math.round(Number(raw.hp) || 0)),
            maxHp: Math.max(1, Math.round(Number(raw.maxHp) || CLASSES[raw.classId].hp)),
            atk: Math.max(0, Math.round(Number(raw.atk) || 0)),
            def: Math.max(0, Math.round(Number(raw.def) || 0)),
            pack: pack,
            facing: facing,
            x: clamp(Math.round(Number(raw.x) || 3), 0, MAP_SIZE - 1),
            y: clamp(Math.round(Number(raw.y) || 3), 0, MAP_SIZE - 1),
            roomId: roomId,
            rooms: rooms,
            rngState: (Number(raw.rngState) || 0) >>> 0
        };
    }

    function createEmptySave() {
        return {
            v: SNAPSHOT_VERSION,
            meta: { bestFloor: 0, epitaphs: [] },
            run: null
        };
    }

    function applySnapshot(raw) {
        const save = createEmptySave();
        if (!raw || typeof raw !== "object") {
            return save;
        }
        if (raw.meta && typeof raw.meta === "object") {
            if (typeof raw.meta.bestFloor === "number" && Number.isFinite(raw.meta.bestFloor)) {
                save.meta.bestFloor = clamp(Math.round(raw.meta.bestFloor), 0, MAX_FLOOR);
            }
            if (Array.isArray(raw.meta.epitaphs)) {
                save.meta.epitaphs = raw.meta.epitaphs.filter(function (e) {
                    return e && typeof e.line === "string";
                }).slice(0, 8).map(function (e) {
                    return {
                        floor: clamp(Math.round(Number(e.floor) || 0), 0, MAX_FLOOR),
                        classId: CLASSES[e.classId] ? e.classId : "knight",
                        line: String(e.line).slice(0, 80)
                    };
                });
            }
        }
        save.run = validateRun(raw.run);
        return save;
    }

    function snapshot(save) {
        return {
            v: SNAPSHOT_VERSION,
            meta: {
                bestFloor: save.meta.bestFloor,
                epitaphs: save.meta.epitaphs.slice(0, 8)
            },
            run: snapshotRun(save.run)
        };
    }

    function recordDeath(save, line) {
        if (!save.run) {
            return;
        }
        const floor = save.run.floor;
        if (floor > save.meta.bestFloor) {
            save.meta.bestFloor = floor;
        }
        save.meta.epitaphs.unshift({
            floor: floor,
            classId: save.run.classId,
            line: String(line || cannedDeathLine(save.run)).slice(0, 80)
        });
        save.meta.epitaphs = save.meta.epitaphs.slice(0, 8);
        save.run = null;
    }

    function recordWin(save) {
        save.meta.bestFloor = MAX_FLOOR;
        save.run = null;
    }

    global.PocketDungeon = global.PocketDungeon || {};
    global.PocketDungeon.CLASSES = CLASSES;
    global.PocketDungeon.CLASS_ORDER = CLASS_ORDER;
    global.PocketDungeon.PACK_MAX = PACK_MAX;
    global.PocketDungeon.MAX_FLOOR = MAX_FLOOR;
    global.PocketDungeon.newSeed = newSeed;
    global.PocketDungeon.createRun = createRun;
    global.PocketDungeon.cycleFacing = cycleFacing;
    global.PocketDungeon.faceTile = faceTile;
    global.PocketDungeon.pathTo = pathTo;
    global.PocketDungeon.tryAct = tryAct;
    global.PocketDungeon.waitTurn = waitTurn;
    global.PocketDungeon.useItem = useItem;
    global.PocketDungeon.cannedRoomLine = cannedRoomLine;
    global.PocketDungeon.cannedDeathLine = cannedDeathLine;
    global.PocketDungeon.cannedWinLine = cannedWinLine;
    global.PocketDungeon.getDrawState = getDrawState;
    global.PocketDungeon.facingName = facingName;
    global.PocketDungeon.createEmptySave = createEmptySave;
    global.PocketDungeon.applySnapshot = applySnapshot;
    global.PocketDungeon.snapshot = snapshot;
    global.PocketDungeon.recordDeath = recordDeath;
    global.PocketDungeon.recordWin = recordWin;
    global.PocketDungeon.currentRoom = currentRoom;
})(window);
