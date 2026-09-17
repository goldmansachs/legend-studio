---
'@finos/legend-lego': patch
---

Reuse `accessPointCalls`, `escapeRegExp` and `uniq` in the Legend AI stores instead of re-implementing them, which also fixes multi-turn access point scoring matching calls such as `map('x')`.
