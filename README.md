# Evermore 0.3.1 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## Fixes and features in 0.3.1

- **Personal notebook on the home screen:** New Page, editing, autosaving and deleting notes work even when no roleplay chat is open. These pages are stored in a separate personal notebook.
- **Separate per-chat archives:** When a roleplay chat is active, notes and scene records remain scoped to that chat.
- **Scene recording from existing history:** When Record recent scene is pressed, Evermore reads the current chat transcript using `spindle.chat.getMessages()` rather than relying only on messages captured after the extension was installed.
- **AI connection choice:** Use Lumiverse's current active connection with `spindle.generate.quiet()`, or choose a saved connection profile and call `spindle.generate.raw()` with that profile ID. The active connection is read via the documented frontend connection-profile API.
- **Rich manual notes:** Paragraphs, headings, subheadings, quotes, bold, italic, underline, clear formatting, font sizes, text colours, highlights, bullet lists and numbered lists.
- **Photos:** Select images from the device, compress them in the browser, upload through the Spindle Images API and preserve the resulting image reference in the note. Home-screen personal notebook images are not tagged to a chat; chat notes are.
- **Writing-area sizing:** Resize the writing box vertically using the lower corner where supported or the − / + height controls. Expand opens a larger writing view; Restore returns to the journal.
- **Plain-text notes from older builds:** Existing note bodies remain readable and editable.

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

The manifest loads the ready-to-run JavaScript from `dist/`. The matching `src/` files are the editable copies. Keep each `src/` file and its matching `dist/` file identical when updating code.

## Permissions

The manifest requests `ui_panels`, `generation`, `chats`, `chat_mutation` and `images`.

- `chat_mutation` is used to **read** the existing chat transcript via `spindle.chat.getMessages()` when the user asks Evermore to record a scene. Lumiverse groups message reading under this permission, which also technically exposes message-modification APIs. Evermore's code does not call any chat-message edit or delete method.
- `images` is used to upload note photos to Lumiverse's image asset store.
- `generation` is used for scene analysis with either the current or a separately selected AI connection.

## Install / update

In Lumiverse, open Settings → Extensions and install or update from:

`https://github.com/Makiniko67/Evermore`

Approve the manifest permissions when Lumiverse prompts. If Lumiverse does not grant `chat_mutation`, Evermore cannot backfill older chat messages for scene recording; it will show the relevant error rather than silently creating an empty scene.

## Limitations and test status

- Scene recording is manually triggered. Automatic scene-boundary detection is not included.
- Shared cross-chat character profiles, cross-chat search and archive export are not included.
- The package has been checked locally with JavaScript syntax checks, manifest validation, archive/source parity checks, and mocked Lumiverse backend workflow tests for home-note creation, image uploads, transcript sync, and both AI connection routes. It still needs a live installation check inside Lumiverse for host UI rendering, actual account permissions and provider responses.
- Do not commit API keys, access tokens, private roleplay logs or other secrets.
