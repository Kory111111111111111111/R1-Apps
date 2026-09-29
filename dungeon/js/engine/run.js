(function (global) {
    /* Run construction: builds a dungeon or site run from a hero. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    function createSiteRun(hero, siteId, seed, flags, contract) {
        if (!hero || !PD.CLASSES[hero.classId]) {
            throw new Error("Unknown hero for site: " + (hero && hero.classId));
        }
        const world = global.PocketDungeonWorld;
        const site = world && world.sites && world.sites[siteId];
        const useSeed = (seed == null ? PD.newSeed() : seed) >>> 0;
        const rng = PD.createRng(useSeed);
        const gear = PD.gearBonus(hero.gear);
        const maxHp = Math.max(1, (hero.maxHp || PD.CLASSES[hero.classId].hp) + gear.hp);
        const run = {
            seed: useSeed,
            classId: hero.classId,
            floor: 1,
            gold: Math.max(0, hero.gold || 0),
            hp: PD.clamp(Math.max(0, hero.hp || 0), 0, maxHp),
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
            gear: PD.normalizeGear(hero.gear),
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
            maxSiteFloor: site && site.floors ? site.floors : PD.MAX_FLOOR,
            siteRoomCount: site && site.rooms ? site.rooms : null,
            enemyPool: site && site.enemies ? site.enemies.slice() : null,
            namedLast: !!(site && site.namedLast),
            siteClearedReplay: !!(site && flags && flags[site.clear])
        };
        PD.generateFloor(run, rng);
        PD.commitRng(run, rng);
        return run;
    }

    function createRun(classId, seed) {
        const cls = PD.CLASSES[classId];
        if (!cls) {
            throw new Error("Unknown class: " + classId);
        }
        const useSeed = (seed == null ? PD.newSeed() : seed) >>> 0;
        const rng = PD.createRng(useSeed);
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
            gear: PD.emptyGear(),
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
        PD.generateFloor(run, rng);
        PD.commitRng(run, rng);
        return run;
    }


    PD.createSiteRun = createSiteRun;
    PD.createRun = createRun;
})(typeof window !== "undefined" ? window : global);