---
'@finos/legend-application-marketplace': patch
---

Render the Agents tab answers with the shared `LegendAIAssistantMessageView` instead of a forked copy. The tab picks up the shared wording and layout: `Generated SQL` rather than `Generated Query`, `Try a data query:` rather than `Follow-up questions:`, the fallback action after the suggestions rather than before the results, answers split on their metadata and analysis headings, and the artifact actions offered whenever a query produced SQL rather than only when it returned rows.
