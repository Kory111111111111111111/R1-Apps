(function (global) {
    /* Procedural generation: room layout, doors, enemy population, floor assembly. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    function tileIsWalkable(tiles, x, y) {
        const ch = (tiles[y] || "")[x];
        return ch === "." || ch === "^" || ch === "~" || ch === "S" || ch === "R" || ch === ">" || ch === "!";
    }

    function repairEnemyPlacements(tiles, enemies) {
        const occupied = {};
        enemies.forEach(function (enemy) {
            const key = enemy.x + "," + enemy.y;
            if (!tileIsWalkable(tiles, enemy.x, enemy.y) || occupied[key]) {
                let moved = false;
                for (let y = 1; y < PD.MAP_SIZE - 1 && !moved; y += 1) {
                    for (let x = 1; x < PD.MAP_SIZE - 1 && !moved; x += 1) {
                        if (tileIsWalkable(tiles, x, y) && !occupied[x + "," + y]) {
                            enemy.x = x;
                            enemy.y = y;
                            moved = true;
                        }
                    }
                }
                if (!moved) {
                    enemy.hp = 0;
                }
            }
            if (enemy.hp > 0) {
                occupied[enemy.x + "," + enemy.y] = true;
            }
        });
        return enemies.filter(function (enemy) {
            return enemy.hp > 0;
        });
    }

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
        if (!def) {
            throw new Error("Unknown enemy: " + type);
        }
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
            heavyTelegraph: false,
            heavyTargetX: null,
            heavyTargetY: null,
            huntTargetX: null,
            huntTargetY: null,
            castWindup: 0,
            castTargetX: null,
            castTargetY: null,
            rewarded: false,
            reinforced: false
        };
    }

    function reinforceEnemy(room, enemy) {
        if (!room || !enemy || room.hazard !== "reinforced" || enemy.reinforced) {
            return;
        }
        enemy.hp += 2;
        enemy.maxHp += 2;
        enemy.reinforced = true;
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

        if (opts.sanctum) {
            room.kind = "sanctum";
            room.sanctumUsed = false;
            PD.setTile(room, 3, 3, "!");
            reserved.push({ x: 3, y: 3 });
            return;
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
        }
        if (opts.hazard === "blood") {
            room.hazard = "blood";
        }
        const reinforceEnemies = function () {
            if (room.hazard !== "reinforced") {
                return;
            }
            room.enemies.forEach(function (enemy) {
                reinforceEnemy(room, enemy);
            });
        };

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
            reinforceEnemies();
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
        reinforceEnemies();

        if (rng.int(1, 100) <= 35) {
            const spot = takeSpot();
            if (spot) {
                room.chest = { x: spot.x, y: spot.y, item: PD.pickLoot(rng), open: false };
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
            ? PD.clamp(run.siteRoomCount, 2, PD.MAX_ROOMS)
            : PD.clamp(5 + rng.int(0, 3), 5, PD.MAX_ROOMS);
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
                sanctumUsed: false,
                theme: (PD.FLOOR_THEMES[run.floor] && PD.FLOOR_THEMES[run.floor].name) || "DARK STONE"
            });
        }

        for (let i = 0; i < backbone - 1; i += 1) {
            if (!connectRooms(rooms, i, i + 1, rng)) {
                for (let retry = 0; retry < backbone && !connectRooms(rooms, i, i + 1, rng); retry += 1) {
                    // The retry loop is intentionally deterministic after the seeded attempt.
                }
            }
        }

        let nextId = backbone;
        for (let b = 0; b < branchCount; b += 1) {
            const preferred = rng.int(0, Math.max(0, backbone - 2));
            let attached = connectRooms(rooms, preferred, nextId, rng);
            for (let candidate = 0; !attached && candidate < backbone; candidate += 1) {
                attached = connectRooms(rooms, candidate, nextId, rng);
            }
            if (!attached) {
                console.warn("branch connect failed", nextId);
            }
            rooms[nextId].kind = "branch";
            nextId += 1;
        }

        rooms[0].kind = "start";
        rooms[backbone - 1].kind = "stairs";

        const siteLimit = run.maxSiteFloor || PD.MAX_FLOOR;
        const isHoldSite = !run.siteId || run.siteId === "hold";
        const midBoss = isHoldSite && run.floor === 4;
        if (isHoldSite && (run.floor === 3 || run.floor === 6) && run.floor < siteLimit) {
            const sanctumRoom = rooms.find(function (room) {
                return room.kind === "branch";
            }) || rooms.find(function (room) {
                return room.kind === "hall";
            });
            if (sanctumRoom) {
                sanctumRoom.kind = "sanctum";
            }
        }
        rooms.forEach(function (room) {
            var pool = run.enemyPool;
            if (!pool && isHoldSite) {
                if (run.floor <= 2) {
                    pool = ["slime", "rat", "bat"];
                } else if (run.floor <= 4) {
                    pool = ["slime", "bat", "skeleton", "ghoul"];
                } else {
                    pool = ["bat", "skeleton", "ghoul", "acolyte"];
                }
            }
            populateRoom(room, run.floor, rng, {
                start: room.kind === "start",
                stairs: room.kind === "stairs",
                sanctum: room.kind === "sanctum",
                boss: room.kind === "stairs" && run.floor === PD.MAX_FLOOR && siteLimit === PD.MAX_FLOOR,
                midBoss: room.kind === "stairs" && midBoss,
                named: room.kind === "stairs" && !!run.namedLast && run.floor === siteLimit,
                cleared: !!run.siteClearedReplay && !(run.contract > 0),
                tier: run.contract || 0,
                enemyPool: pool,
                choice: room.kind === "branch" && run.floor < siteLimit && !run.siteRoomCount,
                hazard: run.floor >= 5 && room.kind !== "start" && room.kind !== "stairs" && room.kind !== "sanctum"
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


    PD.tileIsWalkable = tileIsWalkable;
    PD.repairEnemyPlacements = repairEnemyPlacements;
    PD.punchDoors = punchDoors;
    PD.interiorSpots = interiorSpots;
    PD.isReserved = isReserved;
    PD.connectRooms = connectRooms;
    PD.makeEnemy = makeEnemy;
    PD.reinforceEnemy = reinforceEnemy;
    PD.enemyXp = enemyXp;
    PD.enemyName = enemyName;
    PD.pickEnemyType = pickEnemyType;
    PD.populateRoom = populateRoom;
    PD.generateFloor = generateFloor;
})(typeof window !== "undefined" ? window : global);
