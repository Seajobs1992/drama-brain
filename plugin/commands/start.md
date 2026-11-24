---
description: Drama Brain. Load the core rules and the card for a task
argument-hint: <task in a few words> [card ...]
---
Run this now with the Bash tool, before anything else, and follow what it prints:

    /usr/bin/python3 ~/drama-brain/brain.py start "<task>" [cards]

Task and any card names: $ARGUMENTS

Put the task words in the quotes and any card names after them. If no task was given, use the user's latest request in a few words. On Windows use `python %USERPROFILE%\drama-brain\brain.py` instead.
