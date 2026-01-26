---
icon: material/heart-cog-outline
---

Logs diagnostics and publishes health metrics from pipeline [units](https://doc.log10x.com/engine/pipeline/#units).

Each unit emits counters (scanned symbols, input events) and states (scan errors), periodically logged and published to the [10x Prometheus endpoint](https://doc.log10x.com/run/output/metric/log10x/).
