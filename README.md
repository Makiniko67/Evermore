# Evermore 0.1 — Lumiverse prototype

A soft-coquette, dark-lavender floating story journal for Lumiverse / Spindle.

## Included in this prototype
- Floating ✧ launcher and responsive journal panel.
- Scenes, character gallery, notebook, and settings views.
- Per-chat private extension storage.
- Message event capture (`MESSAGE_SENT`) plus read-only history sync after assistant messages render (`CHARACTER_MESSAGE_RENDERED`).
- Manual AI scene analysis using either the active chat connection (`quiet`) or a selected separate connection (`raw`).
- Editable and deletable notes.

## Important prototype limitations
- Automatic message capture is implemented; automatic scene-boundary detection and scheduled AI summarization are not yet implemented.
- The separate AI mode uses a connection picker populated from Lumiverse connection profiles.
- Shared cross-chat character library, cross-chat search, timeline filters, and export are planned, not implemented.
- Test on a disposable roleplay chat first. This version stores captured message text in Evermore's private extension storage.
- `MESSAGE_SENT` payloads can vary by Lumiverse build; verify captured roles/content in your installation before relying on the archive.

## Install / develop
1. Replace `YOUR_USERNAME` in `spindle.json` with your GitHub username/repository after publishing the source.
2. Zip the repository or publish it to GitHub.
3. In Lumiverse, open Settings → Extensions and install the repository URL.
4. Grant `ui_panels`, `generation`, and `chat_mutation` only when prompted. (The current prototype uses `ui_panels`, `generation`, `chats`, and `chat_mutation`.)
5. Open a roleplay chat, send a few messages, tap the floating ✧ button, then use **Record recent scene**.
6. Add/edit notes in Notebook.

## Source layout
- `spindle.json` — extension manifest
- `src/backend.js` — event capture, storage and AI analysis RPC
- `src/frontend.js` — floating coquette interface

## Privacy
No external server is included. AI analysis uses the Lumiverse connection selected by the user. Do not use on sensitive chats until you have reviewed your provider's data handling settings.

## AI mode note
“Use active Lumiverse connection” uses Spindle `generate.quiet`, documented as using the user's active connection profile. It is not guaranteed to be the exact connection used by an individual chat. The alternate mode selects a connection profile and calls `generate.raw`.
