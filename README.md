# Evermore 0.3.2 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## 0.3.2 fixes

- **Scene recording resolves the active chat at click time** using `spindle.chats.getActive()` rather than trusting a floating panel's cached chat ID.
- **Transcript reads use the documented Chat Mutation API** (`spindle.chat.getMessages`) with a bounded recent-message read. Older hosts are retried using the one-argument API; captured-message fallback is used if a transcript read fails but message events were already captured.
- **More informative scene errors:** active-chat, permission/history, provider-generation and invalid-AI-response failures now return an explicit message rather than silently failing.
- **Text sizing works on touchscreens:** the editor remembers the last text selection before toolbar focus changes. Selected text is wrapped in a pixel-sized span; with no selection, the size becomes the default for the whole note and new typing.
- **Drag-to-resize the writing area:** a visible lower-corner grip works with pointer/touch dragging. The existing − / + height controls remain available.
- **Drag-to-resize the Evermore panel:** a second lower-corner grip adjusts the floating widget bounds using `widget.setSize()`.

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

The manifest requests `ui_panels`, `generation`, `chats`, `chat_mutation` and `images`. `chat_mutation` is used to read the current chat transcript; Evermore does not call chat edit or delete methods. `images` is used to save imported note photos. Lumiverse may ask you to approve permissions after an update.

## Update

In Lumiverse, update the extension from the repository:

`https://github.com/Makiniko67/Evermore`

If you upload files manually, replace `spindle.json`, `README.md`, `src/backend.js`, `src/frontend.js`, `dist/backend.js` and `dist/frontend.js`.

## Test status and limits

- JavaScript syntax checks, manifest validation, source/distribution parity and ZIP integrity are checked locally.
- Backend workflow tests mock the Spindle APIs and validate live-active-chat resolution, transcript reading, both AI connection routes, personal notes and image uploads.
- Browser tests exercise the editor controls and drag handles in Chromium with a mocked host. These tests do **not** replace a live test inside the user's Lumiverse account; actual account permissions, current chat/provider configuration and mobile host rendering still require that check.
- Automatic scene-boundary detection, shared cross-chat character profiles, archive search and export are not implemented.

Do not commit API keys, access tokens or private roleplay logs.
