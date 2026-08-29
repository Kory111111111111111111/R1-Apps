(function (global) {
    const SRC = 16;
    const SCALE = 2;
    const TILE_PX = SRC * SCALE;
    const MAP_SIZE = 7;

    const PALETTES = {
        dungeon: {
            O: "#1a1612",
            C: "#5a5248",
            S: "#3a342e",
            H: "#8a8074",
            W: "#d8d0c4",
            B: "#0a0908",
            P: "#6b5a3e",
            R: "#8a3028",
            K: "#d4a017",
            Y: "#e8d48a"
        },
        knight: {
            O: "#1a1208",
            C: "#c4c4c8",
            S: "#6a6a72",
            H: "#e8e8ec",
            W: "#ffffff",
            B: "#141414",
            P: "#d4a017",
            R: "#a33333",
            K: "#d4a017",
            Y: "#f5d76e"
        },
        scout: {
            O: "#0e1a10",
            C: "#3d7a4a",
            S: "#245230",
            H: "#8fc49a",
            W: "#ffffff",
            B: "#141414",
            P: "#c4a574",
            R: "#a33333",
            K: "#d4a017",
            Y: "#e8d48a"
        },
        mage: {
            O: "#140a22",
            C: "#5b3d8a",
            S: "#3a2560",
            H: "#b49ae0",
            W: "#ffffff",
            B: "#141414",
            P: "#6ec4e8",
            R: "#a33333",
            K: "#d4a017",
            Y: "#c084fc"
        },
        beast: {
            O: "#0c140c",
            C: "#3d8a3a",
            S: "#245024",
            H: "#8ed48a",
            W: "#d4e87a",
            B: "#141414",
            P: "#d4e87a",
            R: "#1a3018",
            K: "#d4a017",
            Y: "#c8f090"
        },
        undead: {
            O: "#1a1612",
            C: "#d0c8b8",
            S: "#8a8070",
            H: "#f4eee4",
            W: "#ffffff",
            B: "#141414",
            P: "#5a1a1a",
            R: "#8a2020",
            K: "#d4a017",
            Y: "#e8d48a"
        },
        boss: {
            O: "#140606",
            C: "#8a2020",
            S: "#4a1010",
            H: "#c44040",
            W: "#f0d0c8",
            B: "#0a0404",
            P: "#d4a017",
            R: "#3a0808",
            K: "#f0c040",
            Y: "#f5d76e"
        }
    };

    const TILES = {
        floor: [
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSCHSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSHSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSCSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSHSSSSSSSSSSSS",
            "SSSSSSSSSSSSCSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSHSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS"
        ],
        wall: [
            "OOOOOOOOOOOOOOOO",
            "OCCSSCCSSCCSSCOO",
            "OCCSSCCSSCCSSCOO",
            "OSSSSSSSSSSSSSSO",
            "OSSCCSSCCSSCCSSO",
            "OSSCCSSCCSSCCSSO",
            "OSSSSSSSSSSSSSSO",
            "OCCSSCCSSCCSSCOO",
            "OCCSSCCSSCCSSCOO",
            "OSSSSSSSSSSSSSSO",
            "OSSCCSSCCSSCCSSO",
            "OSSCCSSCCSSCCSSO",
            "OSSSSSSSSSSSSSSO",
            "OCCSSCCSSCCSSCOO",
            "OCCSSCCSSCCSSCOO",
            "OOOOOOOOOOOOOOOO"
        ],
        door: [
            "OOOOOOOOOOOOOOOO",
            "OSSSSSSSSSSSSSSO",
            "OSBBBBBBBBBBBBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBHHHBBBBHHHBSO",
            "OSBHHHBSSBHHHBSO",
            "OSBHHHBKKBHHHBSO",
            "OSBHHHBSSBHHHBSO",
            "OSBHHHBBBBHHHBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBHHHHHHHHHHBSO",
            "OSBBBBBBBBBBBBSO",
            "OOOOOOOOOOOOOOOO"
        ],
        stairs: [
            "SSSSSSSSSSSSSSSS",
            "SSSOOOOOOOOOOSSS",
            "SSOCCCCCCCCCCOSS",
            "SOCCCCCCCCCCCCOS",
            "SOOCCCCCCCCCCOOS",
            "SOCCCCCCCCCCCCOS",
            "SOOCCCCCCCCCCOOS",
            "SOCCCCCCCCCCCCOS",
            "SOOCCCCCCCCCCOOS",
            "SOCCCCCCCCCCCCOS",
            "SOOCCCCCCCCCCOOS",
            "SOCCCCCCCCCCCCOS",
            "SOOKKKKKKKKKKOOS",
            "SOOOOOOOOOOOOOOS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS"
        ],
        chest: [
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSOOOOOOOOOOSSS",
            "SSOCCCCCCCCCCOSS",
            "SOCCCCCCCCCCCCOS",
            "SOCCCCCCCCCCCCOS",
            "SOOOOOOOOOOOOOOS",
            "SOPPPPPKKPPPPPPS",
            "SOPPPPPKKPPPPPPS",
            "SOCCCCCCCCCCCCOS",
            "SOCCCCCCCCCCCCOS",
            "SOCCCCCKKCCCCCOS",
            "SOCCCCCCCCCCCCOS",
            "SOOOOOOOOOOOOOOS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS"
        ],
        trap: [
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSRSSSRSSSRSSSS",
            "SSRWRSSRWRSSRWSS",
            "SSRRRSSRRRSSRRSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSRSSSRSSSSSS",
            "SSSSRWRSRWRSSSSS",
            "SSSSRRRSSRRSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSRSSSRSSSRSSSSS",
            "SRWRSSRWRSSRWSSS",
            "SRRRSSRRRSSRRSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS",
            "SSSSSSSSSSSSSSSS"
        ]
    };

    const HERO = [
        [
            "......OOOO......",
            ".....OHHHHO.....",
            "....OHWBWBHO....",
            "....OHBBBBHO....",
            ".....OHRRHO.....",
            "......OOOO......",
            "....OOCCCCCOO...",
            "...OCCCCHCCCCO..",
            "...OCCCCPCCCCO..",
            "....OCCCKCCCO...",
            "....OOCCCCCOO...",
            ".....OCPPCO.....",
            ".....OCSSCO.....",
            ".....OC..CO.....",
            "....OOS..SOO....",
            "....OO....OO...."
        ],
        [
            "......OOOO......",
            ".....OHHHHO.....",
            "....OHWBWBHO....",
            "....OHBBBBHO....",
            ".....OHRRHO.....",
            "......OOOO......",
            "....OOCCCCCOO...",
            "...OCCCCHCCCCO..",
            "...OCCCCPCCCCO..",
            "....OCCCKCCCO...",
            "....OOCCCCCOO...",
            ".....OCPPCO.....",
            ".....OCSSCO.....",
            "....OOC..CO.....",
            "...OO.S..SOO....",
            "...OO......OO..."
        ]
    ];

    const ENEMIES = {
        slime: [
            [
                "................",
                "................",
                "................",
                "......OOOO......",
                "....OOHHHHOO....",
                "...OHHHHHHHHO...",
                "..OHHHWBWBHHHO..",
                "..OHHHBBBBHHHO..",
                "..OHHHHHHHHHHO..",
                "..OHHHHRRHHHHO..",
                "...OHHHHHHHHO...",
                "...OSSHHHHSSO...",
                "....OOOOOOOO....",
                "................",
                "................",
                "................"
            ],
            [
                "................",
                "................",
                "................",
                "................",
                ".....OOOOOO.....",
                "...OOHHHHHHOO...",
                "..OHHHWBWBHHHO..",
                "..OHHHBBBBHHHO..",
                "..OHHHHHHHHHHO..",
                "..OHHHHRRHHHHO..",
                "...OHHHHHHHHO...",
                "..OSSHHHHHHSSO..",
                "...OOOOOOOOOO...",
                "................",
                "................",
                "................"
            ]
        ],
        bat: [
            [
                "................",
                ".OO..........OO.",
                "OHHOO......OOHHO",
                "OHHHOO....OOHHHO",
                ".OHHHHOOOOHHHHO.",
                "..OHHHHHHHHHHO..",
                "...OOWBWBWBOO...",
                "....OBBBBBO.....",
                ".....ORRRO......",
                "......OOO.......",
                ".......P........",
                "................",
                "................",
                "................",
                "................",
                "................"
            ],
            [
                "................",
                "................",
                "OO............OO",
                "OHOO........OOHO",
                "OHHOO......OOHHO",
                ".OHHHOOOOOOHHHO.",
                "..OHHBWBWBHHO...",
                "...OHBBBBBHO....",
                "....OORRROO.....",
                "......OOO.......",
                ".......P........",
                "................",
                "................",
                "................",
                "................",
                "................"
            ]
        ],
        skeleton: [
            [
                "................",
                ".....OOOOO......",
                "....OHHHHHO.....",
                "....OHWBWHO.....",
                "....OHBBBHO.....",
                ".....ORRRO......",
                "......OOO.......",
                "....OCCCCCO.....",
                "...OC.CCC.CO....",
                "...OC.CCC.CO....",
                "....OCCCCCO.....",
                ".....OC.CO......",
                ".....OC.CO......",
                "....OOS.SOO.....",
                "....OO...OO.....",
                "................"
            ],
            [
                "................",
                ".....OOOOO......",
                "....OHHHHHO.....",
                "....OHWBWHO.....",
                "....OHBBBHO.....",
                ".....ORRRO......",
                "......OOO.......",
                "....OCCCCCO.....",
                "...OC.CCC.CO....",
                "....OCCCCCO.....",
                ".....OC.CO......",
                ".....OC.CO......",
                "....OOC.COO.....",
                "...OO.S.S.OO....",
                "...OO.....OO....",
                "................"
            ]
        ],
        ogre: [
            [
                "..OKKO....OKKO..",
                ".OKPPCO..OCPPKO.",
                "OKPPPCOOOOCPPPKO",
                ".OOOOOOOOOOOOOO.",
                "..OCHHHHHHHHCO..",
                ".OCHHHHHHHHHHCO.",
                "OCHHWBHHHHWBHHCO",
                "OCHHBBHHHHBBHHCO",
                "OCHHHHHHHHHHHHCO",
                "OCHHHSSRRSSHHHCO",
                ".OCHHHHHHHHHHCO.",
                "..OCCCCCCCCCCO..",
                "..OCCSSCCSSCCO..",
                "...OCC....CCO...",
                "...OSS....SSO...",
                "...OOO....OOO..."
            ],
            [
                "..OKKO....OKKO..",
                ".OKPPCO..OCPPKO.",
                "OKPPPCOOOOCPPPKO",
                ".OOOOOOOOOOOOOO.",
                "..OCHHHHHHHHCO..",
                ".OCHHHHHHHHHHCO.",
                "OCHHSSHHHHSSHHCO",
                "OCHHBBHHHHBBHHCO",
                "OCHHHHHHHHHHHHCO",
                "OCHHHSSRRSSHHHCO",
                ".OCHHHHHHHHHHCO.",
                "..OCCCCCCCCCCO..",
                "..OCCSSCCSSCCO..",
                "...OCC....CCO...",
                "....OSS..SSO....",
                "....OOO..OOO...."
            ]
        ]
    };

    const ITEMS = {
        potion: [
            "................",
            "......OOOO......",
            "......OHHO......",
            "......OOOO......",
            ".....OHHHHO.....",
            "....OHRRRRHO....",
            "...OHRRRRRRHO...",
            "...OHRRRRRRHO...",
            "...OHRRRRRRHO...",
            "...OHRRRRRRHO...",
            "....OHRRRRHO....",
            ".....OHHHHO.....",
            "......OOOO......",
            "................",
            "................",
            "................"
        ],
        blade: [
            "................",
            "...........WW...",
            "..........WHHO..",
            ".........WHHHO..",
            "........WHHHO...",
            ".......WHHHO....",
            "......WHHHO.....",
            ".....WHHHO......",
            "....OKKKO.......",
            "...OPPPO........",
            "..OPPPO.........",
            ".OSSSO..........",
            ".OOOO...........",
            "................",
            "................",
            "................"
        ],
        mail: [
            "................",
            "....OO....OO....",
            "...OHHO..OHHO...",
            "....OOOOOOOO....",
            "...OCCCCCCCCO...",
            "..OCCCCCCCCCCO..",
            "..OCCKCCCCKCCO..",
            "..OCCCCCCCCCCO..",
            "..OCCCCCCCCCCO..",
            "..OCCCCCCCCCCO..",
            "...OCCCCCCCCO...",
            "...OCC....CCO...",
            "....OO....OO....",
            "................",
            "................",
            "................"
        ],
        coin: [
            "................",
            "................",
            "......OOOO......",
            "....OOKKKKOO....",
            "...OKYYYYYYKO...",
            "..OKYYKKKKYYKO..",
            "..OKYYKWWKYYKO..",
            "..OKYYKKKKYYKO..",
            "..OKYYKKKKYYKO..",
            "..OKYYYYYYYYKO..",
            "...OKYYYYYYKO...",
            "....OOKKKKOO....",
            "......OOOO......",
            "................",
            "................",
            "................"
        ]
    };

    const ENEMY_PALETTE = {
        slime: "beast",
        bat: "beast",
        skeleton: "undead",
        ogre: "boss"
    };

    const baked = Object.create(null);
    let missingCanvas = null;
    let bakedReady = false;

    function normalizeMatrix(rows) {
        const out = [];
        for (let r = 0; r < SRC; r += 1) {
            let line = typeof rows[r] === "string" ? rows[r] : "";
            line = line.replace(/ /g, ".");
            if (line.length < SRC) {
                line += ".".repeat(SRC - line.length);
            } else if (line.length > SRC) {
                line = line.slice(0, SRC);
            }
            out.push(line);
        }
        return out;
    }

    function rasterize(rows, palette) {
        const matrix = normalizeMatrix(rows);
        const canvas = document.createElement("canvas");
        canvas.width = TILE_PX;
        canvas.height = TILE_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return canvas;
        }
        ctx.imageSmoothingEnabled = false;
        for (let r = 0; r < SRC; r += 1) {
            const line = matrix[r];
            for (let c = 0; c < SRC; c += 1) {
                const ch = line[c];
                if (ch === "." || ch === "-") {
                    continue;
                }
                ctx.fillStyle = palette[ch] || "#ffffff";
                ctx.fillRect(c * SCALE, r * SCALE, SCALE, SCALE);
            }
        }
        return canvas;
    }

    function makeMissing() {
        const canvas = document.createElement("canvas");
        canvas.width = TILE_PX;
        canvas.height = TILE_PX;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#ff00ff";
            ctx.fillRect(0, 0, TILE_PX, TILE_PX);
        }
        return canvas;
    }

    function store(key, canvas) {
        baked[key] = canvas;
    }

    function bakeAll() {
        missingCanvas = makeMissing();
        const dungeonPal = PALETTES.dungeon;
        Object.keys(TILES).forEach(function (id) {
            store("tile:" + id, rasterize(TILES[id], dungeonPal));
        });
        Object.keys(ITEMS).forEach(function (id) {
            store("item:" + id, rasterize(ITEMS[id], dungeonPal));
        });
        ["knight", "scout", "mage"].forEach(function (classId) {
            const pal = PALETTES[classId];
            HERO.forEach(function (frame, i) {
                store("hero:" + classId + ":" + i, rasterize(frame, pal));
            });
        });
        Object.keys(ENEMIES).forEach(function (id) {
            const pal = PALETTES[ENEMY_PALETTE[id]] || dungeonPal;
            ENEMIES[id].forEach(function (frame, i) {
                store("enemy:" + id + ":" + i, rasterize(frame, pal));
            });
        });
        bakedReady = true;
    }

    function getBaked(key) {
        if (!bakedReady) {
            bakeAll();
        }
        return baked[key] || missingCanvas;
    }

    function tileId(ch) {
        if (ch === "#") return "wall";
        if (ch === "+") return "door";
        if (ch === ">") return "stairs";
        if (ch === "$") return "chest";
        if (ch === "^") return "trap";
        return "floor";
    }

    function drawFacing(ctx, tileX, tileY, facing) {
        const x0 = tileX * TILE_PX;
        const y0 = tileY * TILE_PX;
        ctx.fillStyle = "#d4a017";
        if (facing === "N") {
            ctx.fillRect(x0 + 14, y0 + 1, 4, 3);
        } else if (facing === "E") {
            ctx.fillRect(x0 + 28, y0 + 14, 3, 4);
        } else if (facing === "S") {
            ctx.fillRect(x0 + 14, y0 + 28, 4, 3);
        } else {
            ctx.fillRect(x0 + 1, y0 + 14, 3, 4);
        }
    }

    function drawRoom(ctx, state, frame) {
        if (!ctx) {
            return;
        }
        if (!bakedReady) {
            bakeAll();
        }
        const anim = frame ? 1 : 0;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#141210";
        ctx.fillRect(0, 0, TILE_PX * MAP_SIZE, TILE_PX * MAP_SIZE);

        const tiles = state && state.tiles ? state.tiles : [];
        for (let y = 0; y < MAP_SIZE; y += 1) {
            const row = tiles[y] || "";
            for (let x = 0; x < MAP_SIZE; x += 1) {
                const id = tileId(row[x] || "#");
                ctx.drawImage(getBaked("tile:" + id), x * TILE_PX, y * TILE_PX);
            }
        }

        const enemies = (state && state.enemies) || [];
        for (let i = 0; i < enemies.length; i += 1) {
            const enemy = enemies[i];
            if (!enemy || enemy.hp <= 0) {
                continue;
            }
            ctx.drawImage(
                getBaked("enemy:" + enemy.type + ":" + anim),
                enemy.x * TILE_PX,
                enemy.y * TILE_PX
            );
        }

        const hero = state && state.hero;
        if (hero) {
            ctx.drawImage(
                getBaked("hero:" + hero.classId + ":" + anim),
                hero.x * TILE_PX,
                hero.y * TILE_PX
            );
            drawFacing(ctx, hero.x, hero.y, hero.facing);
        }
    }

    global.PocketDungeon = global.PocketDungeon || {};
    global.PocketDungeon.TILE_PX = TILE_PX;
    global.PocketDungeon.MAP_SIZE = MAP_SIZE;
    global.PocketDungeon.PALETTES = PALETTES;
    global.PocketDungeon.bakeAll = bakeAll;
    global.PocketDungeon.drawRoom = drawRoom;
    global.PocketDungeon.getBaked = getBaked;
})(window);
