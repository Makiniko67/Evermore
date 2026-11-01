# Evermore 0.4.0 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## 0.4.0 — scene workflow and cast continuity

- **Preparation and completion notifications:** Evermore shows an in-app toast when scene preparation begins, when a scene record is saved, and when recording fails. If the user grants `push_notification` and has a registered device, Evermore also sends background-capable push notifications. Lumiverse suppresses background pushes while the app is visible; in-app toasts remain the immediate foreground feedback.
- **Editable automatic scene records:** open any saved scene to edit its title, location, summary, cast, character positions, introduction status/context, events, dialogue, emotions, relationship changes, continuity and unresolved threads.
- **Cast appearance timeline:** each scene stores its cast, each character's explicit position within the scene, overall scene location, introduction flag and supporting introduction details. The Cast section now shows first confirmed introduction and a chronological list of appearances.
- **Continuity-safe prompting:** the scene prompt tells the AI not to infer a first introduction from a name mention and not to invent a character's exact position when it is not stated. Unknown details remain blank and can be edited later.
- **Archive consistency:** editing or deleting a scene rebuilds the per-chat Cast index from the saved scene records, so appearance histories stay in sync.

## Included 0.3.4 fix

- **Operator-scoped AI generation:** both `spindle.generate.raw()` (separately selected connection) and `spindle.generate.quiet()` (current connection) receive the originating `userId` in the request object. This fixes the `userId is required for operator-scoped extensions` failure when recording a recent scene.

## Included 0.3.3 fixes

- Active-chat lookups receive the originating Lumiverse `userId`, including the click-time lookup used by Record recent scene.
- Scenes, notes, captured messages and connection preferences use `spindle.userStorage` with an explicit user ID.
- Saved connection lookup and note-photo upload receive the originating `userId`.
- Sent, edited and deleted message events preserve their user context.
- Backend replies fail closed rather than broadcasting private archive contents when Lumiverse does not provide a valid user ID.

## Included features

- Separate per-chat scene archives and notes, plus a personal notebook available from the Lumiverse home screen.
- Current active Lumiverse connection or a separately selected saved connection for scene analysis.
- Rich notes: paragraph styles, headings, quotes, bold, italic, underline, clear formatting, pixel font sizes, text colour, highlight, bullet and numbered lists.
- Photo import, browser-side image compression and image asset upload through the Spindle Images API.
- Autosave and editable/deletable notes.
- Touch-friendly text selection and sizing, writing-area resizing, and floating panel resizing.

## Repository layout

```text
spindle.json
README.md
src/
  backend.js
  frontend.js
dist/
  backend.js
  frontend.js
tests/
  test_backend.cjs
```

The manifest loads the ready-to-run JavaScript from `dist/`. Keep each `src/` file and its matching `dist/` file identical.

## Permissions

The manifest requests `ui_panels`, `generation`, `chats`, `chat_mutation`, `images` and `push_notification`. `chat_mutation` is used to read the current chat transcript; Evermore does not call chat edit or delete methods. `images` is used to save imported note photos. `push_notification` is optional for background/device notifications; in-app toasts work without it. Users must explicitly grant the push permission from the Extensions panel and enable a push destination in Lumiverse Settings. Per-user storage and backend messaging are free-tier capabilities. Lumiverse may ask you to approve the new permission after updating.

## Install / update

Install the ZIP through the Lumiverse / Spindle extension installer using the included `spindle.json` manifest. For a repository-based install, use: https://github.com/Makiniko67/Evermore

## Verification and limits

- JavaScript syntax checks are run on all four JavaScript files.
- Manifest JSON validity, `src/`/`dist/` byte parity, and ZIP integrity are checked.
- `tests/test_backend.cjs` runs a mocked Spindle workflow covering active-chat resolution, transcript reading, current and separately selected AI routes, per-user settings/archives, notes, image upload, event isolation, missing-user fail-closed behavior, explicit `userId` propagation, scene-start/complete notifications, scene edits and cast-index rebuilding.
- Mocked tests do **not** replace a live test inside Lumiverse. The actual account permissions, chat/provider configuration, runtime callback context and mobile host behavior must still be confirmed in the user's Lumiverse runtime.

**Legacy archive note:** Evermore 0.3.2 and earlier stored data in shared extension storage without recording an owner account. The 0.3.3+ per-user archive intentionally does not migrate those records because it cannot prove which account owns them.

Automatic scene-boundary detection, shared cross-chat character profiles, archive search and export are not implemented. Introduction tracking depends on the AI correctly identifying explicit introductions in the selected excerpt; edit the scene record to correct uncertain details. Existing pre-0.4.0 records are upgraded in place when they are next edited or a new scene is recorded; their older per-character position and introduction details cannot be reconstructed retroactively from metadata alone. Do not commit API keys, access tokens or private roleplay logs.
