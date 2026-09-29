(function (global) {
    /* Procedural generation: room layout, doors, enemy population, floor assembly. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    function punchDoors(tiles, doors) {
        PD.FACINGS.forEach(function (dir) {
            if (doors[dir] == null) {
                return;
            }
            const cell = PD.DOOR_CELL[dir];
            const row = tiles[cell.y];
            tiles[cell.y] = row.slice(0, cell.x) + "+" + row.slice(cell.x + 1);
        });
    }

    function interiorSpots(room) {
        const spots = [];
        for (let y = 1; y < PD.MAP_SIZE - 1; y += 1) {
            for (let x = 1; x < PD.MAP_SIZE - 1; x += 1) {
                spots.push({ x: x, y: y });
            }
        }
        return spots;
    }

    function isReserved(x, y, doors, extra) {
        if (x === 3 && y === 3) {
            return true;
        }
        for (let i = 0; i < PD.FACINGS.length; i += 1) {
            const dir = PD.FACINGS[i];
            if (doors[dir] == null) {
                continue;
            }
            const inner = PD.DOOR_INNER[dir];
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
        const freeA = PD.FACINGS.filter(function (d) {
            return rooms[a].doors[d] == null;
        });
        const options = freeA.filter(function (d) {
            return rooms[b].doors[PD.OPP[d]] == null;
        });
        if (!options.length) {
            return false;
        }
        const dir = rng.pick(options);
        rooms[a].doors[dir] = b;
        rooms[b].doors[PD.OPP[dir]] = a;
        return true;
    }

    function makeEnemy(type, x, y, floor, tier) {
        const def = PD.ENEMY_DEFS[type];
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
        const def = PD.ENEMY_DEFS[enemy.type] || {};
        return Math.max(0, Math.round(Number(def.xp) || 0) + Math.round(Number(enemy.xpBonus) || 0));
    }

    function enemyName(type) {
        return (PD.ENEMY_DEFS[type] && PD.ENEMY_DEFS[type].name) || String(type || "").toUpperCase();
    }

    function killEnemy(run, room, enemy, logs) {
        if (!enemy || enemy.hp > 0) {
            return false;
        }
        const name = enemyName(enemy.type);
        logs.push(name + " DOWN");
        const dropGold = enemy.gold || (PD.ENEMY_DEFS[enemy.type] && PD.ENEMY_DEFS[enemy.type].gold) || 0;
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
            PD.grantXp(run, xp, logs);
        }
        if (PD.hasCharm(run, "drain_charm") && run.hp > 0 && run.hp < run.maxHp) {
            run.hp = PD.clamp(run.hp + 1, 0, run.maxHp);
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
            if (!PD.ENEMY_DEFS[id] || id === "ogre" || id === "wraith") {
                return false;
            }
            if (pool && pool.length) {
                return true;
            }
            return PD.ENEMY_DEFS[id].debut <= floor;
        });
        return rng.pick(eligible.length ? eligible : ["slime"]);
    }

    function populateRoom(room, floor, rng, opts) {
        const reserved = [];
        punchDoors(room.tiles, room.doors);

        if (opts.stairs) {
            PD.setTile(room, 3, 3, ">");
            reserved.push({ x: 3, y: 3 });
        }
        if (opts.choice) {
            room.choice = { active: true, safe: false, route: null, safeTile: { x: 2, y: 3 }, riskTile: { x: 4, y: 3 } };
            PD.setTile(room, 2, 3, "S");
            PD.setTile(room, 4, 3, "R");
            reserved.push({ x: 2, y: 3 });
            reserved.push({ x: 4, y: 3 });
        }

        if (opts.cleared) {
            return;
        }

        const tier = Math.max(0, Math.round(Number(opts.tier) || 0));

        if (opts.boss) {
            const ogrePos = { x: 3, y: 2 };
            if (PD.getTile(room, ogrePos.x, ogrePos.y) !== ".") {
                ogrePos.y = 4;
            }
            room.enemies.push(makeEnemy("ogre", ogrePos.x, ogrePos.y, floor, tier));
            reserved.push(ogrePos);
            return;
        }
        if (opts.midBoss) {
            const wraithPos = { x: 3, y: 2 };
            if (PD.getTile(room, wraithPos.x, wraithPos.y) !== ".") {
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
            return PD.getTile(room, p.x, p.y) === "." && !isReserved(p.x, p.y, room.doors, reserved);
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
                PD.setTile(room, spot.x, spot.y, "$");
                reserved.push(spot);
            }
        }

        var trapChance = (PD.FLOOR_THEMES[floor] && PD.FLOOR_THEMES[floor].trapChance) || 25;
        if (rng.int(1, 100) <= trapChance) {
            const spot = takeSpot();
            if (spot) {
                    const usePoison = floor >= 3 && rng.int(1, 100) <= 50;
                PD.setTile(room, spot.x, spot.y, usePoison ? "~" : "^");
            }
        }
    }

    function generateFloor(run, rng) {
        const shortSite = Number(run.siteRoomCount) > 0;
        const extra = run.floor >= 7 ? 2 : 1;
        const roomCount = shortSite
            ? PD.clamp(run.siteRoomCount, 2, 8)
            : PD.clamp(5 + rng.int(0, 3), 5, 8);
        const branchCount = shortSite ? 0 : Math.min(extra, roomCount - 2);
        const backbone = roomCount - branchCount;

        const rooms = [];
        for (let i = 0; i < roomCount; i += 1) {
            rooms.push({
                id: i,
                kind: "hall",
                tiles: PD.blankTiles(),
                doors: {},
                enemies: [],
                chest: null,
                choice: null,
                theme: (PD.FLOOR_THEMES[run.floor] && PD.FLOOR_THEMES[run.floor].name) || "DARK STONE"
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

        const siteLimit = run.maxSiteFloor || PD.MAX_FLOOR;
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
                boss: room.kind === "stairs" && run.floor === PD.MAX_FLOOR && siteLimit === PD.MAX_FLOOR,
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


    PD.punchDoors = punchDoors;
    PD.interiorSpots = interiorSpots;
    PD.isReserved = isReserved;
    PD.connectRooms = connectRooms;
    PD.makeEnemy = makeEnemy;
    PD.enemyXp = enemyXp;
    PD.enemyName = enemyName;
    PD.killEnemy = killEnemy;
    PD.pickLoot = pickLoot;
    PD.pickEnemyType = pickEnemyType;
    PD.populateRoom = populateRoom;
    PD.generateFloor = generateFloor;
})(typeof window !== "undefined" ? window : global);