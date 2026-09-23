---
'@finos/legend-lego': patch
---

Drop four exported wrappers in the grid analysis helpers that no production code called. `computeKeyMetrics`, `inferChartType`, `computeChartData` and `findNumericColumnName` each profiled the grid a second time and forwarded to a private `*FromProfiles` helper, while `analyzeGridData` — the only entry point the analysis panel uses — already calls all four off one shared profiling pass. Their tests now exercise `analyzeGridData`, so the suite covers the path that actually ships.

Two of those tests asserted an empty chart data array against the ungated wrapper. `analyzeGridData` returns an empty array whenever the chart type is `NONE`, which would have made them pass for the wrong reason, so both now assert the chart type as well.
