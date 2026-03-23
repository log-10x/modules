---
icon: material/chart-bar
---

Generates a shareable [Log10x Console](https://console.log10x.com) URL from [dev app](https://doc.log10x.com/apps/dev/) analysis results.

When the pipeline completes, this output builds a compact JSON payload from aggregated [TenXSummary](https://doc.log10x.com/api/js/#TenXSummary) data,
[templates](https://doc.log10x.com/run/template/) and [encoded](https://doc.log10x.com/api/js/#TenXObject+encode) events,
then compresses it into a URL that opens the Console with cost analysis, top patterns and volume reduction proof.

## How It Works

Two output entries share a single `DevOutputStream` instance via the [group](https://doc.log10x.com/run/output/event/file/#outputfileencodetype) mechanism:

1. **Summary** (`isSummary`) — receives aggregated [enrichment fields](https://doc.log10x.com/run/initialize/#enrichmentFields) with [summaryVolume](https://doc.log10x.com/api/js/#TenXSummary+summaryVolume) and [summaryBytes](https://doc.log10x.com/api/js/#TenXSummary+summaryBytes)
2. **Event** (`isObject || isEncoded`) — receives [templateHash](https://doc.log10x.com/api/js/#TenXBaseObject+templateHash), [template](https://doc.log10x.com/api/js/#TenXBaseObject+template) body and [encode()](https://doc.log10x.com/api/js/#TenXObject+encode) values

On close, the stream produces:

- A console URL with the analysis embedded (printed to console)
- Optionally auto-opens the URL in the default browser
- Optionally writes the raw JSON to a file

Memory usage is bounded by the number of unique templates, not the number of events.
