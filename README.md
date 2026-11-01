# Evermore 0.3 — Story Journal

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## New in 0.3

- Reads Lumiverse's actual active LLM profile through `ctx.connections.getActive()` and listens for profile changes through `ctx.connections.subscribe()`.
- Scene recording has two explicit modes: use the current Lumiverse connection (`generate.quiet`) or choose a different saved profile (`generate.raw` with its connection ID).
- Connection preference is stored in extension storage and can be managed from both Scenes and Settings.
- Manual notebook pages now have a rich-text editor: paragraph, headings, subheadings, quote, bold, italic, underline, clear formatting, font size, text colour, highlight colour, bullet lists and numbered lists.
- Notes support imported photos. Images are resized/compressed in the browser, uploaded through the Spindle Images API and tagged to the current chat.
- Note content and formatting auto-save while typing. Saved notes retain rich formatting and image references.
- Writing area can be resized by dragging its lower-right corner or using height controls. Expand opens a larger writing surface; Restore returns to the normal journal size.
- Existing plain-text notes remain readable and editable.

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

The manifest points to the ready-to-load `dist/` entry points. Keep `src/` and `dist/` versions in sync when editing the extension.

## Install / update

In Lumiverse, open Settings → Extensions and install or update from:

`https://github.com/Makiniko67/Evermore`

When Lumiverse asks for permissions, grant `images` to enable photo insertion. The other declared permissions remain `ui_panels`, `generation`, and `chats`. Image uploads are saved in Lumiverse's image asset store and tagged to the current chat and Evermore extension.

## Notes

- Message capture starts when the extension backend is running; old chat history is not backfilled automatically.
- Scene recording remains user-triggered. Automatic scene-boundary detection is not included in this version.
- Each roleplay chat has its own archive. Shared cross-chat character profiles, cross-chat search and archive export are not included yet.
- The extension has not been live-tested inside the user's Lumiverse instance. Host rendering, API compatibility, image permission approval and mobile behaviour still need verification after installation.
- Do not commit API keys, access tokens, private roleplay logs or other secrets.
