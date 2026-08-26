---
'@finos/legend-application-data-cube': patch
'@finos/legend-data-cube': patch
---

Add loading feedback for previously-silent DataCube engine calls: validating or loading a column expression, validating a freeform TDS query while creating a DataCube, and updating query parameters on an existing DataCube's source now register a task so the status bar reflects progress. Fix the status bar only showing tasks owned by the current view, which silently hid tasks registered by sibling scopes sharing the same task manager (e.g. save/delete DataCube). Make several DataCube widgets easier to understand: rename "Load DataCube" to "Open DataCube", and add tooltips across the header buttons, hamburger menu, New DataCube source-type picker, and Save dialog. Add an accessible label to the previously unlabeled hamburger menu button.
