---
'@finos/legend-application-marketplace': patch
---

Render the Agents tab answers with the shared `LegendAIAssistantMessageView` instead of a forked copy. The tab picks up the shared wording and layout: `Generated SQL` rather than `Generated Query`, `Try a data query:` rather than `Follow-up questions:`, the fallback action after the suggestions rather than before the results, answers split on their metadata and analysis headings, and the artifact actions offered whenever a query produced SQL rather than only when it returned rows.

Two fixes found while reviewing that convergence. A Python codegen request that the plugin cannot translate now reports a retryable error again, rather than the terminal "not available for this data source" line, which is reserved for a product whose services never support codegen. And the Launch Notebook action keeps its Python accent on this surface: the shared button class the action moved onto ties on specificity with a generic page-level rule, which won on load order and rendered it grey.
