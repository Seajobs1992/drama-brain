---
name: tools
title: Working on the extensions, scripts and the brain
order: 80
keywords: extension, popup, runner code, build_jobs, script bug, chrome, browser storage, disk space, brain, hook, mcp, install
---
- Flow runner extension: guide in doc `flow-guide`; the project file says where the tool lives. After a script or frame change, rebuild the job list, reload the extension, and confirm the page's version stamp before any paid run.
- Per-clip corrections live in the episode's `flow-fixes.json`: `prompt`, `alt`, `seconds`, `cast`, `frame`, `mode` ("frames"), `extra` (prop pictures), and `frame <id>` entries for image jobs. Every entry carries a `why`.
- New site to automate: map its controls read-only first, test "fill" without generating, leave the Generate click to the user.
- Flow runs in its own Chrome profile. Never sign out, change credentials or touch the user's other sign-ins.
- "FILE_ERROR_NO_SPACE" in Chrome means the disk is full: clear that Chrome's cache (cache only, not site data) and keep big files on an external drive.
- Keep the tool's guide current when its behaviour changes.

**The brain itself**
- General rules live in `CORE.md` and `cards/`. Movie facts live in each movie's `BRAIN-PROJECT.md`. Never put one movie's facts in a general card.
- Keep each card under about 600 tokens: `brain.py budget`. Health check: `brain.py doctor`.
- New lesson: `brain.py lesson`. New general document: copy it into `library/` and add it to `docs.json`.
- New movie: `brain.py new-project "<folder>" "<Name>"`. New computer: copy the brain folder, then `python3 brain.py install`.
- Only the user turns the gate off, by creating a file named `OFF` in the brain folder.
