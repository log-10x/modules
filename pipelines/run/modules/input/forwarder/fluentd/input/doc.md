---
icon: material/import
hidden: true
---

Reads events from Fluentd over the [Fluent Forward protocol](https://docs.fluentd.org/output/forward) — TCP on Windows, TCP or Unix domain socket on Linux/macOS.

Each event from Fluentd arrives as a JSON record. The input pulls out:

- The actual log line from the **`log`** field (configurable via `fluentdMessageField`) — becomes the event's `text`, the input to every message-content enrichment downstream.
- The **Fluentd tag** carried on the Forward wire — becomes the event's `source`, used for rate-based grouping inside Log10x and as the outgoing tag when events are sent back to Fluentd.
- The **`kubernetes.*`** sub-object, when present and the Receiver app has `k8sExtractorName: fluentK8s` — materialized as pod/container metadata fields on the event.

The full record is preserved on the event's `fullText`, so destinations that want the verbatim event still receive it intact.
