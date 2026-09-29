(function (global) {
    /* Canned flavour lines used when no LLM response is available. */
    const PD = global.PocketDungeon = global.PocketDungeon || {};

    function cannedRoomLine(run) {
        const room = PD.currentRoom(run);
        if (!room) {
            return "DARK STONE.";
        }
        if (room.kind === "start" && run.floor === 1) {
            return "THE GATE CLOSES BEHIND YOU.";
        }
        if (room.kind === "start" && PD.FLOOR_THEMES[run.floor]) {
            return PD.FLOOR_THEMES[run.floor].line;
        }
        if (room.kind === "stairs" && run.floor === PD.MAX_FLOOR && PD.ogreAlive(room)) {
            return "THE OGRE FILLS THE STAIRWELL.";
        }
        if (room.kind === "sanctum") {
            return room.sanctumUsed ? "THE WELL IS DRY." : "A COLD WELL WAITS IN THE STONE.";
        }
        if (room.kind === "stairs" && PD.wraithAlive(room)) {
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
                return (PD.ENEMY_DEFS[t] && PD.ENEMY_DEFS[t].name) || t.toUpperCase();
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
        const cls = PD.CLASSES[run.classId];
        const name = cls ? cls.name : String(run.classId).toUpperCase();
        const kills = run.kills || 0;
        return "FL" + run.floor + " " + name + " · " + kills + " KILLS · " + (run.gold || 0) + " GOLD";
    }

    function cannedWinLine() {
        return "LIGHT. YOU CLIMB OUT ALIVE.";
    }


    PD.cannedRoomLine = cannedRoomLine;
    PD.cannedDeathLine = cannedDeathLine;
    PD.cannedWinLine = cannedWinLine;
})(typeof window !== "undefined" ? window : global);
