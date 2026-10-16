# CastleQuest NG — browser remake design

Date: 2026-10-16
Status: approved in conversation, pending written-spec review

## 1. Purpose and context

CastleQuest is an educational quiz game from 2006 (C# + Irrlicht, in `legacy/CastleQuest`). The player walks through a castle maze in first person, collects question marks, answers multiple-choice questions, and the answers open doors toward the exit.

CastleQuest NG is a new browser version that **students in schools** will play from a **public website**.

### Goals
- Same core game: the maze, question marks, door groups that unlock, and the exit.
- Runs in a modern desktop browser (WebGL via Three.js) as a static site with no server.
- **Every shipped asset is new and our own.** The legacy project contains third-party material: Quake 3 textures and models, a community `.bsp` map, and question sets owned by others. None of it is shipped, converted or traced. Only the abstract layout idea and the game rules carry over.
- New question sets written for this project, in Czech.

### Non-goals (v1)
- Sending results to a server, logins, or the legacy session codes (school/level/student number).
- Touch or tablet controls, and gamepad support.
- A multi-language UI (Czech only; strings are collected in one module so this can be added later).
- Saving progress between sessions.

## 2. Technology

- **Vite + TypeScript + Three.js**, built to a static `dist/` folder.
- `base: './'` (relative paths), so the build works from any subfolder of a school web server.
- **Vitest** for unit tests and **Playwright** for one browser smoke test.
- The UI is HTML/CSS layered over the WebGL canvas. Bitmap fonts are not used.
- `legacy/` is excluded from git (it contains third-party binaries and assets).

## 3. Architecture

```
index.html
src/
  main.ts              boot + screen state machine: menu → game → results
  strings.ts           all Czech UI strings
  data/
    questionSet.ts     load + validate a JSON question set
    shuffle.ts         seedable shuffle of questions and answers (answer-index mapping)
  world/
    layout.ts          maze described as data (see §4)
    builder.ts         layout → Three.js meshes + list of collision boxes
    textures.ts        textures generated on a canvas (stone, flagstone, wood, metal tints, glow)
    props.ts           torches (flicker lights), question marks, doors, exit portal
  game/
    rules.ts           pure logic: answered set, door groups, unlock events, win state
    player.ts          first-person controller, movement, collision against axis-aligned boxes
    interaction.ts     nearest interactable within reach + facing cone
    session.ts         timer, answer record, final result
  ui/
    menu.ts            start screen (set picker, optional name)
    questionDialog.ts  question with 4 answer buttons (also 1–4 keys)
    hud.ts             counter N/30, timer, messages ("Zbývají ještě 3 otázky!")
    minimap.ts         2D canvas map from layout data
    pauseMenu.ts       Esc: continue / help / quit
    results.ts         end screen, print/PDF
public/
  tests/index.json     list of sets: [{ id, name, file }]
  tests/Z1.json … S3.json
docs/otazky.md         Czech guide on writing a question set
```

**Boundaries:**
- `game/rules.ts`, `data/*` and `world/layout.ts` contain no Three.js or DOM code. They are pure and unit-tested.
- `world/builder.ts` is the only code that turns layout data into scene objects. Collision boxes come from the same data, so geometry and collision cannot drift apart.
- UI modules talk to the game through a small event interface (`onAnswered`, `onDoorsUnlocked`, `onExit`, …). They never reach into scene objects.

## 4. World

### 4.1 Layout
Plan coordinates are in metres: x points east, y points north, and the origin is the centre of the exit room. The layout follows the legacy map's shape, built from new geometry:

- **Entrance corridor:** runs from the start point (0, −35) north to the south middle room of the outer ring. A grey door is near the start.
- **Outer ring:** a square ring with half-size ≈ 27 m. Each side has a **corner room** at each end and a **middle room** at the side's centre. Corridor segments join them, with a **grey door** at each end of each segment (4 grey doors per side, 16 in all).
- **Inner ring:** a square ring with half-size ≈ 17 m and the same structure as the outer ring (corner rooms, middle rooms, 16 grey doors).
- **Axis connectors:** on each of the four axes, a short corridor joins the outer middle room to the inner middle room, and the inner middle room to the central room.
  - Outer → inner connectors have a **silver door** (4 in all).
  - Inner → centre connectors have a **gold door** (4 in all).
- **Central room:** octagonal, about 16 m across, with the **exit portal** at the origin.
- Corridors are 4 m wide and 4 m high. Rooms are 8–10 m across and 5 m high. Corners can have chamfers and pillars for decoration only.

The exact dimensions are tuned during implementation. `layout.ts` is the single source of truth.

### 4.2 Question marks (30)
- **Outer ring, silver, 18:** 1 in each corner room (4), 4 in the north middle room, 2 in the south middle room (the entrance comes in there), 4 in the east middle room and 4 in the west.
- **Inner ring, gold, 12:** 1 in each corner room (4) and 2 in each middle room (8).

### 4.3 Look
- All textures are made on a canvas at startup: stone block walls, a flagstone floor, wooden ceiling beams, door panels tinted grey, silver or gold, and glow sprites.
- Question marks are a 3D "?" shape (extruded/lathe geometry), spinning and bobbing with an emissive glow. Silver ones belong to the outer ring and gold ones to the inner ring. The one the player is aiming at turns red, as in the original.
- Torches are simple procedural brackets and flames, using additive sprites. Only a handful of real point lights (≤ 8) follow the torches nearest the player and flicker. Every other torch is a glow sprite only.
- Dark exponential fog, and a blue particle portal at the exit.
- **Performance target:** 60 fps at 1080p on integrated school-PC graphics. Pixel ratio is capped at 1.5.

## 5. Gameplay

### 5.1 Controls
- Click the canvas to capture the mouse, then use the mouse to look.
- **W/A/S/D** or the **arrow keys** move. Without the captured mouse, ←/→ turn instead of strafing, so the game works keyboard-only.
- **E**, **Enter** or **Space** use the targeted object. **M** toggles the minimap. **Esc** opens the pause menu. **F1** or **H** show help.
- Walking speed is about 4 m/s, eye height 1.6 m. There is no jumping, and the floor is flat.

### 5.2 Rules
- Using a question mark opens the question dialog with the next unused question. Questions are shuffled once at game start, and the answer order within each question is shuffled too.
- Answering (right or wrong) marks that question mark as done. It disappears with a particle burst, and the HUD briefly shows "Správně!" or "Špatně!".
- **Each question is answered once.** The dialog can be closed without answering (Esc), and the question mark then stays.
- **Grey door:** opens when used and slides up into the ceiling over about 1 s.
- **Silver doors (all 4):** open by themselves once all 18 silver question marks are done.
- **Gold doors (all 4):** open by themselves once all 12 gold question marks are done.
- Using a locked door shows "Zbývá ještě N otázek!", with correct Czech plural forms: 1 → "Zbývá poslední otázka!", 2–4 → "Zbývají ještě N otázky!", 5+ → "Zbývá ještě N otázek!".
- Unlock events show a message ("Dveře do vnitřního okruhu se otevírají!" / "Dveře do středové místnosti se otevírají!").
- Walking into the exit portal ends the game and opens the results screen.

### 5.3 Screens
- **Start screen:**
  - a picker with the sets from `index.json`, an optional name field and a Play button
  - short control help
  - the demo camera slowly circles the central room behind the menu
  - `?test=<id>` in the URL preselects a set and skips the picker
- **HUD:** done count `N/30`, elapsed time and messages.
- **Minimap:** drawn from layout data, showing visited areas only (fog of war per room or segment), the player arrow, door states and remaining question marks.
- **Pause menu:** Continue, Help, Quit to menu.
- **Results screen:**
  - name, set, date, time taken, and correct out of 30
  - a table of each question with the student's answer, the correct answer and ✓/✗
  - buttons for Play again and Print / Save as PDF (`window.print()` with a print stylesheet)
  - nothing is sent anywhere

## 6. Question content

### 6.1 Format
`public/tests/<id>.json`:
```json
{
  "id": "Z1",
  "name": "Základní škola – úroveň 1",
  "school": "Z",
  "level": 1,
  "questions": [
    { "q": "Které zařízení slouží k psaní textu?", "answers": ["klávesnice", "monitor", "reproduktor", "tiskárna"], "correct": 0 }
  ]
}
```

**Validation** (`questionSet.ts`):
- a non-empty `id` and `name`
- at least 30 questions
- each question has non-empty `q`, exactly 4 non-empty `answers`, no duplicate answers, and `correct` an integer from 0 to 3

A set that fails validation is shown in the picker as unavailable, with the reason. It never crashes the game. If there are more than 30 questions, 30 are picked at random each game.

### 6.2 Sets
There are six new sets of 30 questions each, written for this project in Czech. Topic: basic computer and digital literacy.

| Set | Audience |
|-----|----------|
| Z1, Z2, Z3 | primary school (základní), increasing difficulty |
| S1, S2, S3 | special school (speciální): simpler wording, short sentences, concrete everyday situations, increasing difficulty |

- **Topic areas:** computer parts and devices; keyboard and mouse; files, folders and programs; the internet, web and email; online safety and privacy (passwords, strangers, personal data, cyberbullying); healthy and polite computer use.
- **Quality rules:** one clearly correct answer; plausible but clearly wrong distractors; no trick questions; no brand-specific trivia except well-known basics; up to date (no outdated technology as correct answers).
- **Review:** questions are drafted by Claude and must be reviewed by the project owner before public release.
- `docs/otazky.md` explains the format and the quality rules in Czech for teachers.

## 7. Error handling
- WebGL not available: a static message in Czech with a short hint (update the browser or enable hardware acceleration).
- `index.json` or a set fails to load: an error in the picker. Other sets stay playable.
- Pointer capture refused or lost: the game pauses and shows "Klikni pro pokračování".
- Tab hidden: the game pauses automatically and the timer stops.

## 8. Testing
- **Unit (Vitest):**
  - `rules.ts`: unlocking at exactly 18 and 12, wrong answers counting, the win condition
  - `shuffle.ts`: answer-index mapping stays correct after shuffling
  - `questionSet.ts`: each validation rule
  - Czech plural forms
  - `player.ts`: collision (no passing through walls or closed doors, sliding along walls)
  - `layout.ts` checks: every question mark and the exit are reachable by flood fill, with closed silver and gold doors as walls until their group is done, and no interactables overlap walls
  - every shipped question set passes validation
- **Smoke (Playwright):** load the page, pick a set, start, open and answer one question through a test hook, and check that the counter reads 1/30.
- **Manual:** playtest the full run on a low-end machine for frame rate.

## 9. Deployment
`npm run build` → `dist/`, which can be uploaded to any static host (GitHub Pages, Netlify, school server). There are no runtime dependencies on external CDNs or servers.

## 10. Legacy material policy
`legacy/` is a reference only. It is not committed, not shipped, and its assets are not converted or traced. Carried over: the game rules, the abstract maze topology, the colour scheme of the door groups and question marks, and the general mood (torch-lit stone corridors, blue portal).

## 11. Changes after v1 (2026-10-16)
- The game is renamed **Kwest**.
- The special-school sets (S1–S3) are removed. The remaining sets Z1–Z3 are named "Úroveň 1", "Úroveň 2" and "Úroveň 3".
- The minimap is visible by default. It is toggled with **M** or with the on-screen "Mapa (M)" button. The button is only clickable while the mouse is not captured.
