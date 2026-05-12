---
icon: simple/fluentbit
hidden: true
---

Reads events from Fluent Bit over the [Fluent Forward protocol](https://docs.fluentbit.io/manual/pipeline/outputs/forward) — TCP on Windows, TCP or Unix domain socket on Linux/macOS.

Each event from Fluent Bit arrives as a JSON record. The input pulls out:

- The actual log line from the **`log`** field (configurable via `fluentbitMessageField`) — becomes the event's `text`, the input to every message-content enrichment downstream.
- The **Fluent Bit tag** carried on the Forward wire — becomes the event's `source`, used for rate-based grouping inside Log10x and as the outgoing tag when events are sent back to Fluent Bit.
- The **`kubernetes.*`** sub-object, when present and the Receiver app has `k8sExtractorName: fluentK8s` — materialized as pod/container metadata fields on the event.

The full record is preserved on the event's `fullText`, so destinations that want the verbatim event still receive it intact.
