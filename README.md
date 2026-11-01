# Evermore 0.3.3 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## 0.3.3 fixes

- **Operator-scoped chat context:** active-chat lookups now receive the originating Lumiverse `userId`, including the click-time lookup used by Record recent scene.
- **Per-user archives and settings:** scenes, notes, captured messages and connection preferences now use `spindle.userStorage` with an explicit user ID instead of globally shared extension storage.
- **User-aware connection and image operations:** saved connection lookup and note-photo upload now receive the originating `userId`.
- **Event capture isolation:** sent, edited and deleted message events pass the event's user context into the account's private archive.
- **Private response routing:** backend replies refuse to broadcast archive contents when Lumiverse does not provide a valid user ID.

**Legacy archive note:** 0.3.2 and earlier stored data in shared extension storage without an account owner marker. 0.3.3 leaves those records untouched rather than assigning potentially shared data to a particular account. They are not automatically migrated.

## 0.3.2 fixes

- **Scene recording resolves the active chat at click time** rather than trusting a floating panel's cached chat ID.
- **Transcript reads use the Chat Mutation API** (`spindle.chat.getMessages`) with a bounded recent-message read. Older hosts are retried using the one-argument API; captured-message fallback is used if a transcript read fails but message events were already captured.
- **More informative scene errors:** active-chat, permission/history, provider-generation and invalid-AI-response failures return explicit messages.
- **Text sizing works on touchscreens:** the editor remembers the last text selection before toolbar focus changes.
- **Drag-to-resize the writing area:** the lower-corner grip works with pointer/touch dragging.
- **Drag-to-resize the Evermore panel:** a second lower-corner grip adjusts the floating widget bounds.

## Included features

- Separate per-chat scene archives and notes, plus a personal notebook available from the Lumiverse home screen.
- Current active Lumiverse connection or a separately selected saved connection for scene analysis.
- Rich notes: paragraph styles, headings, quotes, bold, italic, underline, clear formatting, pixel font sizes, text colour, highlight, bullet and numbered lists.
- Photo import, browser-side image compression and image asset upload through the Spindle Images API.
- Autosave and editable/deletable notes.

## Repository layout

```text
spindle.json
src/
  backend.js
  frontend.js
dist/
  backend.js
  frontend.js
README.md
```

The manifest loads the ready-to-run JavaScript from `dist/`. Keep each `src/` file and its matching `dist/` file identical.

## Permissions

The manifest requests only `ui_panels`, `generation`, `chats`, `chat_mutation` and `images`. `chat_mutation` is used to read the current chat transcript; Evermore does not call chat edit or delete methods. `images` is used to save imported note photos. Per-user storage and backend messaging are free-tier capabilities and do not require extra permissions. Lumiverse may ask you to approve permissions after an update.

## Update

In Lumiverse, update the extension from the repository:

`https://github.com/Makiniko67/Evermore`

For a manual update, replace `spindle.json`, `README.md`, `src/backend.js` and `dist/backend.js`. The 0.3.2 frontend files do not change in this patch.

## Verification and limits

- JavaScript syntax, manifest validity, source/distribution parity and ZIP integrity are checked locally.
- The backend test harness mocks Spindle APIs and checks active-chat resolution, transcript reading, both AI connection routes, notes, image uploads, message events and account isolation.
- Mocked tests do **not** replace a live test inside Lumiverse. The actual account permissions, chat/provider configuration, event callback context and mobile host behavior must still be confirmed in the user's Lumiverse runtime.
- Automatic scene-boundary detection, shared cross-chat character profiles, archive search and export are not implemented.

Do not commit API keys, access tokens or private roleplay logs.
