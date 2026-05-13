---
icon: material/import
hidden: true
---

Reads events from Logstash's `tcp` output as newline-delimited JSON — TCP on every OS, or a Unix domain socket on Linux/macOS (Logstash's `unix` output plugin).

Each event from Logstash arrives as a JSON record (`codec => json_lines`). The input pulls out:

- The actual log line from the **`message`** field (configurable via `logstashMessageField`) — becomes the event's `text`, the input to every message-content enrichment downstream.
- The **`tag`** field stamped by Logstash's ingest pipeline — becomes the event's `source`, used for rate-based grouping inside Log10x and as the outgoing record tag when events are sent back to Logstash. The field name is fixed (`tag`); the recipe's `mutate { add_field => { "tag" => "..." } }` filter writes it.
- The **`kubernetes.*`** sub-object, when present and the Receiver app has `k8sExtractorName: fluentK8s` — materialized as pod/container metadata fields on the event.

The full record is preserved on the event's `fullText`, so destinations that want the verbatim event still receive it intact.

The matching Logstash output config:

```ruby
output {
  tcp {
    host  => "127.0.0.1"
    port  => 5044                    # or use `unix { path => "..." }` on Linux/macOS
    codec => json_lines
  }
}
```
