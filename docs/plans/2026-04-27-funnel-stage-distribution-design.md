# Funnel Stage Distribution Design

**Goal:** Add a factual stage-transition distribution report below the funnel throughput chart.

**Architecture:** The web scene should render the new report from the existing TOC flow payload shape plus optional transition data when the API adds it. The UI must not change Bitrix sync, SQLite persistence, or API query behavior in this branch. Until transition edges are supplied by the backend, the live mapper will expose an empty distribution and the static prototype fallback will show sample data.

**Semantics:** The report uses deals created in the selected period and filtered managers. It shows actual stage-history transitions only. If a deal jumps from one stage directly to another, the report draws the direct transition and does not fill skipped stages.

**Display:** Render a new panel under "Пропускная способность и очереди" titled "Распределение этапов воронки". Nodes show stage name, deal count, and conversion percentage from the previous source. Edges show direct source-to-target percentages and should visually vary by volume.

**Testing:** Add a web test that opens "Движение по воронке" and asserts that the distribution report renders below the throughput report with a direct jump edge.
