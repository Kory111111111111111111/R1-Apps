(function (global) {
    /* Turn resolution: movement, pathfinding, enemy AI, abilities, rewards, chests, items. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    function killEnemy(run, room, enemy, logs) {
        if (!enemy || enemy.hp > 0 || enemy.rewarded) {
            return false;
        }
        enemy.rewarded = true;
        const name = PD.enemyName(enemy.type);
        logs.push(name + " DOWN");
        const dropGold = enemy.gold || (PD.ENEMY_DEFS[enemy.type] && PD.ENEMY_DEFS[enemy.type].gold) || 0;
        if (dropGold > 0) {
            run.gold += dropGold;
            logs.push("+" + dropGold + " GOLD");
        }
        run.kills = (run.kills || 0) + 1;
        run.slainTypes = run.slainTypes || {};
        run.slainTypes[enemy.type] = (run.slainTypes[enemy.type] || 0) + 1;
        const xp = PD.enemyXp(enemy);
        if (xp > 0) {
            logs.push("+" + xp + " XP");
            PD.grantXp(run, xp, logs);
        }
        if (PD.hasCharm(run, "drain_charm") && run.hp > 0 && run.hp < run.maxHp) {
            run.hp = PD.clamp(run.hp + 1, 0, run.maxHp);
            logs.push("DRAIN +1");
        }
        if (room) {
            enemy.rewarded = true;
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

    function cycleFacing(run, delta) {
        const i = PD.FACINGS.indexOf(run.facing);
        const idx = i < 0 ? 0 : i;
        run.facing = PD.FACINGS[(idx + delta + PD.FACINGS.length) % PD.FACINGS.length];
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
        const tile = PD.getTile(room, x, y);
        if (tile === "#") {
            return false;
        }
        const isDest = x === destX && y === destY;
        if (PD.enemyAt(room, x, y)) {
            return isDest;
        }
        if (tile === "$" || tile === "+" || tile === ">") {
            return isDest;
        }
        return tile === "." || tile === "^" || tile === "~" || tile === "S" || tile === "R" || tile === "!";
    }

    function pathTo(run, tx, ty) {
        const room = PD.currentRoom(run);
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
            for (let i = 0; i < PD.FACINGS.length; i += 1) {
                const vec = PD.DIR[PD.FACINGS[i]];
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
        if (x < 1 || y < 1 || x > PD.MAP_SIZE - 2 || y > PD.MAP_SIZE - 2) {
            return false;
        }
        const tile = PD.getTile(room, x, y);
        if (tile === "#" || tile === "+" || tile === "$") {
            return false;
        }
        if (run.x === x && run.y === y) {
            return false;
        }
        const other = PD.enemyAt(room, x, y);
        if (other && other !== self) {
            return false;
        }
        return true;
    }

    function attackHero(run, enemy, rng, logs) {
        const dmg = PD.hitDamage(enemy.atk, run.def, rng);
        const guarded = run.guardTurns > 0;
        const reduced = guarded ? Math.max(0, Math.floor(dmg / 2)) : dmg;
        run.hp = PD.clamp(run.hp - reduced, 0, run.maxHp);
        const name = (PD.ENEMY_DEFS[enemy.type] && PD.ENEMY_DEFS[enemy.type].name) || enemy.type.toUpperCase();
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
                    killEnemy(run, PD.currentRoom(run), enemy, logs);
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
            if (enemy.windup === 0) {
                const targetHeld = run.x === enemy.huntTargetX && run.y === enemy.huntTargetY;
                enemy.huntTargetX = null;
                enemy.huntTargetY = null;
                if (targetHeld) {
                    logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " LUNGES");
                    attackHero(run, enemy, rng, logs);
                } else {
                    logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " HUNT MISSES");
                }
            } else {
                logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " HUNTS");
            }
            return;
        }
        if (enemy.heavyTelegraph) {
            const heavy = enemy.type === "ogre" ? 4 : 3;
            const targetHeld = run.x === enemy.heavyTargetX && run.y === enemy.heavyTargetY;
            enemy.heavyTelegraph = false;
            enemy.heavyTargetX = null;
            enemy.heavyTargetY = null;
            enemy.heavyCooldown = PD.BOSS_HEAVY_COOLDOWN;
            if (!targetHeld) {
                logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " SMASH MISSES");
                return;
            }
            const guarded = run.guardTurns > 0;
            const boonHeavy = run.lastStand > 0;
            const damage = boonHeavy ? 0 : (guarded ? Math.max(0, Math.floor(heavy / 2)) : heavy);
            run.hp = PD.clamp(run.hp - damage, 0, run.maxHp);
            if (boonHeavy) {
                run.lastStand -= 1;
                logs.push("LAST STAND HOLDS");
            }
            if (guarded) {
                run.guardTurns = 0;
                logs.push("GUARD BREAKS");
            }
            logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " SMASH " + damage);
            return;
        }
        if (enemy.castWindup > 0) {
            enemy.castWindup -= 1;
            enemy.telegraph = true;
            if (enemy.castWindup === 0) {
                const dxLine = Math.abs(run.x - enemy.x);
                const dyLine = Math.abs(run.y - enemy.y);
                const heldLine = (dxLine === 0 || dyLine === 0) && dxLine + dyLine <= 3;
                enemy.castTargetX = null;
                enemy.castTargetY = null;
                if (heldLine) {
                    const bolt = Math.max(1, (enemy.atk || 2) - 2);
                    const guarded = run.guardTurns > 0;
                    const damage = guarded ? Math.max(0, Math.floor(bolt / 2)) : bolt;
                    run.hp = PD.clamp(run.hp - damage, 0, run.maxHp);
                    logs.push("ACOLYTE BOLT " + damage);
                    if (guarded) {
                        run.guardTurns = 0;
                        logs.push("GUARD BREAKS");
                    }
                } else {
                    logs.push("ACOLYTE BOLT MISSES");
                }
            } else {
                logs.push("ACOLYTE CHANTS");
            }
            return;
        }
        if (dist === 1) {
            if (enemy.type === "acolyte") {
                // Bounded retreat: the acolyte gives ground only while it has
                // retreat left this encounter. Once that is spent, or once it is
                // cornered with nowhere to step, it stops dodging and fights
                // back, so a melee hero can always finish the encounter.
                if ((enemy.fleeLeft || 0) > 0) {
                    const awayX = enemy.x + Math.sign(enemy.x - run.x);
                    const awayY = enemy.y + Math.sign(enemy.y - run.y);
                    let stepped = tryMoveStep(run, room, enemy, awayX, awayY);
                    if (!stepped) {
                        for (let i = 0; i < PD.FACINGS.length; i += 1) {
                            const vec = PD.DIR[PD.FACINGS[i]];
                            if (tryMoveStep(run, room, enemy, enemy.x + vec.x, enemy.y + vec.y)) {
                                stepped = true;
                                break;
                            }
                        }
                    }
                    if (stepped) {
                        enemy.fleeLeft -= 1;
                        logs.push("ACOLYTE BACKS AWAY");
                        return;
                    }
                }
                logs.push("ACOLYTE STANDS ITS GROUND");
                attackHero(run, enemy, rng, logs);
                return;
            }
            if (enemy.type === "rat" && rng.int(1, 100) <= 25) {
                const bite = Math.max(1, PD.hitDamage(enemy.atk, run.def, rng) - 1);
                const guardedBite = run.guardTurns > 0;
                const biteDamage = guardedBite ? Math.max(0, Math.floor(bite / 2)) : bite;
                run.hp = PD.clamp(run.hp - biteDamage, 0, run.maxHp);
                if (guardedBite) {
                    run.guardTurns = 0;
                    logs.push("GUARD BREAKS");
                    if (run.classId === "knight" && enemy.hp > 0) {
                        const counter = Math.max(1, Math.floor(run.atk / 2));
                        enemy.hp -= counter;
                        logs.push("COUNTER " + counter);
                        if (enemy.hp <= 0) {
                            enemy.hp = 0;
                            killEnemy(run, room, enemy, logs);
                        }
                    }
                }
                if (PD.hasCharm(run, "ward_charm")) {
                    logs.push("RAT BITE " + biteDamage + " · WARDED");
                } else {
                    run.poisonTurns = Math.max(run.poisonTurns || 0, 2);
                    logs.push("RAT BITE " + biteDamage + " · DISEASE");
                }
                return;
            }
            if (enemy.type === "ghoul" && enemy.windup <= 0 && rng.int(1, 100) <= 35) {
                enemy.windup = 1;
                enemy.huntTargetX = run.x;
                enemy.huntTargetY = run.y;
                enemy.telegraph = true;
                logs.push("GHOUL HUNTS");
                return;
            }
            if ((enemy.type === "ogre" || enemy.type === "wraith") && enemy.heavyCooldown <= 0) {
                enemy.heavyTelegraph = true;
                enemy.heavyTargetX = run.x;
                enemy.heavyTargetY = run.y;
                enemy.telegraph = true;
                logs.push((PD.ENEMY_DEFS[enemy.type] || {}).name + " RAISES A BLOW");
                return;
            }
            attackHero(run, enemy, rng, logs);
            return;
        }
        const ai = enemy.ai || PD.ENEMY_DEFS[enemy.type] && PD.ENEMY_DEFS[enemy.type].ai || "slow";
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
            const dirs = PD.FACINGS.slice();
            for (let i = dirs.length - 1; i > 0; i -= 1) {
                const j = rng.int(0, i);
                const tmp = dirs[i];
                dirs[i] = dirs[j];
                dirs[j] = tmp;
            }
            for (let i = 0; i < dirs.length; i += 1) {
                const vec = PD.DIR[dirs[i]];
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
                var dirs2 = PD.FACINGS.slice();
                for (var di = dirs2.length - 1; di > 0; di -= 1) {
                    var dj = rng.int(0, di);
                    var tmp2 = dirs2[di];
                    dirs2[di] = dirs2[dj];
                    dirs2[dj] = tmp2;
                }
                for (var di2 = 0; di2 < dirs2.length; di2 += 1) {
                    var vec2 = PD.DIR[dirs2[di2]];
                    var px = enemy.x + vec2.x;
                    var py = enemy.y + vec2.y;
                    if (px >= 0 && py >= 0 && px < PD.MAP_SIZE && py < PD.MAP_SIZE && !(run.x === px && run.y === py) && !PD.enemyAt(room, px, py)) {
                        var tile2 = PD.getTile(room, px, py);
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
        if (ai === "caster") {
            const dxLine = run.x === enemy.x || run.y === enemy.y;
            const ranged = dxLine && dist >= 2 && dist <= 3;
            let clearLine = true;
            if (ranged) {
                const mx = enemy.x + Math.sign(run.x - enemy.x);
                const my = enemy.y + Math.sign(run.y - enemy.y);
                const midTile = PD.getTile(room, mx, my);
                clearLine = midTile !== "#" && midTile !== "+" && midTile !== "$";
            }
            if (ranged && clearLine && rng.int(1, 100) <= 35) {
                enemy.castWindup = 1;
                enemy.castTargetX = run.x;
                enemy.castTargetY = run.y;
                enemy.telegraph = true;
                logs.push("ACOLYTE CHANTS");
                return;
            }
            if (dist > 4) {
                return;
            }
            chaseHero(run, room, enemy, rng, 4);
            return;
        }
        chaseHero(run, room, enemy, rng, 4);
    }

    function enemyTurn(run, rng, logs) {
        const room = PD.currentRoom(run);
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

            run.hp = PD.clamp(run.hp - 1, 0, run.maxHp);
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
            const room = PD.currentRoom(run);
            if (room && room.enemies) {
                room.enemies.forEach(function (enemy) {
                    enemy.telegraph = enemy.hp > 0 && Math.abs(enemy.x - run.x) + Math.abs(enemy.y - run.y) === 1;
            enemy.heavyTelegraph = !!enemy.heavyTelegraph;
                });
            }
        }
        PD.commitRng(run, rng);
        result.logs = logs;
        result.ok = true;
        return result;
    }

    function enterRoom(run, nextId, viaDir) {
        run.roomId = nextId;
        run.firstStrikeUsed = false;
        const inner = PD.DOOR_INNER[viaDir];
        run.x = inner.x;
        run.y = inner.y;
        const occupant = PD.enemyAt(PD.currentRoom(run), run.x, run.y);
        if (occupant) {
            const fallback = PD.interiorSpots(PD.currentRoom(run)).find(function (p) {
                return PD.getTile(PD.currentRoom(run), p.x, p.y) === "." && !PD.enemyAt(PD.currentRoom(run), p.x, p.y) && !(p.x === run.x && p.y === run.y);
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
        if (item !== "coin" && run.pack.length >= PD.PACK_MAX) {
            logs.push("PACK FULL");
            return { consumed: false };
        }
        room.chest.open = true;
        PD.setTile(room, room.chest.x, room.chest.y, ".");
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
        const rng = PD.rngFromRun(run);
        const room = PD.currentRoom(run);
        if (!room) {
            logs.push("NO ROOM");
            return { ok: false, logs: logs };
        }
        if (run.hp <= 0) {
            logs.push("DEAD");
            return { ok: false, died: true, logs: logs };
        }
        const vec = PD.DIR[run.facing] || PD.DIR.S;
        const nx = run.x + vec.x;
        const ny = run.y + vec.y;
        const foe = PD.enemyAt(room, nx, ny);
        if (foe) {
            let bonus = 0;
            if (run.classId === "scout" && !run.firstStrikeUsed) {
                bonus = 1;
                run.firstStrikeUsed = true;
            }
            const dmg = PD.hitDamage(run.atk + bonus, foe.def, rng);
            foe.hp -= dmg;
            const foeName = PD.enemyName(foe.type);
            logs.push("HIT " + foeName + " " + dmg + (bonus ? " · FIRST STRIKE" : ""));
            if (foe.hp <= 0) {
                foe.hp = 0;
                killEnemy(run, room, foe, logs);
            }
            return finishTurn(run, rng, logs);
        }

        const tile = PD.getTile(room, nx, ny);
        if (room.hazard === "blood" && tile === "." && room.enemies.length && rng.int(1, 100) <= 20) {
            run.hp = PD.clamp(run.hp - 1, 0, run.maxHp);
            logs.push("BLOOD DRAIN 1");
        }
        if (room.hazard === "reinforced" && tile === "^") {
            logs.push("IRON TRAP");
        }
        if (tile === "S" || tile === "R") {
            run.x = nx;
            run.y = ny;
            return chooseRoomRoute(run, tile === "S" ? "safe" : "risk");
        }
        if (tile === "#") {
            if (run.classId === "mage" || run.phaseStep <= 0 || nx < 0 || ny < 0 || nx >= PD.MAP_SIZE || ny >= PD.MAP_SIZE) {
                logs.push("BLOCKED");
                PD.commitRng(run, rng);
                return { ok: false, blocked: true, logs: logs };
            }
            run.x = nx;
            run.y = ny;
            run.phaseStep -= 1;
            logs.push("PHASE STEP");
            return finishTurn(run, rng, logs);
        }
        if (tile === "!") {
            if (room.sanctumUsed) {
                logs.push("WELL IS DRY");
            } else {
                const amount = Math.max(1, Math.ceil(run.maxHp * 0.35));
                const healed = Math.min(amount, run.maxHp - run.hp);
                run.hp = PD.clamp(run.hp + amount, 0, run.maxHp);
                room.sanctumUsed = true;
                logs.push("SANCTUM REST +" + healed + " HP");
            }
            return finishTurn(run, rng, logs);
        }
        if (tile === "$") {
            const opened = openChest(run, room, rng, logs);
            if (!opened.consumed) {
                PD.commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            return finishTurn(run, rng, logs);
        }
        if (tile === "+") {
            let usedDir = null;
            for (let i = 0; i < PD.FACINGS.length; i += 1) {
                const d = PD.FACINGS[i];
                const cell = PD.DOOR_CELL[d];
                if (cell.x === nx && cell.y === ny) {
                    usedDir = d;
                    break;
                }
            }
            const nextId = usedDir != null ? room.doors[usedDir] : null;
            if (nextId == null) {
                logs.push("BLOCKED");
                PD.commitRng(run, rng);
                return { ok: false, blocked: true, logs: logs };
            }
            enterRoom(run, nextId, PD.OPP[usedDir]);
            logs.push("ENTER");
            PD.commitRng(run, rng);
            return { ok: true, logs: logs, roomChanged: true, skipEnemies: true };
        }
        if (tile === ">") {
            if (room.reward && room.reward.active && !room.reward.choice) {
                logs.push("CHOOSE REWARD");
                PD.commitRng(run, rng);
                return { ok: false, logs: logs, reward: true };
            }
            const siteLimit = run.maxSiteFloor || PD.MAX_FLOOR;
            const isHold = !run.siteId || run.siteId === "hold";
            if (run.floor === siteLimit && !isHold) {
                if (room.enemies.some(function (enemy) { return enemy.hp > 0; })) {
                    logs.push("FOES BAR THE WAY");
                    PD.commitRng(run, rng);
                    return { ok: false, logs: logs };
                }
                logs.push("SITE CLEAR");
                PD.commitRng(run, rng);
                return { ok: true, logs: logs, siteCleared: run.siteId, skipEnemies: true };
            }
            if (run.floor === siteLimit && isHold) {
                if (ogreAlive(room)) {
                    logs.push("THE OGRE BARS THE WAY");
                    PD.commitRng(run, rng);
                    return { ok: false, logs: logs };
                }
                logs.push("YOU ESCAPE");
                PD.commitRng(run, rng);
                return { ok: true, logs: logs, won: true, siteCleared: "hold", skipEnemies: true };
            }
            if (isHold && wraithAlive(room)) {
                logs.push("THE WRAITH BARS THE WAY");
                PD.commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            if (room.enemies.some(function (enemy) { return enemy.hp > 0; })) {
                logs.push("FOES BAR THE WAY");
                PD.commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            run.floor += 1;
            run.renown = (run.renown || 0) + 1;
            PD.generateFloor(run, rng);
            if (run.phaseStep > 0) logs.push("PHASE STEP READY");
            if (run.lastStand > 0) logs.push("LAST STAND READY");
            logs.push("FLOOR " + run.floor);
            PD.commitRng(run, rng);
            return { ok: true, logs: logs, floorChanged: true, roomChanged: true, skipEnemies: true };
        }

        run.x = nx;
        run.y = ny;
        if (tile === "^") {
            const evaded = run.classId === "scout" && rng.int(1, 100) <= 50;
            const trapDamage = room.hazard === "reinforced" ? 3 : 2;
            if (evaded) {
                logs.push("TRAP EVADED");
            } else {
                run.hp = PD.clamp(run.hp - trapDamage, 0, run.maxHp);
                logs.push("TRAP " + trapDamage);
            }
            PD.setTile(room, nx, ny, ".");
        }
        if (tile === "~") {
            const evaded = run.classId === "scout" && rng.int(1, 100) <= 50;
            if (evaded) {
                logs.push("POISON EVADED");
            } else if (PD.hasCharm(run, "ward_charm")) {
                logs.push("POISON WARDED");
            } else {
                    run.poisonTurns = 3;
                logs.push("POISONED 3T");
            }
            PD.setTile(room, nx, ny, ".");
        }
        return finishTurn(run, rng, logs);
    }

    function useAbility(run) {
        const logs = [];
        const rng = PD.rngFromRun(run);
        if (!run || !PD.currentRoom(run)) {
            return { ok: false, logs: ["NO ROOM"] };
        }
        const room = PD.currentRoom(run);
        if (run.classId === "knight") {
            if (run.guardTurns > 0) {
                logs.push("ALREADY GUARDING");
                PD.commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            run.guardTurns = 1;
            logs.push("GUARD UP · NEXT HIT HALF + COUNTER");
            PD.commitRng(run, rng);
            return { ok: true, logs: logs, skipEnemies: true };
        }
        if (run.classId === "scout") {
            const vec = PD.DIR[run.facing];
            const tx = run.x + vec.x;
            const ty = run.y + vec.y;
            const tile = PD.getTile(room, tx, ty);
            if (tile === "^" || tile === "~") {
                PD.setTile(room, tx, ty, ".");
                logs.push("TRAP DISARMED");
                logs.push("SAFE");
                return finishTurn(run, rng, logs);
            }
            logs.push("NO TRAP");
            PD.commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        if (run.classId === "mage") {
            const vec = PD.DIR[run.facing];
            let enemy = null;
            let hitDist = 0;
            for (let distance = 1; distance <= 3; distance += 1) {
                enemy = PD.enemyAt(room, run.x + vec.x * distance, run.y + vec.y * distance);
                if (enemy) { hitDist = distance; break; }
                if (PD.getTile(room, run.x + vec.x * distance, run.y + vec.y * distance) === "#") break;
            }
            if (!enemy) {
                logs.push("NO TARGET");
                PD.commitRng(run, rng);
                return { ok: false, logs: logs };
            }
            const damage = Math.max(2, run.atk - enemy.def + 1);
            enemy.hp -= damage;
            const enemyNameStr = PD.enemyName(enemy.type);
            logs.push("CAST " + enemyNameStr + " " + damage + " · RANGE " + hitDist);
            if (enemy.hp <= 0) {
                enemy.hp = 0;
                killEnemy(run, room, enemy, logs);
                if (rng.int(1, 100) <= 30) {
                    var secondEnemy = null;
                    for (var d2 = hitDist + 1; d2 <= 3; d2 += 1) {
                        secondEnemy = PD.enemyAt(room, run.x + vec.x * d2, run.y + vec.y * d2);
                        if (secondEnemy) break;
                        if (PD.getTile(room, run.x + vec.x * d2, run.y + vec.y * d2) === "#") break;
                    }
                    if (secondEnemy && secondEnemy.hp > 0) {
                        var pierceDmg = Math.max(1, Math.floor(damage / 2));
                        secondEnemy.hp -= pierceDmg;
                        logs.push("PIERCE " + PD.enemyName(secondEnemy.type) + " " + pierceDmg + " · ARCANE");
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
        PD.commitRng(run, rng);
        return { ok: false, logs: logs };
    }

    function chooseRoomRoute(run, route) {
        const room = PD.currentRoom(run);
        if (!room || !room.choice || !room.choice.active || (route !== "safe" && route !== "risk")) {
            return { ok: false, logs: ["NO CHOICE"] };
        }
        const rng = PD.rngFromRun(run);
        room.choice.active = false;
        room.choice.safe = route === "safe";
        const safeTile = room.choice.safeTile || { x: 2, y: 3 };
        const riskTile = room.choice.riskTile || { x: 4, y: 3 };
        PD.setTile(room, safeTile.x, safeTile.y, ".");
        PD.setTile(room, riskTile.x, riskTile.y, ".");
        const logs = [];        if (route === "safe") {
            room.enemies = [];
            logs.push("SAFE ROUTE");
        } else {
            run.gold += 10;
            logs.push("RISK ROUTE +10 GOLD");
            if (!room.enemies.length) {
                const riskEnemy = PD.makeEnemy(PD.pickEnemyType(run.floor, rng, run.enemyPool), 4, 3, run.floor, run.contract || 0);
                room.enemies.push(riskEnemy);
                PD.reinforceEnemy(room, riskEnemy);
            }
            if (run.floor >= 6 && room.hazard === "blood") {
                room.enemies.forEach(function (enemy) {
                    enemy.atk += 1;
                });
                logs.push("BLOOD FRENZY");
            }
        }

        room.choice.route = route;
        PD.commitRng(run, rng);
        return { ok: true, logs: logs, roomChoice: true, skipEnemies: true };
    }

    function claimReward(run, choiceId) {
        const logs = [];
        const room = PD.currentRoom(run);
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
        const rng = PD.rngFromRun(run);
        return finishTurn(run, rng, logs);
    }

    function equipOnRun(run, index, logs) {
        const item = run.pack[index];
        const def = PD.GEAR_DEFS[item];
        if (!def) {
            return false;
        }
        const gear = run.gear = PD.normalizeGear(run.gear);
        const previous = gear[def.slot];
        gear[def.slot] = item;
        const next = PD.gearBonus(gear);
        run.atk = Math.max(0, (run.atk || 0) + next.atk - (run.gearAtk || 0));
        run.def = Math.max(0, (run.def || 0) + next.def - (run.gearDef || 0));
        const maxHp = Math.max(1, (run.maxHp || 1) - (run.gearHp || 0) + next.hp);
        run.hp = PD.clamp(run.hp || 0, 0, maxHp);
        run.maxHp = maxHp;
        run.gearAtk = next.atk;
        run.gearDef = next.def;
        run.gearHp = next.hp;
        run.pack.splice(index, 1);
        if (previous) {
            run.pack.push(previous);
        }
        logs.push("EQUIP " + ((PD.ITEM_INFO[item] && PD.ITEM_INFO[item].name) || item.toUpperCase()));
        return true;
    }

    function useItem(run, index) {
        const logs = [];
        const rng = PD.rngFromRun(run);
        if (index < 0 || index >= run.pack.length) {
            logs.push("NO ITEM");
            PD.commitRng(run, rng);
            return { ok: false, logs: logs };
        }
        const item = run.pack[index];
        if (item === "potion") {
            run.hp = PD.clamp(run.hp + 6, 0, run.maxHp);
            logs.push("USED POTION");
        } else if (item === "greater_potion") {
            run.hp = PD.clamp(run.hp + 12, 0, run.maxHp);
            logs.push("USED G.POTION");
        } else if (PD.GEAR_DEFS[item]) {
            equipOnRun(run, index, logs);
            PD.commitRng(run, rng);
            return { ok: true, logs: logs, equip: true };
        } else {
            logs.push("NO ITEM");
            PD.commitRng(run, rng);
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
            hero.hp = PD.clamp(hero.hp + 6, 0, hero.maxHp);
            logs.push("USED POTION");
        } else if (item === "greater_potion") {
            hero.hp = PD.clamp(hero.hp + 12, 0, hero.maxHp);
            logs.push("USED G.POTION");
        } else if (PD.GEAR_DEFS[item]) {
            const def = PD.GEAR_DEFS[item];
            const gear = hero.gear = PD.normalizeGear(hero.gear);
            const previous = gear[def.slot];
            gear[def.slot] = item;
            hero.pack.splice(index, 1);
            if (previous) {
                hero.pack.push(previous);
            }
            logs.push("EQUIP " + ((PD.ITEM_INFO[item] && PD.ITEM_INFO[item].name) || item.toUpperCase()));
            return { ok: true, logs: logs, equip: true };
        } else {
            logs.push("NO ITEM");
            return { ok: false, logs: logs };
        }
        hero.pack.splice(index, 1);
        return { ok: true, logs: logs };
    }


    PD.killEnemy = killEnemy;
    PD.pickLoot = pickLoot;
    PD.cycleFacing = cycleFacing;
    PD.faceTile = faceTile;
    PD.canStepOnto = canStepOnto;
    PD.pathTo = pathTo;
    PD.ogreAlive = ogreAlive;
    PD.wraithAlive = wraithAlive;
    PD.canEnemyOccupy = canEnemyOccupy;
    PD.attackHero = attackHero;
    PD.tryMoveStep = tryMoveStep;
    PD.chaseHero = chaseHero;
    PD.stepEnemy = stepEnemy;
    PD.enemyTurn = enemyTurn;
    PD.finishTurn = finishTurn;
    PD.enterRoom = enterRoom;
    PD.openChest = openChest;
    PD.tryAct = tryAct;
    PD.useAbility = useAbility;
    PD.chooseRoomRoute = chooseRoomRoute;
    PD.claimReward = claimReward;
    PD.waitTurn = waitTurn;
    PD.equipOnRun = equipOnRun;
    PD.useItem = useItem;
    PD.useItemOnHero = useItemOnHero;
})(typeof window !== "undefined" ? window : global);
