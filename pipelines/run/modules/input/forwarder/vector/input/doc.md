---
icon: material/import
hidden: true
---

Reads events from Vector's `socket` sink as newline-delimited JSON — TCP on every OS, or a Unix domain socket on Linux/macOS.

Each event from Vector arrives as a JSON record (`encoding.codec: json`, `framing.method: newline_delimited`). The input pulls out:

- The actual log line from the **`message`** field (configurable via `vectorMessageField`) — becomes the event's `text`, the input to every message-content enrichment downstream.
- The **`tag`** field stamped by Vector's ingest transform — becomes the event's `source`, used for rate-based grouping inside Log10x and as the outgoing Fluent Forward tag when events are sent back to Vector. The field name is fixed (`tag`); the recipe's `ingest` `remap` transform writes it.
- The **`kubernetes.*`** sub-object, when present and the Receiver app has `k8sExtractorName: fluentK8s` — materialized as pod/container metadata fields on the event.

The full record is preserved on the event's `fullText`, so destinations that want the verbatim event still receive it intact.

The matching Vector sink config:

```yaml
sinks:
  tenx_in:
    type: socket
    inputs: [ingest]
    mode: tcp                      # or unix on Linux/macOS
    address: 127.0.0.1:9000        # or path: /tmp/tenx-vector-in.sock
    encoding: { codec: json }
    framing: { method: newline_delimited }
```
