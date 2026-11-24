---
description: Drama Brain. Record a correction as a lesson on a card
argument-hint: <what went wrong, and the rule> --card <name>
---
Record this correction with the Bash tool:

    /usr/bin/python3 ~/drama-brain/brain.py lesson "<what went wrong, and the rule>" --card <name>

Correction: $ARGUMENTS

Write it in plain English, short sentences, no em dashes. If no card was named, pick the card that fits (`brain.py cards` lists them). On Windows use `python %USERPROFILE%\drama-brain\brain.py` instead.
