---
name: tools
title: Working on the extensions, scripts and the brain
order: 80
keywords: extension, popup, runner code, build_jobs, script bug, chrome, browser storage, disk space, brain, hook, mcp, install
---
- Flow runner extension: its code travels in the brain at `tools/flow-runner`, guide in doc `flow-guide`. The working copy loaded in Chrome is named in `mirrors.json`: change that one, and `sync` copies it into the brain. The `jobs` folder (the movie's frames and prompts) is built per computer and never synced.
- After a script or frame change, rebuild the job list (`build_jobs.py "<movie folder>"`), reload the extension, and confirm the page's version stamp before any paid run.
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

## Learned the hard way
- 2026-11-17: Told the user the brain was complete when the Flow runner extension was not in it, only its guide. When packaging the workflow for another computer, list every tool the workflow needs and say plainly which ones are included and which are not.
- 2026-11-17: Built the brain for Mac only without asking what the other computer was; it was Windows, where the hook command and the skill link would have failed. Before packaging anything for another computer, ask which system it runs, and ship a self-test that proves it there.
- 2026-11-17: The extension uploaded the same start frame twice (EP03 3-15) because it checked only the ~16 tiles Flow shows on screen. Since 2026-11-17g uploadAsset first asks the picker's search, which sees the whole library. Also: one Flow project per episode keeps every search fast.
- 2026-11-20: Scripted clicks on an unlabelled menu button in the Storyboard tool opened 'Clear Project?' (2026-11-20, nothing lost: cancelled). Rule: in a tool with live work, only click controls found by their exact label; never click unlabelled icons or the last button in a header, and read a menu's items before choosing one.
- 2026-11-20: Flow's Tool Builder can drop backslashes when applying an upload: an escaped quote in a string broke the build (P9-A, 2026-11-20; it self-repaired with single quotes). Rule: code sent through Tool Builder uploads uses no backslash escapes; use other quotes or string methods instead of regex escapes where possible, and check each upload's new code for backslashes before sending.
- 2026-11-20: Automated testing of Flow's text writer from the creator's signed-in browser hit Google's 'unusual activity' limit after many requests in a short time (2026-11-20); test results were lost because the test saved only at the end. Rule: pace automated Flow requests, never hammer the creator's account, and save each result as soon as it exists.
