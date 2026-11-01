# Evermore 0.3.4 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## 0.3.4 fix

- **Operator-scoped AI generation:** both `spindle.generate.raw()` (separately selected connection) and `spindle.generate.quiet()` (current connection) now receive the originating `userId` in the request object. This fixes the `userId is required for operator-scoped extensions` failure when recording a recent scene.
- The backend test harness now asserts that both generation routes receive the correct account ID.

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

The manifest requests only `ui_panels`, `generation`, `chats`, `chat_mutation` and `images`. `chat_mutation` is used to read the current chat transcript; Evermore does not call chat edit or delete methods. `images` is used to save imported note photos. Per-user storage and backend messaging are free-tier capabilities and do not require extra permissions. Lumiverse may ask you to approve permissions after an update.

## Install / update

Install the ZIP through the Lumiverse / Spindle extension installer using the included `spindle.json` manifest. For a repository-based install, use: https://github.com/Makiniko67/Evermore

## Verification and limits

- JavaScript syntax checks are run on all four JavaScript files.
- Manifest JSON validity, `src/`/`dist/` byte parity, and ZIP integrity are checked.
- `tests/test_backend.cjs` runs a mocked Spindle workflow covering active-chat resolution, transcript reading, current and separately selected AI routes, per-user settings/archives, notes, image upload, event isolation, missing-user fail-closed behavior, and explicit `userId` propagation to both generation methods.
- Mocked tests do **not** replace a live test inside Lumiverse. The actual account permissions, chat/provider configuration, runtime callback context and mobile host behavior must still be confirmed in the user's Lumiverse runtime.

**Legacy archive note:** Evermore 0.3.2 and earlier stored data in shared extension storage without recording an owner account. The 0.3.3+ per-user archive intentionally does not migrate those records because it cannot prove which account owns them.

Automatic scene-boundary detection, shared cross-chat character profiles, archive search and export are not implemented. Do not commit API keys, access tokens or private roleplay logs.
