(function (global) {
    /* Shared engine primitives and static data: seeded RNG, math, progression, gear, tile helpers. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    const MAP_SIZE = 7;
    const MAX_FLOOR = 8;
    const MAX_ROOMS = 8;
    const PACK_MAX = 5;
    const ROOM_TILE_CHARS = ".#+>$^~SR!";
    const SNAPSHOT_VERSION = 3;
    const LEVEL_CAP = 30;
    const BOSS_HEAVY_COOLDOWN = 2;
    // A caster is cowardly, not endless: it may retreat this many tiles per
    // encounter before it stops backing away and fights. Keeps the back-away
    // readable ("it gives ground twice, then it comes at you") while making
    // every melee approach winnable.
    const ACOLYTE_FLEE_TILES = 2;
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
        acolyte: { hp: 6, atk: 4, def: 0, debut: 5, gold: 7, xp: 12, ai: "caster", name: "ACOLYTE" },
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

    function optionalCoordinate(value) {
        const number = Number(value);
        return Number.isInteger(number) && number >= 0 && number < MAP_SIZE ? number : null;
    }

    function boundedInt(value, fallback, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return fallback;
        }
        return clamp(Math.round(number), min, max);
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
        // Persistent equipment is already owned by the hero. Only return a changed
        // run slot; replacement gear remains a real pack item after a retreat/death.
        GEAR_SLOTS.forEach(function (slot) {
            const persistentId = hero.gear && hero.gear[slot];
            const runId = run.gear && run.gear[slot];
            const persistentIndex = persistentId ? hero.pack.indexOf(persistentId) : -1;
            if (persistentIndex !== -1) {
                hero.pack.splice(persistentIndex, 1);
            }
            if (runId && runId !== persistentId && hero.pack.length < PACK_MAX) {
                hero.pack.push(runId);
            }
        });
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
        return run && Array.isArray(run.rooms) ? run.rooms[run.roomId] : null;
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


    PD.MAP_SIZE = MAP_SIZE;
    PD.MAX_FLOOR = MAX_FLOOR;
    PD.MAX_ROOMS = MAX_ROOMS;
    PD.PACK_MAX = PACK_MAX;
    PD.ROOM_TILE_CHARS = ROOM_TILE_CHARS;
    PD.SNAPSHOT_VERSION = SNAPSHOT_VERSION;
    PD.LEVEL_CAP = LEVEL_CAP;
    PD.BOSS_HEAVY_COOLDOWN = BOSS_HEAVY_COOLDOWN;
    PD.ACOLYTE_FLEE_TILES = ACOLYTE_FLEE_TILES;
    PD.REWARD_BOONS = REWARD_BOONS;
    PD.FLOOR_THEMES = FLOOR_THEMES;
    PD.FACINGS = FACINGS;
    PD.OPP = OPP;
    PD.DIR = DIR;
    PD.DOOR_CELL = DOOR_CELL;
    PD.DOOR_INNER = DOOR_INNER;
    PD.CLASSES = CLASSES;
    PD.CLASS_ORDER = CLASS_ORDER;
    PD.ENEMY_DEFS = ENEMY_DEFS;
    PD.GEAR_SLOTS = GEAR_SLOTS;
    PD.GEAR_DEFS = GEAR_DEFS;
    PD.ITEM_IDS = ITEM_IDS;
    PD.ITEM_INFO = ITEM_INFO;
    PD.lastCryptoValue = lastCryptoValue;
    PD.cryptoRepeatStreak = cryptoRepeatStreak;
    PD.cryptoUint32 = cryptoUint32;
    PD.newSeed = newSeed;
    PD.createRng = createRng;
    PD.rngFromRun = rngFromRun;
    PD.commitRng = commitRng;
    PD.clamp = clamp;
    PD.optionalCoordinate = optionalCoordinate;
    PD.boundedInt = boundedInt;
    PD.xpForNext = xpForNext;
    PD.levelGains = levelGains;
    PD.emptyGear = emptyGear;
    PD.normalizeGear = normalizeGear;
    PD.gearBonus = gearBonus;
    PD.hasCharm = hasCharm;
    PD.grantXp = grantXp;
    PD.grantXpToHero = grantXpToHero;
    PD.runGearBonus = runGearBonus;
    PD.stripRunGear = stripRunGear;
    PD.syncHeroFromRun = syncHeroFromRun;
    PD.getTile = getTile;
    PD.setTile = setTile;
    PD.currentRoom = currentRoom;
    PD.enemyAt = enemyAt;
    PD.hitDamage = hitDamage;
    PD.blankTiles = blankTiles;
})(typeof window !== "undefined" ? window : global);
