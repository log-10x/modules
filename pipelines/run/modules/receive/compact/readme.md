## 1️⃣0️⃣❎ Compact receiver module

Per-event compaction decision via a declarative field-set keyed lookup file. Decides whether each event is emitted via encode() (compact templateHash+vars form, ~20-40x volume reduction) or as fullText. GitOps-controlled — the MCP writes entries via PR, engine hot-reloads the lookup without restart.

To learn more see the compact receiver [module documentation](https://doc.log10x.com/run/receive/compact "Per-event compaction decision via a declarative field-set keyed lookup file. Decides whether each event is emitted via encode() (compact templateHash+vars form, ~20-40x volume reduction) or as fullText. GitOps-controlled — the MCP writes entries via PR, engine hot-reloads the lookup without restart.").

