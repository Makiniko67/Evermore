# Evermore 0.2 — Story Journal preview

A mobile-first, dark-lavender soft-coquette roleplay archive for Lumiverse / Spindle.

## What this build contains

- A compact draggable floating launcher that expands into a bounded journal panel sized to the available viewport.
- A dedicated journal surface with separate Scenes, Cast, Notes and Settings pages.
- Styles contained inside the widget root; no global page styling or page-level DOM injection.
- Per-chat private archive storage, message capture, message edit/delete synchronization, manual AI scene recording, and editable/deletable notebook notes.
- AI scene records include events, dialogue, emotions, relationship changes, continuity and unresolved threads. Possible inferences are explicitly labelled in the prompt rather than silently treated as canon.
- The active Lumiverse connection or a separately selected connection can be used for scene analysis.
- Unsaved note drafts are retained in the frontend session if the journal is closed and reopened.

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

The `dist/` files are the ready-to-load JavaScript entry points referenced by the manifest. The `src/` files are the editable source copies in this preview; keep the matching `dist/` files in sync when changing code.

## Install

In Lumiverse, open Settings → Extensions and use this repository URL:

`https://github.com/Makiniko67/Evermore`

The manifest points to `dist/backend.js` and `dist/frontend.js`. The extension requests only `ui_panels`, `generation` and `chats` permissions. It does not request `chat_mutation`; messages are recorded from lifecycle events rather than fetched from the chat history.

## Behaviour and limitations

- Message capture is automatic once the extension backend is running. Existing chat history is not backfilled by this build.
- Scene recording is currently user-triggered; Evermore does not yet decide scene boundaries or schedule AI summaries automatically.
- Character records are currently per chat. Shared cross-chat character profiles, cross-chat search, export and archive import are not implemented in this build.
- The frontend has not been tested inside the user's Lumiverse instance. Host compatibility, visual sizing, and event payload handling still require a live installation test. Test first in a disposable roleplay chat.
- This repository is public. Do not commit API keys, access tokens, private roleplay logs, or other secrets.

## Storage and AI privacy

Archives are written to Lumiverse's extension-scoped private storage, with one archive per chat. Manual AI analysis sends the most recent captured messages to the chosen Lumiverse connection. Review the provider's data handling settings before using sensitive conversations.
