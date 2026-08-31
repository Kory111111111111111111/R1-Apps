(function (global) {
    const MAP_SIZE = 7;
    const MAX_FLOOR = 8;
    const PACK_MAX = 5;
    const SNAPSHOT_VERSION = 3;
    const LEVEL_CAP = 30;
    const BOSS_HEAVY_COOLDOWN = 2;
    const REWARD_BOONS = {
        wraith: { phaseStep: "PHASE STEP", description: "NEXT MOVE MAY CROSS A WALL" },
        ogre: { lastStand: "LAST STAND", description: "NEXT HEAVY HIT DEALS 0" }
    };
    const FLOOR_THEMES = {
        1: { name: "DAMP CELLARS", line: "WATER DRIPS BETWEEN THE STONES.", trapChance: 25 },
        2: { name: "RAT RUNS", line: "SMALL TEETH SCRATCH IN THE WALLS.", trapChance: 28 },
        3: { name: "SALT VEINS", line: "WHITE SALT CRUSTS THE BLACK FLOOR.", trapChance: 32 },
        4: { name: "WRAITH HALL", line: "THE AIR REMEMBERS EVERY DEATH.", trapChance: 38 },
        5: { name: "BONE GALLERY", line: "OLD ARMOR WATCHES FROM THE DUST.", trapChance: 40 },
        6: { name: "COLD DEEP", line: "YOUR BREATH DOES NOT RISE.", trapChance: 45 },
        7: { name: "IRON DESCENT", line: "THE STONE SHUDDERS BELOW.", trapChance: 50 },
        8: { name: "OGRE HOLD", line: "SOMETHING HUGE BREATHES AHEAD.", trapChance: 55 }
    };
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
        knight: { id: "knight", name: "KNIGHT", hp: 20, atk: 4, def: 2, desc: "GUARD: HALVE DMG + COUNTER", passive: "COUNTERSTRIKE", ability: "GUARD", abilityDesc: "HALVES INCOMING DMG. COUNTERS FOR 1. HOLDS UNTIL HIT." },
        scout: { id: "scout", name: "SCOUT", hp: 16, atk: 4, def: 1, desc: "FIRST STRIKE + TRAP SIGHT", passive: "FIRST STRIKE", ability: "DISARM", abilityDesc: "DISARMS TRAP AHEAD. FIRST HIT EACH FIGHT +1 DMG." },
        mage: { id: "mage", name: "MAGE", hp: 14, atk: 5, def: 0, desc: "3-TILE SPELL · PIERCE", passive: "PIERCE", ability: "SPELL", abilityDesc: "BOLTS 3 TILES. 30% PIERCES TO A SECOND FOE." }
    };
    const CLASS_ORDER = ["knight", "scout", "mage"];

    const ENEMY_DEFS = {
        slime: { hp: 4, atk: 2, def: 0, debut: 1, gold: 2, xp: 3, ai: "slow", name: "SLIME" },
        rat: { hp: 3, atk: 2, def: 0, debut: 1, gold: 1, xp: 2, ai: "swarm", name: "RAT" },
        bat: { hp: 3, atk: 3, def: 0, debut: 2, gold: 3, xp: 4, ai: "erratic", name: "BAT" },
        skeleton: { hp: 6, atk: 3, def: 0, debut: 4, gold: 5, xp: 8, ai: "relentless", name: "SKELETON" },
        ghoul: { hp: 8, atk: 4, def: 0, debut: 4, gold: 6, xp: 10, ai: "patient", name: "GHOUL" },
        ogre: { hp: 20, atk: 5, def: 1, debut: 8, gold: 30, xp: 60, ai: "ogre", name: "OGRE" },
        wraith: { hp: 14, atk: 4, def: 0, debut: 4, gold: 20, xp: 25, ai: "phase", name: "WRAITH" }
    };

    const GEAR_SLOTS = ["weapon", "armor", "charm"];
    const GEAR_DEFS = {
        blade: { slot: "weapon", atk: 1 },
        iron_blade: { slot: "weapon", atk: 3 },
        mail: { slot: "armor", def: 1 },
        shield: { slot: "armor", def: 2 },
        iron_mail: { slot: "armor", def: 3 },
        talisman: { slot: "charm", hp: 6 },
        drain_charm: { slot: "charm", hp: 2, onKillHeal: 1 },
        ward_charm: { slot: "charm", hp: 2, poisonImmune: true }
    };

    const ITEM_IDS = ["potion", "greater_potion", "blade", "mail", "shield", "iron_blade", "iron_mail", "talisman", "drain_charm", "ward_charm"];
    const ITEM_INFO = {
        potion: { name: "POTION", effect: "+6 HP", type: "heal" },
        greater_potion: { name: "G.POTION", effect: "+12 HP", type: "heal" },
        blade: { name: "BLADE", effect: "+1 ATK", type: "gear", slot: "weapon" },
        iron_blade: { name: "IRON BLADE", effect: "+3 ATK", type: "gear", slot: "weapon" },
        mail: { name: "MAIL", effect: "+1 DEF", type: "gear", slot: "armor" },
        shield: { name: "SHIELD", effect: "+2 DEF", type: "gear", slot: "armor" },
        iron_mail: { name: "IRON MAIL", effect: "+3 DEF", type: "gear", slot: "armor" },
        talisman: { name: "TALISMAN", effect: "+6 HP", type: "gear", slot: "charm" },
        drain_charm: { name: "DRAIN CHARM", effect: "+2 HP · +1HP/KILL", type: "gear", slot: "charm" },
        ward_charm: { name: "WARD CHARM", effect: "+2 HP · POISON IMMUNE", type: "gear", slot: "charm" },
        coin: { name: "COIN", effect: "+10 GOLD", type: "gold" }
    };

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

    function xpForNext(level) {
        return 8 + Math.max(1, level) * 4;
    }

    function levelGains(level) {
        return {
            hp: 2,
            atk: level % 2 === 0 ? 1 : 0,
            def: level % 3 === 0 ? 1 : 0
        };
    }

    function emptyGear() {
        return { weapon: null, armor: null, charm: null };
    }

    function normalizeGear(raw) {
        const gear = emptyGear();
        if (!raw || typeof raw !== "object") {
            return gear;
        }
        GEAR_SLOTS.forEach(function (slot) {
            const id = raw[slot];
            if (id && GEAR_DEFS[id] && GEAR_DEFS[id].slot === slot) {
                gear[slot] = id;
            }
        });
        return gear;
    }

    function gearBonus(gear) {
        const bonus = { atk: 0, def: 0, hp: 0 };
        if (!gear) {
            return bonus;
        }
        GEAR_SLOTS.forEach(function (slot) {
            const def = gear[slot] && GEAR_DEFS[gear[slot]];
            if (!def) {
                return;
            }
            bonus.atk += def.atk || 0;
            bonus.def += def.def || 0;
            bonus.hp += def.hp || 0;
        });
        return bonus;
    }

    function hasCharm(run, id) {
        return !!(run && run.gear && run.gear.charm === id);
    }

    function grantXp(run, amount, logs) {
        if (!run || !(amount > 0)) {
            return 0;
        }
        run.xp = Math.max(0, (run.xp || 0) + amount);
        run.xpEarned = (run.xpEarned || 0) + amount;
        let levels = 0;
        let gainHp = 0;
        let gainAtk = 0;
        let gainDef = 0;
        while ((run.level || 1) < LEVEL_CAP && run.xp >= xpForNext(run.level || 1)) {
            run.level = (run.level || 1) + 1;
            run.xp -= xpForNext(run.level - 1);
            const gains = levelGains(run.level);
            run.maxHp += gains.hp;
            run.atk += gains.atk;
            run.def += gains.def;
            run.hp = run.maxHp;
            levels += 1;
            gainHp += gains.hp;
            gainAtk += gains.atk;
            gainDef += gains.def;
        }
        if (levels > 0 && logs) {
            logs.push("LEVEL UP " + run.level + " · +" + gainHp + "HP" + (gainAtk ? " +" + gainAtk + "ATK" : "") + (gainDef ? " +" + gainDef + "DEF" : "") + " · FULL HEAL");
        }
        if ((run.level || 1) >= LEVEL_CAP) {
            run.xp = 0;
        }
        return levels;
    }

    function grantXpToHero(hero, amount, logs) {
        if (!hero) {
            return 0;
        }
        hero.xp = Math.max(0, (hero.xp || 0) + Math.max(0, amount));
        let levels = 0;
        while ((hero.level || 1) < LEVEL_CAP && hero.xp >= xpForNext(hero.level || 1)) {
            hero.level = (hero.level || 1) + 1;
            hero.xp -= xpForNext(hero.level - 1);
            const gains = levelGains(hero.level);
            hero.maxHp = (hero.maxHp || 0) + gains.hp;
            hero.atk = (hero.atk || 0) + gains.atk;
            hero.def = (hero.def || 0) + gains.def;
            hero.hp = hero.maxHp;
            levels += 1;
        }
        if (levels > 0 && logs) {
            logs.push("LEVEL UP " + hero.level);
        }
        if ((hero.level || 1) >= LEVEL_CAP) {
            hero.xp = 0;
        }
        return levels;
    }

    function runGearBonus(run) {
        if (!run) {
            return { atk: 0, def: 0, hp: 0 };
        }
        return {
            atk: Math.max(0, Math.round(Number(run.gearAtk) || 0)),
            def: Math.max(0, Math.round(Number(run.gearDef) || 0)),
            hp: Math.max(0, Math.round(Number(run.gearHp) || 0))
        };
    }

    function stripRunGear(run) {
        if (!run) {
            return null;
        }
        const bonus = runGearBonus(run);
        const maxHp = Math.max(1, (run.maxHp || 1) - bonus.hp);
        return {
            atk: Math.max(0, (run.atk || 0) - bonus.atk),
            def: Math.max(0, (run.def || 0) - bonus.def),
            maxHp: maxHp,
            hp: clamp(run.hp || 0, 0, maxHp)
        };
    }

    function syncHeroFromRun(hero, run) {
        if (!hero || !run) {
            return hero;
        }
        const base = stripRunGear(run);
        hero.classId = run.classId || hero.classId;
        hero.maxHp = base.maxHp;
        hero.hp = base.hp;
        hero.atk = base.atk;
        hero.def = base.def;
        hero.gold = Math.max(0, Math.round(Number(run.gold) || 0));
        hero.pack = Array.isArray(run.pack) ? run.pack.slice() : [];
        // Return gear equipped during the run back to the pack so it is not silently
        // lost, then drop any copy of the hero's persistent gear to avoid duplication.
        if (run.gear) {
            GEAR_SLOTS.forEach(function (slot) {
                const id = run.gear[slot];
                if (id && hero.pack.length < PACK_MAX) {
                    hero.pack.push(id);
                }
            });
        }
        if (hero.gear) {
            hero.pack = hero.pack.filter(function (id) {
                return id !== hero.gear.weapon && id !== hero.gear.armor && id !== hero.gear.charm;
            });
        }
        hero.level = Math.max(1, Math.round(Number(run.level) || 1));
        hero.xp = Math.max(0, Math.round(Number(run.xp) || 0));
        return hero;
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

    function makeEnemy(type, x, y, floor, tier) {
        const def = ENEMY_DEFS[type];
        const bonus = Math.max(0, floor - def.debut);
        const t = Math.max(0, Math.round(Number(tier) || 0));
        const hp = def.hp + bonus + t;
        return {
            type: type,
            x: x,
            y: y,
            hp: hp,
            windup: 0,
            maxHp: hp,
            atk: def.atk + Math.floor(bonus / 3) + Math.floor(t / 2),
            def: def.def,
            gold: (def.gold || 0) + t,
            xpBonus: t,
            ai: def.ai || "slow",
            heavyCooldown: 0,
            heavyTelegraph: false
        };
    }

    function enemyXp(enemy) {
        if (!enemy) {
            return 0;
        }
        const def = ENEMY_DEFS[enemy.type] || {};
        return Math.max(0, Math.round(Number(def.xp) || 0) + Math.round(Number(enemy.xpBonus) || 0));
    }

    function enemyName(type) {
        return (ENEMY_DEFS[type] && ENEMY_DEFS[type].name) || String(type || "").toUpperCase();
    }

    function killEnemy(run, room, enemy, logs) {
        if (!enemy || enemy.hp > 0) {
            return false;
        }
        const name = enemyName(enemy.type);
        logs.push(name + " DOWN");
        const dropGold = enemy.gold || (ENEMY_DEFS[enemy.type] && ENEMY_DEFS[enemy.type].gold) || 0;
        if (dropGold > 0) {
            run.gold += dropGold;
            logs.push("+" + dropGold + " GOLD");
        }
        run.kills = (run.kills || 0) + 1;
        run.slainTypes = run.slainTypes || {};
        run.slainTypes[enemy.type] = (run.slainTypes[enemy.type] || 0) + 1;
        const xp = enemyXp(enemy);
        if (xp > 0) {
            logs.push("+" + xp + " XP");
            grantXp(run, xp, logs);
        }
        if (hasCharm(run, "drain_charm") && run.hp > 0 && run.hp < run.maxHp) {
            run.hp = clamp(run.hp + 1, 0, run.maxHp);
            logs.push("DRAIN +1");
        }
        if (room) {
            room.enemies = room.enemies.filter(function (e) {
                return e.hp > 0;
            });
            if ((enemy.type === "wraith" || enemy.type === "ogre") && room.kind === "stairs") {
                room.reward = {
                    active: true,
                    boss: enemy.type,
                    choice: null,
                    options: enemy.type === "ogre" ? ["gold", "heal", "renown"] : ["heal", "gold", "renown"],
                    boon: enemy.type === "ogre" ? "lastStand" : "phaseStep"
                };
                logs.push("REWARD AWAITS");
            }
        }
        return true;
    }

    function pickLoot(rng) {
        const roll = rng.int(1, 100);
        if (roll <= 45) {
            return "potion";
        }
        if (roll <= 65) {
            return "coin";
        }
        if (roll <= 78) {
            return "blade";
        }
        if (roll <= 88) {
            return "mail";
        }
        if (roll <= 96) {
            return "greater_potion";
        }
        return "shield";
    }

    function pickEnemyType(floor, rng, pool) {
        const source = pool && pool.length ? pool.slice() : ["slime", "rat", "bat", "skeleton", "ghoul"];
        const eligible = source.filter(function (id) {
            if (!ENEMY_DEFS[id] || id === "ogre" || id === "wraith") {
                return false;
            }
            if (pool && pool.length) {
                return true;
            }
            return ENEMY_DEFS[id].debut <= floor;
        });
        return rng.pick(eligible.length ? eligible : ["slime"]);
    }

    function populateRoom(room, floor, rng, opts) {
        const reserved = [];
        punchDoors(room.tiles, room.doors);

        if (opts.stairs) {
            setTile(room, 3, 3, ">");
            reserved.push({ x: 3, y: 3 });
        }
        if (opts.choice) {
            room.choice = { active: true, safe: false, route: null, safeTile: { x: 2, y: 3 }, riskTile: { x: 4, y: 3 } };
            setTile(room, 2, 3, "S");
            setTile(room, 4, 3, "R");
            reserved.push({ x: 2, y: 3 });
            reserved.push({ x: 4, y: 3 });
        }

        if (opts.cleared) {
            return;
        }

        const tier = Math.max(0, Math.round(Number(opts.tier) || 0));

        if (opts.boss) {
            const ogrePos = { x: 3, y: 2 };
            if (getTile(room, ogrePos.x, ogrePos.y) !== ".") {
                ogrePos.y = 4;
            }
            room.enemies.push(makeEnemy("ogre", ogrePos.x, ogrePos.y, floor, tier));
            reserved.push(ogrePos);
            return;
        }
        if (opts.midBoss) {
            const wraithPos = { x: 3, y: 2 };
            if (getTile(room, wraithPos.x, wraithPos.y) !== ".") {
                wraithPos.y = 4;
            }
            room.enemies.push(makeEnemy("wraith", wraithPos.x, wraithPos.y, floor, tier));
            reserved.push(wraithPos);
            return;
        }

        if (opts.start) {
            return;
        }
        if (opts.hazard === "reinforced") {
            room.hazard = "reinforced";
            if (room.enemies.length) {
                room.enemies.forEach(function (enemy) {
                    enemy.hp += 2;
                    enemy.maxHp += 2;
                });
            }
        }
        if (opts.hazard === "blood") {
            room.hazard = "blood";
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

        if (opts.named) {
            const spot = takeSpot() || { x: 3, y: 2 };
            const wight = makeEnemy("skeleton", spot.x, spot.y, floor, tier);
            wight.hp += 6;
            wight.maxHp += 6;
            wight.atk += 1;
            wight.xpBonus = (wight.xpBonus || 0) + 6;
            room.enemies.push(wight);
            return;
        }

        var maxEnemies = 2;
        var minEnemies = 0;
        if (floor >= 4) { maxEnemies = 3; minEnemies = 1; }
        if (floor >= 6) { maxEnemies = 4; minEnemies = 1; }
        const enemyCount = rng.int(minEnemies, maxEnemies);
        for (let i = 0; i < enemyCount; i += 1) {
            const spot = takeSpot();
            if (!spot) {
                break;
            }
            room.enemies.push(makeEnemy(pickEnemyType(floor, rng, opts.enemyPool), spot.x, spot.y, floor, tier));
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

        var trapChance = (FLOOR_THEMES[floor] && FLOOR_THEMES[floor].trapChance) || 25;
        if (rng.int(1, 100) <= trapChance) {
            const spot = takeSpot();
            if (spot) {
                    const usePoison = floor >= 3 && rng.int(1, 100) <= 50;
                setTile(room, spot.x, spot.y, usePoison ? "~" : "^");
            }
        }
    }

    function generateFloor(run, rng) {
        const shortSite = Number(run.siteRoomCount) > 0;
        const extra = run.floor >= 7 ? 2 : 1;
        const roomCount = shortSite
            ? clamp(run.siteRoomCount, 2, 8)
            : clamp(5 + rng.int(0, 3), 5, 8);
        const branchCount = shortSite ? 0 : Math.min(extra, roomCount - 2);
        const backbone = roomCount - branchCount;

        const rooms = [];
        for (let i = 0; i < roomCount; i += 1) {
            rooms.push({
                id: i,
                kind: "hall",
                tiles: blankTiles(),
                doors: {},
                enemies: [],
                chest: null,
                choice: null,
                theme: (FLOOR_THEMES[run.floor] && FLOOR_THEMES[run.floor].name) || "DARK STONE"
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

        const siteLimit = run.maxSiteFloor || MAX_FLOOR;
        const isHoldSite = !run.siteId || run.siteId === "hold";
        const midBoss = isHoldSite && run.floor === 4;
        rooms.forEach(function (room) {
            var pool = run.enemyPool;
            if (!pool && isHoldSite) {
                if (run.floor <= 2) {
                    pool = ["slime", "rat", "bat"];
                } else if (run.floor <= 5) {
                    pool = ["slime", "bat", "skeleton", "ghoul"];
                } else {
                    pool = ["bat", "skeleton", "ghoul"];
                }
            }
            populateRoom(room, run.floor, rng, {
                start: room.kind === "start",
                stairs: room.kind === "stairs",
                boss: room.kind === "stairs" && run.floor === MAX_FLOOR && siteLimit === MAX_FLOOR,
                midBoss: room.kind === "stairs" && midBoss,
                named: room.kind === "stairs" && !!run.namedLast && run.floor === siteLimit,
                cleared: !!run.siteClearedReplay && !(run.contract > 0),
                tier: run.contract || 0,
                enemyPool: pool,
                choice: room.kind === "branch" && run.floor < siteLimit && !run.siteRoomCount,
                hazard: run.floor >= 5 && room.kind !== "start" && room.kind !== "stairs"
                    ? (run.floor >= 7 ? "blood" : "reinforced") : null
            });
        });

        run.rooms = rooms;
        run.roomId = 0;
        run.x = 3;
        run.y = 3;
        run.facing = "S";
        run.firstStrikeUsed = false;
    }

    function createSiteRun(hero, siteId, seed, flags, contract) {
        if (!hero || !CLASSES[hero.classId]) {
            throw new Error("Unknown hero for site: " + (hero && hero.classId));
        }
        const world = global.PocketDungeonWorld;
        const site = world && world.sites && world.sites[siteId];
        const useSeed = (seed == null ? newSeed() : seed) >>> 0;
        const rng = createRng(useSeed);
        const gear = gearBonus(hero.gear);
        const maxHp = Math.max(1, (hero.maxHp || CLASSES[hero.classId].hp) + gear.hp);
        const run = {
            seed: useSeed,
            classId: hero.classId,
            floor: 1,
            gold: Math.max(0, hero.gold || 0),
            hp: clamp(Math.max(0, hero.hp || 0), 0, maxHp),
            maxHp: maxHp,
            atk: Math.max(0, hero.atk || 0) + gear.atk,
            def: Math.max(0, hero.def || 0) + gear.def,
            pack: Array.isArray(hero.pack) ? hero.pack.slice() : [],
            level: Math.max(1, Math.round(Number(hero.level) || 1)),
            xp: Math.max(0, Math.round(Number(hero.xp) || 0)),
            xpEarned: 0,
            gearAtk: gear.atk,
            gearDef: gear.def,
            gearHp: gear.hp,
            gear: normalizeGear(hero.gear),
            contract: Math.max(0, Math.round(Number(contract) || 0)),
            facing: "S",
            x: 3,
            y: 3,
            roomId: 0,
            rooms: [],
            rngState: 0,
            guardTurns: 0,
            kills: 0,
            slainTypes: {},
            poisonTurns: 0,
            firstStrikeUsed: false,
            phaseStep: 0,
            lastStand: 0,
            siteId: siteId || (site && site.id) || "hold",
            maxSiteFloor: site && site.floors ? site.floors : MAX_FLOOR,
            siteRoomCount: site && site.rooms ? site.rooms : null,
            enemyPool: site && site.enemies ? site.enemies.slice() : null,
            namedLast: !!(site && site.namedLast),
            siteClearedReplay: !!(site && flags && flags[site.clear])
        };
        generateFloor(run, rng);
        commitRng(run, rng);
        return run;
    }

    function createRun(classId, seed) {
        const cls = CLASSES[classId];
        if (!cls) {
            throw new Error("Unknown class: " + classId);
        }
        const useSeed = (seed == null ? newSeed() : seed) >>> 0;
        const rng = createRng(useSeed);
        let startingPack = [];
        let startingGold = 0;
        if (cls.id === "scout") {
            startingPack = ["potion"];
            startingGold = 15;
        } else if (cls.id === "mage") {
            startingPack = ["blade"];
        }
        const run = {
            seed: useSeed,
            classId: cls.id,
            floor: 1,
            gold: startingGold,
            hp: cls.hp,
            maxHp: cls.hp,
            atk: cls.atk,
            def: cls.def,
            pack: startingPack,
            level: 1,
            xp: 0,
            xpEarned: 0,
            gearAtk: 0,
            gearDef: 0,
            gearHp: 0,
            gear: emptyGear(),
            contract: 0,
            facing: "S",
            x: 3,
            y: 3,
            roomId: 0,
            rooms: [],
            rngState: 0,
            guardTurns: 0,
            kills: 0,
            slainTypes: {},
            poisonTurns: 0,
            firstStrikeUsed: false,
            phaseStep: 0,
            lastStand: 0
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
        return tile === "." || tile === "^" || tile === "~";
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

    function wraithAlive(room) {
        if (!room || !room.enemies) {
            return false;
        }
        return room.enemies.some(function (e) {
            return e.type === "wraith" && e.hp > 0;
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
        const guarded = run.guardTurns > 0;
        const reduced = guarded ? Math.max(0, Math.floor(dmg / 2)) : dmg;
        run.hp = clamp(run.hp - reduced, 0, run.maxHp);
        const name = (ENEMY_DEFS[enemy.type] && ENEMY_DEFS[enemy.type].name) || enemy.type.toUpperCase();
        logs.push(name + " HIT " + reduced);
        if (guarded) {
            run.guardTurns = 0;
            logs.push("GUARD BREAKS");
            if (run.classId === "knight" && enemy.hp > 0) {
                const counter = Math.max(1, Math.floor(run.atk / 2));
                enemy.hp -= counter;
                logs.push("COUNTER " + counter);
                if (enemy.hp <= 0) {
                    enemy.hp = 0;
                    killEnemy(run, currentRoom(run), enemy, logs);
                }
            }
        }
    }

    function tryMoveStep(run, room, enemy, nx, ny) {
        if (nx === enemy.x && ny === enemy.y) {
            return false;
        }
        if (canEnemyOccupy(run, room, nx, ny, enemy)) {
            enemy.x = nx;
            enemy.y = ny;
            return true;
        }
        return false;
    }

    function chaseHero(run, room, enemy, rng, range) {
        const dist = Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y);
        if (dist > range) {
            return;
        }
        const dx = Math.sign(run.x - enemy.x);
        const dy = Math.sign(run.y - enemy.y);
        const tryXFirst = Math.abs(run.x - enemy.x) >= Math.abs(run.y - enemy.y);
        const attempts = tryXFirst
            ? [{ x: enemy.x + dx, y: enemy.y }, { x: enemy.x, y: enemy.y + dy }]
            : [{ x: enemy.x, y: enemy.y + dy }, { x: enemy.x + dx, y: enemy.y }];
        for (let i = 0; i < attempts.length; i += 1) {
            if (tryMoveStep(run, room, enemy, attempts[i].x, attempts[i].y)) {
                return;
            }
        }
    }

    function stepEnemy(run, room, enemy, rng, logs) {
        if (enemy.hp <= 0) {
            return;
        }
        enemy.telegraph = false;
        const dist = Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y);
        if (enemy.heavyCooldown > 0) enemy.heavyCooldown -= 1;
        if (enemy.windup > 0) {
            enemy.windup -= 1;
            enemy.telegraph = true;
            logs.push((ENEMY_DEFS[enemy.type] || {}).name + " HUNTS");
            if (enemy.windup === 0) {
                attackHero(run, enemy, rng, logs);
            }
            return;
        }
        if (enemy.heavyTelegraph) {
            const heavy = enemy.type === "ogre" ? 4 : 3;
                const boonHeavy = run.lastStand > 0;
            const guardedHeavy = boonHeavy ? 0 : (run.guardTurns > 0 ? Math.max(0, Math.floor(heavy / 2)) : heavy);
            run.hp = clamp(run.hp - guardedHeavy, 0, run.maxHp);
            if (boonHeavy) {
                run.lastStand -= 1;
                logs.push("LAST STAND HOLDS");
            }
            if (run.guardTurns > 0) run.guardTurns = 0;
            logs.push((ENEMY_DEFS[enemy.type] || {}).name + " SMASH " + guardedHeavy);
            enemy.heavyTelegraph = false;
            enemy.heavyCooldown = BOSS_HEAVY_COOLDOWN;
            return;
        }
        if (dist === 1) {
            if (enemy.type === "rat" && rng.int(1, 100) <= 25) {
                const bite = Math.max(1, hitDamage(enemy.atk, run.def, rng) - 1);
                run.hp = clamp(run.hp - bite, 0, run.maxHp);
                if (hasCharm(run, "ward_charm")) {
                    logs.push("RAT BITE " + bite + " · WARDED");
                } else {
                    run.poisonTurns = Math.max(run.poisonTurns || 0, 2);
                    logs.push("RAT BITE " + bite + " · DISEASE");
                }
                return;
            }
            if (enemy.type === "ghoul" && enemy.windup <= 0 && rng.int(1, 100) <= 35) {
                enemy.windup = 1;
                enemy.telegraph = true;
                logs.push("GHOUL HUNTS");
                return;
            }
            if ((enemy.type === "ogre" || enemy.type === "wraith") && enemy.heavyCooldown <= 0) {
                enemy.heavyTelegraph = true;
                enemy.telegraph = true;
                logs.push((ENEMY_DEFS[enemy.type] || {}).name + " RAISES A BLOW");
                return;
            }
            attackHero(run, enemy, rng, logs);
            return;
        }
        const ai = enemy.ai || ENEMY_DEFS[enemy.type] && ENEMY_DEFS[enemy.type].ai || "slow";
        if (ai === "slow") {
            if (rng.int(1, 100) <= 50) {
                return;
            }
            chaseHero(run, room, enemy, rng, 3);
            return;
        }
        if (ai === "swarm") {
            chaseHero(run, room, enemy, rng, 5);
            return;
        }
        if (ai === "erratic") {
            const dirs = FACINGS.slice();
            for (let i = dirs.length - 1; i > 0; i -= 1) {
                const j = rng.int(0, i);
                const tmp = dirs[i];
                dirs[i] = dirs[j];
                dirs[j] = tmp;
            }
            for (let i = 0; i < dirs.length; i += 1) {
                const vec = DIR[dirs[i]];
                if (tryMoveStep(run, room, enemy, enemy.x + vec.x, enemy.y + vec.y)) {
                    return;
                }
            }
            chaseHero(run, room, enemy, rng, 5);
            return;
        }
        if (ai === "relentless") {
            chaseHero(run, room, enemy, rng, 6);
            return;
        }
        if (ai === "patient") {
            if (dist <= 2 || run.hp <= Math.ceil(run.maxHp * 0.5)) {
                chaseHero(run, room, enemy, rng, 6);
            }
            return;
        }
        if (ai === "ogre") {
            if (dist > 3) {
                return;
            }
            chaseHero(run, room, enemy, rng, 4);
            return;
        }
        if (ai === "phase") {
            if (rng.int(1, 100) <= 40) {
                var dirs2 = FACINGS.slice();
                for (var di = dirs2.length - 1; di > 0; di -= 1) {
                    var dj = rng.int(0, di);
                    var tmp2 = dirs2[di];
                    dirs2[di] = dirs2[dj];
                    dirs2[dj] = tmp2;
                }
                for (var di2 = 0; di2 < dirs2.length; di2 += 1) {
                    var vec2 = DIR[dirs2[di2]];
                    var px = enemy.x + vec2.x;
                    var py = enemy.y + vec2.y;
                    if (px >= 0 && py >= 0 && px < MAP_SIZE && py < MAP_SIZE && !(run.x === px && run.y === py) && !enemyAt(room, px, py)) {
                        var tile2 = getTile(room, px, py);
                        if (tile2 !== "+" && tile2 !== "$") {
                            enemy.x = px;
                            enemy.y = py;
                            return;
                        }
                    }
                }
            }
            chaseHero(run, room, enemy, rng, 5);
            return;
        }
        chaseHero(run, room, enemy, rng, 4);
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
        room.enemies.forEach(function (enemy) {
            enemy.telegraph = enemy.hp > 0 && Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y) === 1;
            enemy.heavyTelegraph = !!enemy.heavyTelegraph;
        });
    }

    function finishTurn(run, rng, logs, extra) {
        const result = extra || {};
        if (run.hp > 0 && !result.skipEnemies) {
            enemyTurn(run, rng, logs);
        }        if (run.hp > 0 && run.poisonTurns > 0) {

            run.hp = clamp(run.hp - 1, 0, run.maxHp);
            run.poisonTurns -= 1;
            logs.push("POISON 1");
            if (run.poisonTurns <= 0) {
                logs.push("POISON FADES");
            }
        }
        if (run.hp <= 0) {
            run.hp = 0;
            logs.push("DEAD");
            result.died = true;
        }
        if (run.hp > 0 && !result.skipEnemies) {
            const room = currentRoom(run);
            if (room && room.enemies) {
                room.enemies.forEach(function (enemy) {
                    enemy.telegraph = enemy.hp > 0 && Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y) === 1;
            enemy.heavyTelegraph = !!enemy.heavyTelegraph;
                });
            }
        }
        commitRng(run, rng);
        result.logs = logs;
        result.ok = true;
        return result;
    }

    function enterRoom(run, nextId, viaDir) {
        run.roomId = nextId;
        run.firstStrikeUsed = false;
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
            let bonus = 0;
            if (run.classId === "scout" && !run.firstStrikeUsed) {
                bonus = 1;
                run.firstStrikeUsed = true;
            }
            const dmg = hitDamage(run.atk + bonus, foe.def, rng);
            foe.hp -= dmg;
            const foeName = enemyName(foe.type);
            logs.push("HIT " + foeName + " " + dmg + (bonus ? " · FIRST STRIKE" : ""));
            if (foe.hp <= 0) {
                foe.hp = 0;
                killEnemy(run, room, foe, logs);
            }
            return finishTurn(run, rng, logs);
        }

        const tile = getTile(room, nx, ny);
        if (room.hazard === "blood" && tile === "." && room.enemies.length && rng.int(1, 100) <= 20) {
            run.hp = clamp(run.hp - 1, 0, run.maxHp);
            logs.push("BLOOD DRAIN 1");
        }
        if (room.hazard === "reinforced" && tile === "^") {
            logs.push("IRON TRAP");
        }
        if (tile === "S" || tile === "R") {
            return chooseRoomRoute(run, tile === "S" ? "safe" : "risk");
        }
        if (tile === "#") {
            if (run.classId === "mage" || run.phaseStep <= 0) {
                logs.push("BLOCKED");
                commitRng(run, rng);
                return { ok: false, blocked: true, logs: logs };
            }
            run.x = nx;
            run.y = ny;
            run.phaseStep -= 1;
            logs.push("PHASE STEP");
            return finishTurn(run, rng, logs);
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
            if (room.reward && room.reward.active && !room.reward.choice) {
                logs.push("CHOOSE REWARD");
                commitRng(run, rng);
                return { ok: false, logs: logs, reward: true };
            }
            const siteLimit = run.maxSiteFloor || MAX_FLOOR;
            const isHold = !run.siteId || run.siteId === "hold";
            if (run.floor === siteLimit && !isHold) {
                logs.push("SITE CLEAR");
                commitRng(run, rng);
                return { ok: true, logs: logs, siteCleared: run.siteId, skipEnemies: true };
            }
            if (run.floor === siteLimit && isHold) {
                if (ogreAlive(room)) {
                    logs.push("THE OGRE BARS THE WAY");
                    commitRng(run, rng);
                    return { ok: false, logs: logs };
                }
                logs.push("YOU ESCAPE");
                commitRng(run, rng);
                return { ok: true, logs: logs, won: true, siteCleared: "hold", skipEnemies: true };
            }
            if (isHold && wraithAlive(room)) {
                logs.push("THE WRAITH BARS THE WAY");
                commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            run.floor += 1;
            run.renown = (run.renown || 0) + 1;
            generateFloor(run, rng);
            if (run.phaseStep > 0) logs.push("PHASE STEP READY");
            if (run.lastStand > 0) logs.push("LAST STAND READY");
            logs.push("FLOOR " + run.floor);
            commitRng(run, rng);
            return { ok: true, logs: logs, floorChanged: true, roomChanged: true, skipEnemies: true };
        }

        if (tile === "#" && run.phaseStep > 0) {
            run.x = nx;
            run.y = ny;
            run.phaseStep -= 1;
            logs.push("PHASE STEP");
            return finishTurn(run, rng, logs);
        }
        run.x = nx;
        run.y = ny;
        if (tile === "^") {
            const evaded = run.classId === "scout" && rng.int(1, 100) <= 50;
            const trapDamage = room.hazard === "reinforced" ? 3 : 2;
            if (evaded) {
                logs.push("TRAP EVADED");
            } else {
                run.hp = clamp(run.hp - trapDamage, 0, run.maxHp);
                logs.push("TRAP " + trapDamage);
            }
            setTile(room, nx, ny, ".");
        }
        if (tile === "~") {
            const evaded = run.classId === "scout" && rng.int(1, 100) <= 50;
            if (evaded) {
                logs.push("POISON EVADED");
            } else if (hasCharm(run, "ward_charm")) {
                logs.push("POISON WARDED");
            } else {
                    run.poisonTurns = 3;
                logs.push("POISONED 3T");
            }
            setTile(room, nx, ny, ".");
        }
        return finishTurn(run, rng, logs);
    }

    function useAbility(run) {
        const logs = [];
        const rng = rngFromRun(run);
        if (!run || !currentRoom(run)) {
            return { ok: false, logs: ["NO ROOM"] };
        }
        const room = currentRoom(run);
        if (run.classId === "knight") {
            if (run.guardTurns > 0) {
                logs.push("ALREADY GUARDING");
                commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            run.guardTurns = 1;
            logs.push("GUARD UP · NEXT HIT HALF + COUNTER");
            commitRng(run, rng);
            return { ok: true, logs: logs, skipEnemies: true };
        }
        if (run.classId === "scout") {
            const vec = DIR[run.facing];
            const tx = run.x + vec.x;
            const ty = run.y + vec.y;
            const tile = getTile(room, tx, ty);
            if (tile === "^" || tile === "~") {
                setTile(room, tx, ty, ".");
                logs.push("TRAP DISARMED");
                logs.push("SAFE");
                return finishTurn(run, rng, logs);
            }
            logs.push("NO TRAP");
            commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        if (run.classId === "mage") {
            const vec = DIR[run.facing];
            let enemy = null;
            let hitDist = 0;
            for (let distance = 1; distance <= 3; distance += 1) {
                enemy = enemyAt(room, run.x + vec.x * distance, run.y + vec.y * distance);
                if (enemy) { hitDist = distance; break; }
                if (getTile(room, run.x + vec.x * distance, run.y + vec.y * distance) === "#") break;
            }
            if (!enemy) {
                logs.push("NO TARGET");
                commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            const damage = Math.max(2, run.atk - enemy.def + 1);
            enemy.hp -= damage;
            const enemyNameStr = enemyName(enemy.type);
            logs.push("CAST " + enemyNameStr + " " + damage + " · RANGE " + hitDist);
            if (enemy.hp <= 0) {
                enemy.hp = 0;
                killEnemy(run, room, enemy, logs);
                if (rng.int(1, 100) <= 30) {
                    var secondEnemy = null;
                    for (var d2 = hitDist + 1; d2 <= 3; d2 += 1) {
                        secondEnemy = enemyAt(room, run.x + vec.x * d2, run.y + vec.y * d2);
                        if (secondEnemy) break;
                        if (getTile(room, run.x + vec.x * d2, run.y + vec.y * d2) === "#") break;
                    }
                    if (secondEnemy && secondEnemy.hp > 0) {
                        var pierceDmg = Math.max(1, Math.floor(damage / 2));
                        secondEnemy.hp -= pierceDmg;
                        logs.push("PIERCE " + enemyName(secondEnemy.type) + " " + pierceDmg + " · ARCANE");
                        if (secondEnemy.hp <= 0) {
                            secondEnemy.hp = 0;
                            killEnemy(run, room, secondEnemy, logs);
                        }
                    }
                }
            }
            return finishTurn(run, rng, logs);
        }
        logs.push("NO ABILITY");
        commitRng(run, rng);
        return { ok: false, logs: logs };
    }

    function chooseRoomRoute(run, route) {
        const room = currentRoom(run);
        if (!room || !room.choice || !room.choice.active || (route !== "safe" && route !== "risk")) {
            return { ok: false, logs: ["NO CHOICE"] };
        }
        const rng = rngFromRun(run);
        room.choice.active = false;
        room.choice.safe = route === "safe";
        const safeTile = room.choice.safeTile || { x: 2, y: 3 };
        const riskTile = room.choice.riskTile || { x: 4, y: 3 };
        setTile(room, safeTile.x, safeTile.y, ".");
        setTile(room, riskTile.x, riskTile.y, ".");
        const logs = [];        if (route === "safe") {
            room.enemies = [];
            logs.push("SAFE ROUTE");
        } else {
            run.gold += 10;
            logs.push("RISK ROUTE +10 GOLD");
            if (!room.enemies.length) {
                room.enemies.push(makeEnemy(pickEnemyType(run.floor, rng, run.enemyPool), 4, 3, run.floor, run.contract || 0));
            }
            if (run.floor >= 6 && room.hazard === "blood") {
                room.enemies.forEach(function (enemy) {
                    enemy.atk += 1;
                });
                logs.push("BLOOD FRENZY");
            }
        }

        room.choice.route = route;
        commitRng(run, rng);
        return { ok: true, logs: logs, roomChoice: true, skipEnemies: true };
    }

    function claimReward(run, choiceId) {
        const logs = [];
        const room = currentRoom(run);
        if (!room || !room.reward || !room.reward.active || room.reward.choice) {
            logs.push("NO REWARD");
            return { ok: false, logs: logs };
        }
        const options = room.reward.options && room.reward.options.length ? room.reward.options : ["gold", "heal", "renown"];
        const choice = options.indexOf(choiceId) !== -1 ? choiceId : options[0];
        let amount = 0;
        let renownGain = 0;
        if (choice === "heal") {
            amount = Math.ceil(run.maxHp * 0.5);
            run.hp = Math.min(run.maxHp, run.hp + amount);
        } else if (choice === "renown") {
            amount = 3;
            renownGain = 3;
        } else {
            amount = 15;
            run.gold += amount;
        }
        if (room.reward.boon === "phaseStep") {
            run.phaseStep = 1;
        }
        if (room.reward.boon === "lastStand") {
            run.lastStand = 1;
        }
        room.reward.choice = choice;
        room.reward.active = false;
        const boonText = room.reward.boon === "phaseStep" ? " · PHASE STEP READY" : (room.reward.boon === "lastStand" ? " · LAST STAND READY" : "");
        logs.push(choice.toUpperCase() + " REWARD +" + amount + boonText);
        return { ok: true, logs: logs, reward: choice, renownGain: renownGain };
    }

    function waitTurn(run) {
        const logs = ["WAIT"];
        const rng = rngFromRun(run);
        return finishTurn(run, rng, logs);
    }

    function equipOnRun(run, index, logs) {
        const item = run.pack[index];
        const def = GEAR_DEFS[item];
        if (!def) {
            return false;
        }
        const gear = run.gear = normalizeGear(run.gear);
        const previous = gear[def.slot];
        gear[def.slot] = item;
        const next = gearBonus(gear);
        run.atk = Math.max(0, (run.atk || 0) + next.atk - (run.gearAtk || 0));
        run.def = Math.max(0, (run.def || 0) + next.def - (run.gearDef || 0));
        const maxHp = Math.max(1, (run.maxHp || 1) - (run.gearHp || 0) + next.hp);
        run.hp = clamp(run.hp || 0, 0, maxHp);
        run.maxHp = maxHp;
        run.gearAtk = next.atk;
        run.gearDef = next.def;
        run.gearHp = next.hp;
        run.pack.splice(index, 1);
        if (previous) {
            run.pack.push(previous);
        }
        logs.push("EQUIP " + ((ITEM_INFO[item] && ITEM_INFO[item].name) || item.toUpperCase()));
        return true;
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
        } else if (item === "greater_potion") {
            run.hp = clamp(run.hp + 12, 0, run.maxHp);
            logs.push("USED G.POTION");
        } else if (GEAR_DEFS[item]) {
            equipOnRun(run, index, logs);
            commitRng(run, rng);
            return { ok: true, logs: logs, equip: true };
        } else {
            logs.push("NO ITEM");
            commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        run.pack.splice(index, 1);
        return finishTurn(run, rng, logs);
    }

    function useItemOnHero(hero, index) {
        const logs = [];
        if (!hero || !Array.isArray(hero.pack) || index < 0 || index >= hero.pack.length) {
            logs.push("NO ITEM");
            return { ok: false, logs: logs };
        }
        const item = hero.pack[index];
        if (item === "potion") {
            hero.hp = clamp(hero.hp + 6, 0, hero.maxHp);
            logs.push("USED POTION");
        } else if (item === "greater_potion") {
            hero.hp = clamp(hero.hp + 12, 0, hero.maxHp);
            logs.push("USED G.POTION");
        } else if (GEAR_DEFS[item]) {
            const def = GEAR_DEFS[item];
            const gear = hero.gear = normalizeGear(hero.gear);
            const previous = gear[def.slot];
            gear[def.slot] = item;
            hero.pack.splice(index, 1);
            if (previous) {
                hero.pack.push(previous);
            }
            logs.push("EQUIP " + ((ITEM_INFO[item] && ITEM_INFO[item].name) || item.toUpperCase()));
            return { ok: true, logs: logs, equip: true };
        } else {
            logs.push("NO ITEM");
            return { ok: false, logs: logs };
        }
        hero.pack.splice(index, 1);
        return { ok: true, logs: logs };
    }

    function cannedRoomLine(run) {
        const room = currentRoom(run);
        if (!room) {
            return "DARK STONE.";
        }
        if (room.kind === "start" && run.floor === 1) {
            return "THE GATE CLOSES BEHIND YOU.";
        }
        if (room.kind === "start" && FLOOR_THEMES[run.floor]) {
            return FLOOR_THEMES[run.floor].line;
        }
        if (room.kind === "stairs" && run.floor === MAX_FLOOR && ogreAlive(room)) {
            return "THE OGRE FILLS THE STAIRWELL.";
        }
        if (room.kind === "stairs" && wraithAlive(room)) {
            return "A WRAITH HAUNTS THE STAIRS.";
        }
        if (room.kind === "stairs") {
            if (run.floor <= 2) return "STAIRS DOWN. DAMP AIR RISES.";
            if (run.floor <= 5) return "STAIRS DOWN. COLD AIR RISES.";
            return "STAIRS DOWN. THE DARK BREATHES.";
        }
        if (room.enemies.length) {
            const types = {};
            room.enemies.forEach(function (e) {
                types[e.type] = (types[e.type] || 0) + 1;
            });
            const names = Object.keys(types).map(function (t) {
                return (ENEMY_DEFS[t] && ENEMY_DEFS[t].name) || t.toUpperCase();
            });
            if (room.enemies.length === 1) {
                return names[0] + " IN THE DARK.";
            }
            return "YOU ARE NOT ALONE.";
        }
        if (room.chest && !room.chest.open) {
            return "METAL LATCH IN THE DUST.";
        }
        if (room.tiles.join("").indexOf("^") !== -1 || room.tiles.join("").indexOf("~") !== -1) {
            return "THE FLOOR LOOKS WRONG.";
        }
        return "EMPTY STONE. KEEP MOVING.";
    }

    function cannedDeathLine(run) {
        const cls = CLASSES[run.classId];
        const name = cls ? cls.name : String(run.classId).toUpperCase();
        const kills = run.kills || 0;
        return "FL" + run.floor + " " + name + " · " + kills + " KILLS · " + (run.gold || 0) + " GOLD";
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
            floor: run.floor,
            enemies: room.enemies.map(function (e) {
                return { type: e.type, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, telegraph: !!e.telegraph, heavyTelegraph: !!e.heavyTelegraph, windup: !!e.windup };
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
            level: run.level || 1,
            xp: run.xp || 0,
            xpEarned: run.xpEarned || 0,
            gear: run.gear ? normalizeGear(run.gear) : null,
            gearAtk: run.gearAtk || 0,
            gearDef: run.gearDef || 0,
            gearHp: run.gearHp || 0,
            contract: run.contract || 0,
            facing: run.facing,
            x: run.x,
            y: run.y,
            roomId: run.roomId,
            rooms: run.rooms,
            rngState: run.rngState,
            guardTurns: run.guardTurns || 0,
            kills: run.kills || 0,
            slainTypes: run.slainTypes ? cloneJson(run.slainTypes) : {},
            poisonTurns: run.poisonTurns || 0,
            firstStrikeUsed: !!run.firstStrikeUsed,
            phaseStep: run.phaseStep || 0,
            lastStand: run.lastStand || 0,
            renown: run.renown || 0,
            roomChoice: run.roomChoice ? { active: !!run.roomChoice.active, safe: !!run.roomChoice.safe } : null,
            siteId: run.siteId || null,
            maxSiteFloor: run.maxSiteFloor || null,
            siteRoomCount: run.siteRoomCount || null,
            enemyPool: run.enemyPool || null,
            namedLast: !!run.namedLast,
            siteClearedReplay: !!run.siteClearedReplay
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
                    def: Math.max(0, Math.round(Number(e.def)) || 0),
                    gold: Math.max(0, Math.round(Number(e.gold)) || ENEMY_DEFS[e.type].gold || 0),
                    ai: ENEMY_DEFS[e.type].ai || "slow",
                    heavyCooldown: Math.max(0, Math.round(Number(e.heavyCooldown) || 0)),
                    heavyTelegraph: !!e.heavyTelegraph,
                    windup: Math.max(0, Math.min(1, Math.round(Number(e.windup) || 0)))
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
            chest: chest,
            reward: raw.reward && typeof raw.reward === "object" ? { active: !!raw.reward.active, boss: typeof raw.reward.boss === "string" ? raw.reward.boss : "", choice: typeof raw.reward.choice === "string" ? raw.reward.choice : null, options: Array.isArray(raw.reward.options) ? raw.reward.options.filter(function (id) { return id === "gold" || id === "heal" || id === "renown"; }) : null, boon: typeof raw.reward.boon === "string" ? raw.reward.boon : null } : null,
            choice: raw.choice && typeof raw.choice === "object" ? { active: !!raw.choice.active, safe: !!raw.choice.safe, route: raw.choice.route === "safe" || raw.choice.route === "risk" ? raw.choice.route : null, safeTile: { x: 2, y: 3 }, riskTile: { x: 4, y: 3 } } : null,
            theme: typeof raw.theme === "string" ? raw.theme.slice(0, 32) : "DARK STONE",
            hazard: raw.hazard === "reinforced" || raw.hazard === "blood" ? raw.hazard : null
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
            level: clamp(Math.round(Number(raw.level) || 1), 1, LEVEL_CAP),
            xp: Math.max(0, Math.round(Number(raw.xp) || 0)),
            xpEarned: Math.max(0, Math.round(Number(raw.xpEarned) || 0)),
            gear: normalizeGear(raw.gear),
            gearAtk: Math.max(0, Math.round(Number(raw.gearAtk) || 0)),
            gearDef: Math.max(0, Math.round(Number(raw.gearDef) || 0)),
            gearHp: Math.max(0, Math.round(Number(raw.gearHp) || 0)),
            contract: Math.max(0, Math.round(Number(raw.contract) || 0)),
            facing: facing,
            x: clamp(Math.round(Number(raw.x) || 3), 0, MAP_SIZE - 1),
            y: clamp(Math.round(Number(raw.y) || 3), 0, MAP_SIZE - 1),
            roomId: roomId,
            rooms: rooms,
            rngState: (Number(raw.rngState) || 0) >>> 0,
            guardTurns: raw.guardTurns > 0 ? 1 : 0,
            kills: Math.max(0, Math.round(Number(raw.kills) || 0)),
            slainTypes: raw.slainTypes && typeof raw.slainTypes === "object"
                ? Object.keys(raw.slainTypes).filter(function (type) { return ENEMY_DEFS[type]; }).reduce(function (acc, type) { acc[type] = Math.max(1, Math.round(Number(raw.slainTypes[type]) || 0)); return acc; }, {})
                : {},
            poisonTurns: Math.max(0, Math.min(3, Math.round(Number(raw.poisonTurns) || 0))),
            firstStrikeUsed: !!raw.firstStrikeUsed,
            phaseStep: Math.max(0, Math.min(1, Math.round(Number(raw.phaseStep) || 0))),
            lastStand: Math.max(0, Math.min(1, Math.round(Number(raw.lastStand) || 0))),
            renown: Math.max(0, Math.round(Number(raw.renown) || 0)),
            roomChoice: raw.roomChoice && typeof raw.roomChoice === "object" ? { active: !!raw.roomChoice.active, safe: !!raw.roomChoice.safe } : null,
            siteId: typeof raw.siteId === "string" ? raw.siteId : null,
            maxSiteFloor: Number(raw.maxSiteFloor) > 0 ? Math.min(MAX_FLOOR, Math.round(Number(raw.maxSiteFloor))) : null,
            siteRoomCount: Number(raw.siteRoomCount) > 0 ? Math.round(Number(raw.siteRoomCount)) : null,
            enemyPool: Array.isArray(raw.enemyPool) ? raw.enemyPool.filter(function (id) { return ENEMY_DEFS[id]; }) : null,
            namedLast: !!raw.namedLast,
            siteClearedReplay: !!raw.siteClearedReplay
        };
    }

    function createHero(classId, meta) {
        const cls = CLASSES[classId] || CLASSES.knight;
        const shrine = meta && meta.shrinePurchases || {};
        const vigor = Math.max(0, Math.round(Number(shrine.vigor) || 0));
        const edge = Math.max(0, Math.round(Number(shrine.edge) || 0));
        const bulwark = Math.max(0, Math.round(Number(shrine.bulwark) || 0));
        const bonusHp = vigor * 2;
        const bonusAtk = edge;
        const bonusDef = bulwark;
        return {
            classId: cls.id,
            hp: cls.hp + bonusHp,
            maxHp: cls.hp + bonusHp,
            atk: cls.atk + bonusAtk,
            def: cls.def + bonusDef,
            gold: cls.id === "scout" ? 15 : 0,
            pack: cls.id === "scout" ? ["potion"] : (cls.id === "mage" ? ["blade"] : []),
            level: 1,
            xp: 0,
            gear: emptyGear(),
            lastInn: "ashford"
        };
    }

    function normalizeHero(hero) {
        if (!hero) {
            return null;
        }
        const cls = CLASSES[hero.classId] || CLASSES.knight;
        hero.classId = cls.id;
        hero.maxHp = Math.max(1, Math.round(Number(hero.maxHp) || cls.hp));
        hero.hp = clamp(Math.round(Number(hero.hp) || hero.maxHp), 0, hero.maxHp);
        hero.atk = Math.max(0, Math.round(Number(hero.atk) || 0));
        hero.def = Math.max(0, Math.round(Number(hero.def) || 0));
        hero.gold = Math.max(0, Math.round(Number(hero.gold) || 0));
        hero.pack = Array.isArray(hero.pack) ? hero.pack.filter(function (id) { return ITEM_IDS.indexOf(id) !== -1; }).slice(0, PACK_MAX) : [];
        hero.level = clamp(Math.round(Number(hero.level) || 1), 1, LEVEL_CAP);
        hero.xp = Math.max(0, Math.round(Number(hero.xp) || 0));
        hero.gear = normalizeGear(hero.gear);
        grantXpToHero(hero, 0);
        hero.hp = Math.min(hero.hp, hero.maxHp);
        return hero;
    }

    function createEmptySave() {
        return {
            v: SNAPSHOT_VERSION,
            hero: null,
            flags: {},
            location: { kind: "town", id: "ashford" },
            site: null,
            meta: { deaths: 0, journal: [], bestFloor: 0, renown: 0, epitaphs: [], kills: 0, contractsDone: 0, contractTiers: {}, bestiary: {} },
            run: null
        };
    }

    function migrateV1(raw, save) {
        if (raw.run) {
            save.site = snapshotRun(raw.run);
            save.location = { kind: "site", id: "hold" };
            save.hero = {
                classId: raw.run.classId,
                hp: raw.run.hp,
                maxHp: raw.run.maxHp,
                atk: raw.run.atk,
                def: raw.run.def,
                gold: raw.run.gold,
                pack: raw.run.pack,
                lastInn: "ashford"
            };
        } else {
            save.location = { kind: "town", id: "ashford" };
        }
        if (raw.meta && Array.isArray(raw.meta.epitaphs)) {
            save.meta.journal = raw.meta.epitaphs.map(function (entry) {
                return String(entry.line || "");
            }).filter(Boolean);
        }
        save.meta.deaths = save.meta.journal.length;
    }

    function applySnapshot(raw) {
        const save = createEmptySave();
        if (!raw || typeof raw !== "object") {
            return save;
        }
        if (Number(raw.v || 1) < 2) {
            migrateV1(raw, save);
        } else {
            if (raw.hero && typeof raw.hero === "object" && CLASSES[raw.hero.classId]) {
                const base = createHero(raw.hero.classId, raw.meta);
                save.hero = {
                    classId: base.classId,
                    hp: clamp(Math.round(Number(raw.hero.hp) || base.hp), 0, Math.max(1, Math.round(Number(raw.hero.maxHp) || base.maxHp))),
                    maxHp: Math.max(1, Math.round(Number(raw.hero.maxHp) || base.maxHp)),
                    atk: Math.max(0, Math.round(Number(raw.hero.atk) || base.atk)),
                    def: Math.max(0, Math.round(Number(raw.hero.def) || base.def)),
                    gold: Math.max(0, Math.round(Number(raw.hero.gold) || 0)),
                    pack: Array.isArray(raw.hero.pack) ? raw.hero.pack.filter(function (id) { return ITEM_IDS.indexOf(id) !== -1; }).slice(0, PACK_MAX) : [],
                    level: Math.max(1, Math.round(Number(raw.hero.level) || 1)),
                    xp: Math.max(0, Math.round(Number(raw.hero.xp) || 0)),
                    gear: raw.hero.gear && typeof raw.hero.gear === "object" ? raw.hero.gear : null,
                    lastInn: typeof raw.hero.lastInn === "string" ? raw.hero.lastInn : "ashford"
                };
            }
            if (raw.flags && typeof raw.flags === "object") {
                Object.keys(raw.flags).forEach(function (key) {
                    if (raw.flags[key]) save.flags[key] = 1;
                });
            }
            if (raw.location && (raw.location.kind === "town" || raw.location.kind === "travel" || raw.location.kind === "site")) {
                save.location = { kind: raw.location.kind, id: String(raw.location.id || "ashford") };
            }
            save.site = validateRun(raw.site);
            if (raw.meta && typeof raw.meta === "object") {
                save.meta.deaths = Math.max(0, Math.round(Number(raw.meta.deaths) || 0));
                save.meta.journal = Array.isArray(raw.meta.journal) ? raw.meta.journal.filter(function (line) { return typeof line === "string"; }).slice(0, 32).map(function (line) { return line.slice(0, 120); }) : [];
                if (typeof raw.meta.bestFloor === "number") save.meta.bestFloor = clamp(Math.round(raw.meta.bestFloor), 0, MAX_FLOOR);
                save.meta.renown = Math.max(0, Math.round(Number(raw.meta.renown) || 0));
                if (raw.meta.shrinePurchases && typeof raw.meta.shrinePurchases === "object") {
                    save.meta.shrinePurchases = {};
                    Object.keys(raw.meta.shrinePurchases).forEach(function (key) {
                        if (raw.meta.shrinePurchases[key]) {
                            save.meta.shrinePurchases[key] = Math.round(Number(raw.meta.shrinePurchases[key]) || 0);
                        }
                    });
                }
                if (Array.isArray(raw.meta.epitaphs)) save.meta.epitaphs = raw.meta.epitaphs.filter(function (entry) { return entry && typeof entry.line === "string"; }).slice(0, 8);
                save.meta.kills = Math.max(0, Math.round(Number(raw.meta.kills) || 0));
                save.meta.contractsDone = Math.max(0, Math.round(Number(raw.meta.contractsDone) || 0));
                if (raw.meta.contractTiers && typeof raw.meta.contractTiers === "object") {
                    save.meta.contractTiers = {};
                    Object.keys(raw.meta.contractTiers).forEach(function (key) {
                        const value = Math.round(Number(raw.meta.contractTiers[key]) || 0);
                        if (value > 0) {
                            save.meta.contractTiers[key] = value;
                        }
                    });
                }
                if (raw.meta.bestiary && typeof raw.meta.bestiary === "object") {
                    save.meta.bestiary = {};
                    Object.keys(raw.meta.bestiary).forEach(function (key) {
                        const count = Math.round(Number(raw.meta.bestiary[key]) || 0);
                        if (count > 0) {
                            save.meta.bestiary[key] = count;
                        }
                    });
                }
            }
        }
        save.run = save.site;
        normalizeHero(save.hero);
        if (!save.hero && save.site) {
            save.hero = createHero(save.site.classId, save.meta);
        }
        if (save.site && !save.location.id) save.location = { kind: "site", id: "hold" };
        return save;
    }

    function snapshot(save) {
        return {
            v: SNAPSHOT_VERSION,
            hero: save.hero ? cloneJson(save.hero) : null,
            flags: cloneJson(save.flags || {}),
            location: cloneJson(save.location || { kind: "town", id: "ashford" }),
            site: snapshotRun(save.site || save.run),
            meta: {
                deaths: save.meta.deaths || 0,
                journal: (save.meta.journal || []).slice(0, 32),
                bestFloor: save.meta.bestFloor || 0,
                renown: save.meta.renown || 0,
                shrinePurchases: cloneJson(save.meta.shrinePurchases || {}),
                epitaphs: (save.meta.epitaphs || []).slice(0, 8),
                kills: save.meta.kills || 0,
                contractsDone: save.meta.contractsDone || 0,
                contractTiers: cloneJson(save.meta.contractTiers || {}),
                bestiary: cloneJson(save.meta.bestiary || {})
            }
        };
    }

    function recordDeath(save, line) {
        const run = save.site || save.run;
        if (!run) return;
        const floor = clamp(run.floor, 1, MAX_FLOOR);
        save.hero = save.hero || createHero(run.classId, save.meta);
        syncHeroFromRun(save.hero, run);
        save.hero.hp = save.hero.maxHp;
        save.hero.gold = Math.floor(Math.max(0, save.hero.gold) / 2);
        save.hero.lastInn = save.hero.lastInn || "ashford";
        save.flags = save.flags || {};
        save.meta = save.meta || { deaths: 0, journal: [] };
        save.meta.deaths = (save.meta.deaths || 0) + 1;
        save.meta.kills = Math.max(0, (save.meta.kills || 0) + (run.kills || 0));
        save.meta.bestiary = save.meta.bestiary || {};
        if (run.slainTypes) {
            Object.keys(run.slainTypes).forEach(function (type) {
                save.meta.bestiary[type] = Math.max(save.meta.bestiary[type] || 0, run.slainTypes[type]);
            });
        }
        save.meta.journal = save.meta.journal || [];
        save.meta.journal.unshift(String(line || cannedDeathLine(run)).slice(0, 120));
        save.meta.journal = save.meta.journal.slice(0, 32);
        save.meta.bestFloor = Math.max(save.meta.bestFloor || 0, floor);
        const renownGain = Math.floor((run.kills || 0) * 0.5) + floor;
        save.meta.renown = Math.max(0, (save.meta.renown || 0) + renownGain);
        save.meta.epitaphs = save.meta.epitaphs || [];
        save.meta.epitaphs.unshift({ floor: floor, classId: run.classId, level: run.level || 1, kills: run.kills || 0, gold: run.gold || 0, renown: renownGain, line: String(line || cannedDeathLine(run)).slice(0, 80) });
        save.meta.epitaphs = save.meta.epitaphs.slice(0, 8);
        save.site = null;
        save.run = null;
        save.location = { kind: "town", id: save.hero.lastInn };
    }

    function recordWin(save) {
        save.meta = save.meta || { deaths: 0, journal: [], bestFloor: 0, epitaphs: [] };
        save.meta.bestFloor = MAX_FLOOR;
        if (global.PocketDungeonWorld && global.PocketDungeonWorld.completeSite) {
            global.PocketDungeonWorld.completeSite(save, "hold");
            return;
        }
        const run = save.site || save.run;
        if (run) {
            save.hero = save.hero || createHero(run.classId, save.meta);
            syncHeroFromRun(save.hero, run);
            save.hero.lastInn = "keepgate";
        }
        save.site = null;
        save.run = null;
        save.location = { kind: "town", id: "keepgate" };
        save.flags = Object.assign({}, save.flags || {}, { keepgate_hold_clear: 1 });
    }

    global.PocketDungeon = global.PocketDungeon || {};
    global.PocketDungeon.CLASSES = CLASSES;
    global.PocketDungeon.CLASS_ORDER = CLASS_ORDER;
    global.PocketDungeon.ITEM_INFO = ITEM_INFO;
    global.PocketDungeon.ENEMY_DEFS = ENEMY_DEFS;
    global.PocketDungeon.PACK_MAX = PACK_MAX;
    global.PocketDungeon.MAX_FLOOR = MAX_FLOOR;
    global.PocketDungeon.newSeed = newSeed;
    global.PocketDungeon.createRng = createRng;
    global.PocketDungeon.makeEnemy = makeEnemy;
    global.PocketDungeon.LEVEL_CAP = LEVEL_CAP;
    global.PocketDungeon.xpForNext = xpForNext;
    global.PocketDungeon.levelGains = levelGains;
    global.PocketDungeon.grantXp = grantXp;
    global.PocketDungeon.grantXpToHero = grantXpToHero;
    global.PocketDungeon.GEAR_SLOTS = GEAR_SLOTS;
    global.PocketDungeon.GEAR_DEFS = GEAR_DEFS;
    global.PocketDungeon.gearBonus = gearBonus;
    global.PocketDungeon.normalizeGear = normalizeGear;
    global.PocketDungeon.enemyXp = enemyXp;
    global.PocketDungeon.killEnemy = killEnemy;
    global.PocketDungeon.stripRunGear = stripRunGear;
    global.PocketDungeon.syncHeroFromRun = syncHeroFromRun;
    global.PocketDungeon.generateFloor = generateFloor;
    global.PocketDungeon.createRun = createRun;
    global.PocketDungeon.createHero = createHero;
    global.PocketDungeon.createSiteRun = createSiteRun;
    global.PocketDungeon.cycleFacing = cycleFacing;
    global.PocketDungeon.faceTile = faceTile;
    global.PocketDungeon.pathTo = pathTo;
    global.PocketDungeon.tryAct = tryAct;
    global.PocketDungeon.waitTurn = waitTurn;
    global.PocketDungeon.chooseRoomRoute = chooseRoomRoute;
    global.PocketDungeon.claimReward = claimReward;
    global.PocketDungeon.hasCharm = hasCharm;
    global.PocketDungeon.useAbility = useAbility;
    global.PocketDungeon.useItem = useItem;
    global.PocketDungeon.useItemOnHero = useItemOnHero;
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
