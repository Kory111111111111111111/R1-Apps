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
            services: ["inn", "shop", "shrine"]
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
            enemies: ["slime", "rat", "bat"]
        },
        crypt: {
            id: "crypt",
            name: "SALT CRYPT",
            town: "saltmere",
            floors: 1,
            rooms: 4,
            unlock: "saltmere_crypt_open",
            clear: "saltmere_crypt_clear",
            enemies: ["skeleton", "ghoul"],
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

    const innCosts = {
        ashford: 4,
        saltmere: 6,
        keepgate: 8
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
            { id: "mail", name: "MAIL", price: 16 },
            { id: "greater_potion", name: "G.POTION", price: 25 },
            { id: "talisman", name: "TALISMAN", price: 40 },
            { id: "drain_charm", name: "DRAIN CHARM", price: 55 },
            { id: "ward_charm", name: "WARD CHARM", price: 55 }
        ],
        keepgate: [
            { id: "potion", name: "POTION", price: 10 },
            { id: "blade", name: "BLADE", price: 20 },
            { id: "mail", name: "MAIL", price: 20 },
            { id: "greater_potion", name: "G.POTION", price: 30 },
            { id: "iron_blade", name: "IRON BLADE", price: 60 },
            { id: "iron_mail", name: "IRON MAIL", price: 60 },
            { id: "talisman", name: "TALISMAN", price: 40 },
            { id: "drain_charm", name: "DRAIN CHARM", price: 55 },
            { id: "ward_charm", name: "WARD CHARM", price: 55 }
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
            const cost = innCosts[townId] || 5;
            options.push({ id: "inn", label: "INN " + cost + "G" });
        }
        if (town.services.indexOf("shop") !== -1) {
            options.push({ id: "shop", label: "SHOP" });
        }
        if (town.services.indexOf("shrine") !== -1) {
            options.push({ id: "shrine", label: "SHRINE" });
        }
        options.push({ id: "road", label: "ROAD" });
        const clearedSite = contractTarget(state, townId);
        const openSite = Object.keys(sites).some(function (id) {
            return sites[id].town === townId && flag(state, sites[id].unlock) && !flag(state, sites[id].clear);
        });
        if (openSite) {
            options.push({ id: "site", label: "SITE" });
        } else if (clearedSite) {
            options.push({ id: "contract", label: "CONTRACT T" + (contractTier(state, clearedSite) + 1) });
        }
        options.push({ id: "pack", label: "PACK" });
        options.push({ id: "hero", label: "HERO" });
        options.push({ id: "journal", label: "JOURNAL" });
        options.push({ id: "help", label: "HELP" });
        return options;
    }

    const shrineUpgrades = [
        { id: "vigor", name: "VIGOR +2HP", cost: 10, maxHp: 2 },
        { id: "edge", name: "EDGE +1ATK", cost: 15, atk: 1 },
        { id: "bulwark", name: "BULWARK +1DEF", cost: 15, def: 1 }
    ];

    function buyShrineUpgrade(state, upgradeId) {
        if (!state || !state.meta || !state.hero) {
            return { ok: false, reason: "NO HERO" };
        }
        const upgrade = shrineUpgrades.filter(function (u) { return u.id === upgradeId; })[0];
        if (!upgrade) {
            return { ok: false, reason: "UNKNOWN" };
        }
        const renown = state.meta.renown || 0;
        if (renown < upgrade.cost) {
            return { ok: false, reason: "NEED " + upgrade.cost + " REN" };
        }
        state.meta.renown = renown - upgrade.cost;
        state.meta.shrinePurchases = state.meta.shrinePurchases || {};
        state.meta.shrinePurchases[upgradeId] = (state.meta.shrinePurchases[upgradeId] || 0) + 1;
        if (upgrade.maxHp) {
            state.hero.maxHp = (state.hero.maxHp || 0) + upgrade.maxHp;
            state.hero.hp = state.hero.hp + upgrade.maxHp;
        }
        if (upgrade.atk) {
            state.hero.atk = (state.hero.atk || 0) + upgrade.atk;
        }
        if (upgrade.def) {
            state.hero.def = (state.hero.def || 0) + upgrade.def;
        }
        return { ok: true, upgrade: upgrade };
    }

    function restAtInn(hero, townId) {
        if (!hero || !towns[townId]) {
            return { ok: false, reason: "NO INN" };
        }
        const cost = innCosts[townId] || 5;
        if (hero.gold < cost) {
            return { ok: false, reason: "NEED " + cost + " GOLD" };
        }
        hero.gold -= cost;
        hero.hp = hero.maxHp;
        hero.lastInn = townId;
        return { ok: true, cost: cost };
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
        const PD = global.PocketDungeon;
        if (PD && typeof PD.syncHeroFromRun === "function") {
            PD.syncHeroFromRun(hero, run);
            return;
        }
        hero.hp = run.hp;
        hero.gold = run.gold;
        hero.atk = run.atk;
        hero.def = run.def;
        hero.pack = (run.pack || []).slice();
    }

    function contractTarget(state, townId) {
        const ids = Object.keys(sites).filter(function (id) {
            return sites[id].town === townId && flag(state, sites[id].clear);
        });
        return ids.length ? ids[0] : null;
    }

    function contractTier(state, siteId) {
        const tiers = state && state.meta && state.meta.contractTiers;
        return Math.max(0, Math.round(Number(tiers && tiers[siteId]) || 0));
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
        state.meta.kills = Math.max(0, (state.meta.kills || 0) + ((run && run.kills) || 0));
        state.meta.bestiary = Object.assign({}, state.meta.bestiary || {});
        if (run && run.slainTypes) {
            Object.keys(run.slainTypes).forEach(function (type) {
                state.meta.bestiary[type] = Math.max(state.meta.bestiary[type] || 0, run.slainTypes[type]);
            });
        }
        let line = endings[siteId] || "The road changes.";
        state.meta.contractTiers = Object.assign({}, state.meta.contractTiers || {});
        if (run && run.contract > 0) {
            const tier = run.contract;
            const bonusGold = 15 + 10 * tier;
            state.hero.gold = Math.max(0, (state.hero.gold || 0) + bonusGold);
            state.meta.renown = Math.max(0, (state.meta.renown || 0) + 2);
            state.meta.contractsDone = Math.max(0, (state.meta.contractsDone || 0) + 1);
            state.meta.contractTiers[siteId] = Math.max(state.meta.contractTiers[siteId] || 0, run.contract);
            const PD = global.PocketDungeon;
            if (PD && typeof PD.grantXpToHero === "function") {
                PD.grantXpToHero(state.hero, 15 + 5 * tier);
            }
            line += " CONTRACT T" + tier + " · +" + bonusGold + "G +2R";
        }
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
        innCosts: innCosts,
        shrineUpgrades: shrineUpgrades,
        dialogue: dialogue,
        endings: endings,
        TRAVEL_ORDER: TRAVEL_ORDER,
        npcName: npcName,
        getDialogue: getDialogue,
        advanceDialogue: advanceDialogue,
        canTravel: canTravel,
        travelLabel: travelLabel,
        availableSites: availableSites,
        contractTarget: contractTarget,
        contractTier: contractTier,
        townMenu: townMenu,
        restAtInn: restAtInn,
        buyShrineUpgrade: buyShrineUpgrade,
        buy: buy,
        completeSite: completeSite
    };
})(typeof window !== "undefined" ? window : global);
