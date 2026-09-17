---
'@finos/legend-lego': patch
'@finos/legend-application-marketplace': patch
---

Route the Agents tab zero-row retry through the shared SQL execution chokepoint, so a corrected query is sanitized, row-bounded and timed out like every other execution.
