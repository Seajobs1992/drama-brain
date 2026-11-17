---
name: review
title: When the user reports a problem or asks why
order: 70
keywords: why, wrong, rubbish, terrible, bad, mistake, problem, issue, bug, not right, doesnt match, doesn't match, fix, check, review, compare, different
---
- Look before you answer. Open the actual files, make a contact sheet, put the output beside its reference. Do not answer from memory.
- Check the rules first: `brain.py find "<words>"`. If the rule exists, say so: the failure was yours, not a gap in the rules.
- Answer plainly: what is wrong, where (shot IDs), why it happened, and whether it was your prompt, your check, or the tool.
- A complaint or a question is not an order to regenerate. Report and wait. When the user says fix it, fix everything they named, one take each, verify each, then report.
- Name every other fault you found while looking, even ones they did not mention.
- Never defend an output because it was "approved earlier". The latest correction wins.
- After fixing: `brain.py lesson "<what went wrong, and the rule>" --card <name>`, so the same mistake is blocked next time for Claude and Codex both.
