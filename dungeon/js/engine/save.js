(function (global) {
    /* Persistence: snapshot encode/decode, validation, migration, and memorial records. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

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
            gear: run.gear ? PD.normalizeGear(run.gear) : null,
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
        if (!Array.isArray(raw.tiles) || raw.tiles.length !== PD.MAP_SIZE) {
            return null;
        }
        const tiles = [];
        for (let y = 0; y < PD.MAP_SIZE; y += 1) {
            if (typeof raw.tiles[y] !== "string" || raw.tiles[y].length !== PD.MAP_SIZE) {
                return null;
            }
            tiles.push(raw.tiles[y]);
        }
        const doors = {};
        if (raw.doors && typeof raw.doors === "object") {
            PD.FACINGS.forEach(function (d) {
                if (typeof raw.doors[d] === "number" && Number.isFinite(raw.doors[d])) {
                    doors[d] = Math.round(raw.doors[d]);
                }
            });
        }
        const enemies = [];
        if (Array.isArray(raw.enemies)) {
            raw.enemies.forEach(function (e) {
                if (!e || !PD.ENEMY_DEFS[e.type]) {
                    return;
                }
                const x = PD.clamp(Math.round(Number(e.x)), 0, PD.MAP_SIZE - 1);
                const y = PD.clamp(Math.round(Number(e.y)), 0, PD.MAP_SIZE - 1);
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
                    atk: Math.max(0, Math.round(Number(e.atk)) || PD.ENEMY_DEFS[e.type].atk),
                    def: Math.max(0, Math.round(Number(e.def)) || 0),
                    gold: Math.max(0, Math.round(Number(e.gold)) || PD.ENEMY_DEFS[e.type].gold || 0),
                    ai: PD.ENEMY_DEFS[e.type].ai || "slow",
                    heavyCooldown: Math.max(0, Math.round(Number(e.heavyCooldown) || 0)),
                    heavyTelegraph: !!e.heavyTelegraph,
                    heavyTargetX: PD.optionalCoordinate(e.heavyTargetX),
                    heavyTargetY: PD.optionalCoordinate(e.heavyTargetY),
                    windup: Math.max(0, Math.min(1, Math.round(Number(e.windup) || 0))),
                    huntTargetX: PD.optionalCoordinate(e.huntTargetX),
                    huntTargetY: PD.optionalCoordinate(e.huntTargetY),
                    castWindup: Math.max(0, Math.min(1, Math.round(Number(e.castWindup) || 0))),
                    castTargetX: PD.optionalCoordinate(e.castTargetX),
                    castTargetY: PD.optionalCoordinate(e.castTargetY),
                    rewarded: !!e.rewarded,
                    reinforced: !!e.reinforced
                });
            });
        }
        let chest = null;
        if (raw.chest && typeof raw.chest === "object") {
            const item = raw.chest.item;
            if (item === "coin" || PD.ITEM_IDS.indexOf(item) !== -1) {
                chest = {
                    x: PD.clamp(Math.round(Number(raw.chest.x)), 0, PD.MAP_SIZE - 1),
                    y: PD.clamp(Math.round(Number(raw.chest.y)), 0, PD.MAP_SIZE - 1),
                    item: item,
                    open: !!raw.chest.open
                };
            }
        }
        const kind = raw.kind === "start" || raw.kind === "stairs" || raw.kind === "branch" || raw.kind === "sanctum" ? raw.kind : "hall";
        return {
            id: typeof raw.id === "number" ? raw.id : index,
            kind: kind,
            tiles: tiles,
            doors: doors,
            enemies: PD.repairEnemyPlacements(tiles, enemies),
            chest: chest,
            sanctumUsed: !!raw.sanctumUsed,
            reward: raw.reward && typeof raw.reward === "object" ? { active: !!raw.reward.active, boss: typeof raw.reward.boss === "string" ? raw.reward.boss : "", choice: typeof raw.reward.choice === "string" ? raw.reward.choice : null, preview: typeof raw.reward.preview === "string" ? raw.reward.preview : null, options: Array.isArray(raw.reward.options) ? raw.reward.options.filter(function (id) { return id === "gold" || id === "heal" || id === "renown"; }) : null, boon: typeof raw.reward.boon === "string" ? raw.reward.boon : null } : null,
            choice: raw.choice && typeof raw.choice === "object" ? { active: !!raw.choice.active, safe: !!raw.choice.safe, route: raw.choice.route === "safe" || raw.choice.route === "risk" ? raw.choice.route : null, safeTile: { x: 2, y: 3 }, riskTile: { x: 4, y: 3 } } : null,
            theme: typeof raw.theme === "string" ? raw.theme.slice(0, 32) : "DARK STONE",
            hazard: raw.hazard === "reinforced" || raw.hazard === "blood" ? raw.hazard : null
        };
    }

    function validateRun(raw) {
        if (!raw || typeof raw !== "object") {
            return null;
        }
        if (!PD.CLASSES[raw.classId]) {
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
        const roomId = PD.clamp(Math.round(Number(raw.roomId) || 0), 0, rooms.length - 1);
        const facing = PD.FACINGS.indexOf(raw.facing) !== -1 ? raw.facing : "S";
        let heroX = PD.clamp(Math.round(Number(raw.x) || 3), 0, PD.MAP_SIZE - 1);
        let heroY = PD.clamp(Math.round(Number(raw.y) || 3), 0, PD.MAP_SIZE - 1);
        const heroRoom = rooms[roomId];
        if (heroRoom && !PD.tileIsWalkable(heroRoom.tiles, heroX, heroY)) {
            heroX = 3;
            heroY = 3;
            if (!PD.tileIsWalkable(heroRoom.tiles, heroX, heroY)) {
                for (let sy = 1; sy < PD.MAP_SIZE - 1; sy += 1) {
                    let placed = false;
                    for (let sx = 1; sx < PD.MAP_SIZE - 1; sx += 1) {
                        if (PD.tileIsWalkable(heroRoom.tiles, sx, sy)) {
                            heroX = sx;
                            heroY = sy;
                            placed = true;
                            break;
                        }
                    }
                    if (placed) {
                        break;
                    }
                }
            }
        }
        const pack = Array.isArray(raw.pack)
            ? raw.pack.filter(function (id) {
                return PD.ITEM_IDS.indexOf(id) !== -1;
            }).slice(0, PD.PACK_MAX)
            : [];
        return {
            seed: (Number(raw.seed) || 0) >>> 0,
            classId: raw.classId,
            floor: PD.clamp(Math.round(Number(raw.floor) || 1), 1, PD.MAX_FLOOR),
            gold: Math.max(0, Math.round(Number(raw.gold) || 0)),
            hp: Math.max(0, Math.round(Number(raw.hp) || 0)),
            maxHp: Math.max(1, Math.round(Number(raw.maxHp) || PD.CLASSES[raw.classId].hp)),
            atk: Math.max(0, Math.round(Number(raw.atk) || 0)),
            def: Math.max(0, Math.round(Number(raw.def) || 0)),
            pack: pack,
            level: PD.clamp(Math.round(Number(raw.level) || 1), 1, PD.LEVEL_CAP),
            xp: Math.max(0, Math.round(Number(raw.xp) || 0)),
            xpEarned: Math.max(0, Math.round(Number(raw.xpEarned) || 0)),
            gear: PD.normalizeGear(raw.gear),
            gearAtk: Math.max(0, Math.round(Number(raw.gearAtk) || 0)),
            gearDef: Math.max(0, Math.round(Number(raw.gearDef) || 0)),
            gearHp: Math.max(0, Math.round(Number(raw.gearHp) || 0)),
            contract: Math.max(0, Math.round(Number(raw.contract) || 0)),
            facing: facing,
            x: heroX,
            y: heroY,
            roomId: roomId,
            rooms: rooms,
            rngState: (Number(raw.rngState) || 0) >>> 0,
            guardTurns: raw.guardTurns > 0 ? 1 : 0,
            kills: Math.max(0, Math.round(Number(raw.kills) || 0)),
            slainTypes: raw.slainTypes && typeof raw.slainTypes === "object"
                ? Object.keys(raw.slainTypes).filter(function (type) { return PD.ENEMY_DEFS[type]; }).reduce(function (acc, type) { acc[type] = Math.max(1, Math.round(Number(raw.slainTypes[type]) || 0)); return acc; }, {})
                : {},
            poisonTurns: Math.max(0, Math.min(3, Math.round(Number(raw.poisonTurns) || 0))),
            firstStrikeUsed: !!raw.firstStrikeUsed,
            phaseStep: Math.max(0, Math.min(1, Math.round(Number(raw.phaseStep) || 0))),
            lastStand: Math.max(0, Math.min(1, Math.round(Number(raw.lastStand) || 0))),
            renown: Math.max(0, Math.round(Number(raw.renown) || 0)),
            roomChoice: raw.roomChoice && typeof raw.roomChoice === "object" ? { active: !!raw.roomChoice.active, safe: !!raw.roomChoice.safe } : null,
            siteId: typeof raw.siteId === "string" ? raw.siteId : null,
            maxSiteFloor: Number(raw.maxSiteFloor) > 0 ? Math.min(PD.MAX_FLOOR, Math.round(Number(raw.maxSiteFloor))) : null,
            siteRoomCount: Number(raw.siteRoomCount) > 0 ? Math.round(Number(raw.siteRoomCount)) : null,
            enemyPool: Array.isArray(raw.enemyPool) ? raw.enemyPool.filter(function (id) { return PD.ENEMY_DEFS[id]; }) : null,
            namedLast: !!raw.namedLast,
            siteClearedReplay: !!raw.siteClearedReplay
        };
    }

    function createHero(classId, meta) {
        const cls = PD.CLASSES[classId] || PD.CLASSES.knight;
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
            gear: PD.emptyGear(),
            lastInn: "ashford"
        };
    }

    function normalizeHero(hero) {
        if (!hero) {
            return null;
        }
        const cls = PD.CLASSES[hero.classId] || PD.CLASSES.knight;
        hero.classId = cls.id;
        hero.maxHp = Math.max(1, Math.round(Number(hero.maxHp) || cls.hp));
        hero.hp = PD.clamp(Math.round(Number(hero.hp) || hero.maxHp), 0, hero.maxHp);
        hero.atk = Math.max(0, Math.round(Number(hero.atk) || 0));
        hero.def = Math.max(0, Math.round(Number(hero.def) || 0));
        hero.gold = Math.max(0, Math.round(Number(hero.gold) || 0));
        hero.pack = Array.isArray(hero.pack) ? hero.pack.filter(function (id) { return PD.ITEM_IDS.indexOf(id) !== -1; }).slice(0, PD.PACK_MAX) : [];
        hero.level = PD.clamp(Math.round(Number(hero.level) || 1), 1, PD.LEVEL_CAP);
        hero.xp = Math.max(0, Math.round(Number(hero.xp) || 0));
        hero.gear = PD.normalizeGear(hero.gear);
        PD.grantXpToHero(hero, 0);
        hero.hp = Math.min(hero.hp, hero.maxHp);
        return hero;
    }

    function createEmptySave() {
        return {
            v: PD.SNAPSHOT_VERSION,
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
            if (raw.hero && typeof raw.hero === "object" && PD.CLASSES[raw.hero.classId]) {
                const base = createHero(raw.hero.classId, raw.meta);
                save.hero = {
                    classId: base.classId,
                    hp: PD.clamp(Math.round(Number(raw.hero.hp) || base.hp), 0, Math.max(1, Math.round(Number(raw.hero.maxHp) || base.maxHp))),
                    maxHp: Math.max(1, Math.round(Number(raw.hero.maxHp) || base.maxHp)),
                    atk: Math.max(0, Math.round(Number(raw.hero.atk) || base.atk)),
                    def: Math.max(0, Math.round(Number(raw.hero.def) || base.def)),
                    gold: Math.max(0, Math.round(Number(raw.hero.gold) || 0)),
                    pack: Array.isArray(raw.hero.pack) ? raw.hero.pack.filter(function (id) { return PD.ITEM_IDS.indexOf(id) !== -1; }).slice(0, PD.PACK_MAX) : [],
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
                if (typeof raw.meta.bestFloor === "number") save.meta.bestFloor = PD.clamp(Math.round(raw.meta.bestFloor), 0, PD.MAX_FLOOR);
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
            v: PD.SNAPSHOT_VERSION,
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
        const floor = PD.clamp(run.floor, 1, PD.MAX_FLOOR);
        save.hero = save.hero || createHero(run.classId, save.meta);
        PD.syncHeroFromRun(save.hero, run);
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
        save.meta.journal.unshift(String(line || PD.cannedDeathLine(run)).slice(0, 120));
        save.meta.journal = save.meta.journal.slice(0, 32);
        save.meta.bestFloor = Math.max(save.meta.bestFloor || 0, floor);
        const renownGain = Math.floor((run.kills || 0) * 0.5) + floor;
        save.meta.renown = Math.max(0, (save.meta.renown || 0) + renownGain);
        save.meta.epitaphs = save.meta.epitaphs || [];
        save.meta.epitaphs.unshift({ floor: floor, classId: run.classId, level: run.level || 1, kills: run.kills || 0, gold: run.gold || 0, renown: renownGain, line: String(line || PD.cannedDeathLine(run)).slice(0, 80) });
        save.meta.epitaphs = save.meta.epitaphs.slice(0, 8);
        save.site = null;
        save.run = null;
        save.location = { kind: "town", id: save.hero.lastInn };
    }

    function recordWin(save) {
        save.meta = save.meta || { deaths: 0, journal: [], bestFloor: 0, epitaphs: [] };
        save.meta.bestFloor = PD.MAX_FLOOR;
        if (global.PocketDungeonWorld && global.PocketDungeonWorld.completeSite) {
            global.PocketDungeonWorld.completeSite(save, "hold");
            return;
        }
        const run = save.site || save.run;
        if (run) {
            save.hero = save.hero || createHero(run.classId, save.meta);
            PD.syncHeroFromRun(save.hero, run);
            save.hero.lastInn = "keepgate";
        }
        save.site = null;
        save.run = null;
        save.location = { kind: "town", id: "keepgate" };
        save.flags = Object.assign({}, save.flags || {}, { keepgate_hold_clear: 1 });
    }

    global.PocketDungeon = global.PocketDungeon || {};
    global.PocketDungeon.CLASSES = PD.CLASSES;
    global.PocketDungeon.CLASS_ORDER = PD.CLASS_ORDER;
    global.PocketDungeon.ITEM_INFO = PD.ITEM_INFO;
    global.PocketDungeon.ENEMY_DEFS = PD.ENEMY_DEFS;
    global.PocketDungeon.PACK_MAX = PD.PACK_MAX;
    global.PocketDungeon.MAX_FLOOR = PD.MAX_FLOOR;
    global.PocketDungeon.newSeed = PD.newSeed;
    global.PocketDungeon.createRng = PD.createRng;
    global.PocketDungeon.makeEnemy = PD.makeEnemy;
    global.PocketDungeon.LEVEL_CAP = PD.LEVEL_CAP;
    global.PocketDungeon.xpForNext = PD.xpForNext;
    global.PocketDungeon.levelGains = PD.levelGains;
    global.PocketDungeon.grantXp = PD.grantXp;
    global.PocketDungeon.grantXpToHero = PD.grantXpToHero;
    global.PocketDungeon.GEAR_SLOTS = PD.GEAR_SLOTS;
    global.PocketDungeon.GEAR_DEFS = PD.GEAR_DEFS;
    global.PocketDungeon.gearBonus = PD.gearBonus;
    global.PocketDungeon.normalizeGear = PD.normalizeGear;
    global.PocketDungeon.enemyXp = PD.enemyXp;
    global.PocketDungeon.killEnemy = PD.killEnemy;
    global.PocketDungeon.stripRunGear = PD.stripRunGear;
    global.PocketDungeon.syncHeroFromRun = PD.syncHeroFromRun;
    global.PocketDungeon.generateFloor = PD.generateFloor;
    global.PocketDungeon.createRun = PD.createRun;
    global.PocketDungeon.createHero = createHero;
    global.PocketDungeon.createSiteRun = PD.createSiteRun;
    global.PocketDungeon.cycleFacing = PD.cycleFacing;
    global.PocketDungeon.faceTile = PD.faceTile;
    global.PocketDungeon.pathTo = PD.pathTo;
    global.PocketDungeon.tryAct = PD.tryAct;
    global.PocketDungeon.waitTurn = PD.waitTurn;
    global.PocketDungeon.chooseRoomRoute = PD.chooseRoomRoute;
    global.PocketDungeon.claimReward = PD.claimReward;
    global.PocketDungeon.hasCharm = PD.hasCharm;
    global.PocketDungeon.useAbility = PD.useAbility;
    global.PocketDungeon.useItem = PD.useItem;
    global.PocketDungeon.useItemOnHero = PD.useItemOnHero;
    global.PocketDungeon.cannedRoomLine = PD.cannedRoomLine;
    global.PocketDungeon.cannedDeathLine = PD.cannedDeathLine;
    global.PocketDungeon.cannedWinLine = PD.cannedWinLine;
    global.PocketDungeon.getDrawState = PD.getDrawState;
    global.PocketDungeon.facingName = PD.facingName;
    global.PocketDungeon.createEmptySave = createEmptySave;
    global.PocketDungeon.applySnapshot = applySnapshot;
    global.PocketDungeon.snapshot = snapshot;
    global.PocketDungeon.recordDeath = recordDeath;
    global.PocketDungeon.recordWin = recordWin;
    global.PocketDungeon.currentRoom = PD.currentRoom;

    PD.cloneJson = cloneJson;
    PD.snapshotRun = snapshotRun;
    PD.validateRoom = validateRoom;
    PD.validateRun = validateRun;
    PD.createHero = createHero;
    PD.normalizeHero = normalizeHero;
    PD.createEmptySave = createEmptySave;
    PD.migrateV1 = migrateV1;
    PD.applySnapshot = applySnapshot;
    PD.snapshot = snapshot;
    PD.recordDeath = recordDeath;
    PD.recordWin = recordWin;
})(typeof window !== "undefined" ? window : global);
