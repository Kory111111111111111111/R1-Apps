# Pocket Dungeon RPG — Slice A Design Spec

## Goal

Turn the existing crawler into a persistent, story-first Pocket Dungeon RPG without changing the 240×282 device surface or the existing bump-combat simulation.

## Slice A acceptance criteria

- A new save selects knight, scout, or mage once, then opens Ashford town.
- Ashford offers elder dialogue, inn rest, shop/road placeholders, and pack access.
- The elder writes an authored quest flag; no LLM response is required for progression.
- Site state is persisted as snapshot v2 and can resume after reload.
- Death clears only the in-progress site, restores the hero at the last inn, halves gold, increments deaths, and appends a journal/epitaph entry.
- Existing procedural combat remains deterministic for a supplied seed.

## Save contract

Snapshot v2 stores `hero`, authored `flags`, `location`, nullable `site`, and `meta` (`deaths`, `journal`). Legacy v1 snapshots migrate a current run to `site` with `hold` as the site id and Ashford as the last inn. The compatibility `run` field remains in memory for the current combat UI but is not emitted by v2 snapshots.

## World data

`js/world.js` owns Ashford, future town/site identifiers, elder dialogue, and travel gating. `advanceDialogue` is pure and only writes authored flags. Combat does not resolve quests or travel.

## Controls and recovery

Town and dialogue use scroll to highlight and side click to confirm; long press opens/closes the pack. Existing play controls remain unchanged. A failed or unavailable LLM flavor request cannot block authored game progression.

## Deferred slices

Saltmere, Keepgate, cellar/crypt-specific combat generation, shop purchases, and the finale remain Slice B/C work. They must be added as authored data and tested before becoming reachable from the map.
