(function (global) {
    const TRAVEL_ORDER = ["ashford", "saltmere", "keepgate"];

    const towns = {
        ashford: {
            id: "ashford",
            name: "ASHFORD",
            description: "A village beneath a broken mill wheel.",
            npcs: ["elder", "miller"],
            services: ["inn", "shop"]
        },
        saltmere: {
            id: "saltmere",
            name: "SALTMERE",
            description: "Salt wind cuts through the market arches.",
            npcs: ["harbor", "smuggler"],
            services: ["inn", "shop"]
        },
        keepgate: {
            id: "keepgate",
            name: "KEEPGATE",
            description: "The last wall before the ogre road.",
            npcs: ["warden", "priest"],
            services: ["inn"]
        }
    };

    const sites = {
        cellar: {
            id: "cellar",
            name: "MILLER'S CELLAR",
            town: "ashford",
            floors: 1,
            rooms: 3,
            unlock: "ashford_cellar_open",
            clear: "ashford_cellar_clear",
            enemies: ["slime", "bat"]
        },
        crypt: {
            id: "crypt",
            name: "SALT CRYPT",
            town: "saltmere",
            floors: 1,
            rooms: 4,
            unlock: "saltmere_crypt_open",
            clear: "saltmere_crypt_clear",
            enemies: ["skeleton"],
            namedLast: true
        },
        hold: {
            id: "hold",
            name: "OGRE HOLD",
            town: "keepgate",
            floors: 8,
            rooms: null,
            unlock: "keepgate_hold_open",
            clear: "keepgate_hold_clear",
            enemies: null
        }
    };

    const shops = {
        ashford: [
            { id: "potion", name: "POTION", price: 8 },
            { id: "blade", name: "BLADE", price: 18 },
            { id: "mail", name: "MAIL", price: 18 }
        ],
        saltmere: [
            { id: "potion", name: "POTION", price: 8 },
            { id: "blade", name: "BLADE", price: 16 },
            { id: "mail", name: "MAIL", price: 16 }
        ]
    };

    const dialogue = {
        elder: {
            name: "ELDER",
            nodes: [
                {
                    ifAll: ["ashford_cellar_clear"],
                    lines: ["The mill wheel turns again.", "Saltmere will open its gates."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["ashford_cellar_open"],
                    lines: ["The cellar still waits under the mill.", "Come back when it is quiet."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    lines: ["The miller's cellar has gone quiet.", "Find what silenced it, traveler."],
                    choices: [
                        { id: "open_cellar", label: "I'LL GO", set: "ashford_cellar_open" },
                        { id: "ask_pay", label: "PAY ME", set: "ashford_cellar_open", gold: 5, journal: "The elder paid you to look." },
                        { id: "leave", label: "NOT NOW" }
                    ]
                }
            ]
        },
        miller: {
            name: "MILLER",
            nodes: [
                {
                    ifAll: ["ashford_cellar_clear"],
                    lines: ["You gave me my mill back.", "Grain will move again."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["ashford_miller_aid"],
                    lines: ["That vial is yours.", "The steps stay slick."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    lines: ["Something in my cellar drinks the grain.", "Help me and I'll spare a vial."],
                    choices: [
                        { id: "aid", label: "TAKE VIAL", set: "ashford_miller_aid", give: "potion" },
                        { id: "leave", label: "LATER" }
                    ]
                }
            ]
        },
        harbor: {
            name: "HARBOR-MASTER",
            nodes: [
                {
                    ifAll: ["saltmere_crypt_clear"],
                    lines: ["The token sleeps in salt again.", "Keepgate will raise its iron bar."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["saltmere_crypt_open"],
                    lines: ["The crypt still wants its token.", "The quay stairs stay open."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    lines: ["A black token came up in the salt nets.", "The crypt below the quay wants it back."],
                    choices: [
                        { id: "open_crypt", label: "I'LL RETURN IT", set: "saltmere_crypt_open" },
                        { id: "leave", label: "NOT NOW" }
                    ]
                }
            ]
        },
        smuggler: {
            name: "SMUGGLER",
            nodes: [
                {
                    ifAll: ["saltmere_token_kept"],
                    lines: ["Keep the token. Keepgate will know.", "The crypt still opens either way."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["saltmere_crypt_clear"],
                    lines: ["Too late to sell a returned thing."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    lines: ["That black token would buy a quiet berth.", "Return it, or keep it for me."],
                    choices: [
                        { id: "keep", label: "KEEP IT", set: "saltmere_token_kept", alsoSet: "saltmere_crypt_open", journal: "You kept the black token." },
                        { id: "refuse", label: "I RETURN IT", set: "saltmere_crypt_open" },
                        { id: "leave", label: "WALK AWAY" }
                    ]
                }
            ]
        },
        warden: {
            name: "WARDEN",
            nodes: [
                {
                    ifAll: ["keepgate_hold_clear"],
                    lines: ["The ogre falls.", "The broken road becomes a road again."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["keepgate_hold_open", "saltmere_token_kept"],
                    lines: ["You kept a stolen token and still ask the gate.", "The hold is open. End it."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["keepgate_hold_open"],
                    lines: ["The old hold is awake.", "Come back with the ogre's silence."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["saltmere_token_kept"],
                    lines: ["Saltmere sent a thief, not a guest.", "Still: the hold waits. End the road."],
                    choices: [
                        { id: "open_hold", label: "OPEN HOLD", set: "keepgate_hold_open" },
                        { id: "leave", label: "NOT YET" }
                    ]
                },
                {
                    lines: ["The old hold is awake behind the gate.", "End the road where the ogre waits."],
                    choices: [
                        { id: "open_hold", label: "OPEN HOLD", set: "keepgate_hold_open" },
                        { id: "gold", label: "PAY ME FIRST", set: "keepgate_hold_open", gold: 8, journal: "The warden paid you to finish the road." },
                        { id: "leave", label: "NOT YET" }
                    ]
                }
            ]
        },
        priest: {
            name: "PRIEST",
            nodes: [
                {
                    ifAll: ["keepgate_blessed"],
                    lines: ["The blessing holds.", "Do not waste it on pride."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    ifAll: ["keepgate_hold_clear"],
                    lines: ["Light found the stairwell.", "Walk the road as a road."],
                    choices: [{ id: "leave", label: "LEAVE" }]
                },
                {
                    lines: ["I can mark your mail against the hold.", "Or you can go unmarked."],
                    choices: [
                        { id: "bless", label: "TAKE BLESSING", set: "keepgate_blessed", def: 1, journal: "The priest marked your mail." },
                        { id: "leave", label: "UNMARKED" }
                    ]
                }
            ]
        }
    };

    const endings = {
        cellar: "The mill wheel turns. Saltmere opens its gates.",
        crypt: "The black token is returned. Keepgate raises its iron bar.",
        hold: "The ogre falls. The broken road becomes a road again."
    };

    function flag(state, id) {
        return !!(state && state.flags && state.flags[id]);
    }

    function npcName(npcId) {
        return (dialogue[npcId] && dialogue[npcId].name) || String(npcId || "").toUpperCase();
    }

    function getDialogue(npcId, flags) {
        const tree = dialogue[npcId];
        if (!tree || !tree.nodes || !tree.nodes.length) {
            return null;
        }
        const nodes = tree.nodes;
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (!node.ifAll || !node.ifAll.length) {
                continue;
            }
            const ok = node.ifAll.every(function (id) {
                return !!(flags && flags[id]);
            });
            if (ok) {
                return node;
            }
        }
        for (let j = 0; j < nodes.length; j += 1) {
            if (!nodes[j].ifAll) {
                return nodes[j];
            }
        }
        return nodes[nodes.length - 1];
    }

    function applyChoiceToHero(hero, choice) {
        if (!hero || !choice) {
            return;
        }
        if (choice.gold) {
            hero.gold = Math.max(0, (hero.gold || 0) + choice.gold);
        }
        if (choice.def) {
            hero.def = (hero.def || 0) + choice.def;
        }
        if (choice.give) {
            hero.pack = hero.pack || [];
            if (hero.pack.length < 5) {
                hero.pack.push(choice.give);
            }
        }
    }

    function advanceDialogue(state, choiceId) {
        if (!state) {
            return { ok: false, state: state };
        }
        const node = getDialogue(state.dialogueId, state.flags || {});
        const choice = node && node.choices && node.choices.find(function (item) {
            return item.id === choiceId;
        });
        if (!choice) {
            return { ok: false, state: state };
        }
        const nextFlags = Object.assign({}, state.flags || {});
        if (choice.set) {
            nextFlags[choice.set] = 1;
        }
        if (choice.alsoSet) {
            nextFlags[choice.alsoSet] = 1;
        }
        const nextHero = state.hero ? Object.assign({}, state.hero, {
            pack: (state.hero.pack || []).slice()
        }) : state.hero;
        applyChoiceToHero(nextHero, choice);
        const nextMeta = Object.assign({}, state.meta || {}, {
            journal: ((state.meta && state.meta.journal) || []).slice()
        });
        if (choice.journal) {
            nextMeta.journal.unshift(String(choice.journal).slice(0, 120));
            nextMeta.journal = nextMeta.journal.slice(0, 32);
        }
        const next = Object.assign({}, state, {
            dialogueId: null,
            flags: nextFlags,
            hero: nextHero,
            meta: nextMeta
        });
        return { ok: true, state: next, choice: choice, node: node };
    }

    function canTravel(state, from, to) {
        if (from === to && towns[to]) {
            return true;
        }
        const edges = {
            ashford: ["saltmere"],
            saltmere: ["ashford", "keepgate"],
            keepgate: ["saltmere"]
        };
        if (!edges[from] || edges[from].indexOf(to) === -1) {
            return false;
        }
        if (to === "saltmere") {
            return flag(state, "ashford_cellar_clear");
        }
        if (to === "keepgate") {
            return flag(state, "saltmere_crypt_clear");
        }
        return true;
    }

    function travelLabel(state, from, to) {
        const town = towns[to];
        const name = town ? town.name : String(to).toUpperCase();
        if (from === to) {
            return name + " [HERE]";
        }
        if (!canTravel(state, from, to)) {
            return name + " [LOCK]";
        }
        return name;
    }

    function availableSites(state, townId) {
        return Object.keys(sites).filter(function (id) {
            const site = sites[id];
            return site.town === townId && flag(state, site.unlock);
        });
    }

    function townMenu(state) {
        const townId = state && state.location && state.location.id;
        const town = towns[townId] || towns.ashford;
        const options = [{ id: "talk", label: "TALK" }];
        if (town.services.indexOf("inn") !== -1) {
            options.push({ id: "inn", label: "INN" });
        }
        if (town.services.indexOf("shop") !== -1) {
            options.push({ id: "shop", label: "SHOP" });
        }
        options.push({ id: "road", label: "ROAD" });
        options.push({ id: "site", label: "SITE" });
        options.push({ id: "pack", label: "PACK" });
        options.push({ id: "journal", label: "JOURNAL" });
        return options;
    }

    function restAtInn(hero, townId) {
        if (!hero || !towns[townId]) {
            return { ok: false, reason: "NO INN" };
        }
        hero.hp = hero.maxHp;
        hero.lastInn = townId;
        return { ok: true };
    }

    function buy(hero, itemId, townId) {
        if (!hero) {
            return { ok: false, reason: "NO HERO" };
        }
        const stock = shops[townId] || shops[hero.lastInn] || [];
        const item = stock.filter(function (entry) {
            return entry.id === itemId;
        })[0];
        if (!item) {
            return { ok: false, reason: "CLOSED" };
        }
        hero.pack = hero.pack || [];
        if (hero.pack.length >= 5) {
            return { ok: false, reason: "PACK FULL" };
        }
        if (hero.gold < item.price) {
            return { ok: false, reason: "NOT ENOUGH GOLD" };
        }
        hero.gold -= item.price;
        hero.pack.push(item.id);
        return { ok: true, item: item };
    }

    function writeHeroFromRun(hero, run) {
        if (!hero || !run) {
            return;
        }
        hero.hp = run.hp;
        hero.gold = run.gold;
        hero.atk = run.atk;
        hero.def = run.def;
        hero.pack = (run.pack || []).slice();
    }

    function completeSite(state, siteId) {
        const site = sites[siteId];
        if (!site || !state) {
            return { ok: false, state: state };
        }
        const run = state.site || state.run;
        state.hero = state.hero || {};
        writeHeroFromRun(state.hero, run);
        state.hero.lastInn = site.town;
        state.flags = Object.assign({}, state.flags || {});
        state.flags[site.clear] = 1;
        state.location = { kind: "town", id: site.town };
        state.site = null;
        state.run = null;
        state.meta = Object.assign({}, state.meta || {}, {
            journal: ((state.meta && state.meta.journal) || []).slice()
        });
        const line = endings[siteId] || "The road changes.";
        state.meta.journal.unshift(line);
        state.meta.journal = state.meta.journal.slice(0, 32);
        if (siteId === "hold") {
            state.meta.bestFloor = 8;
        }
        return { ok: true, state: state, line: line };
    }

    global.PocketDungeonWorld = {
        towns: towns,
        sites: sites,
        shops: shops,
        dialogue: dialogue,
        endings: endings,
        TRAVEL_ORDER: TRAVEL_ORDER,
        npcName: npcName,
        getDialogue: getDialogue,
        advanceDialogue: advanceDialogue,
        canTravel: canTravel,
        travelLabel: travelLabel,
        availableSites: availableSites,
        townMenu: townMenu,
        restAtInn: restAtInn,
        buy: buy,
        completeSite: completeSite
    };
})(typeof window !== "undefined" ? window : global);
