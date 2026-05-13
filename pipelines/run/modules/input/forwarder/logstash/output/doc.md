---
icon: material/export
hidden: true
---

Sends processed events back to Logstash as newline-delimited JSON over a TCP socket — Logstash consumes this on the receiving side via the [`tcp`](https://www.elastic.co/guide/en/logstash/current/plugins-inputs-tcp.html) input plugin with `codec => json_lines`.

Each event leaves Log10x as a single JSON object on its own line — every field from the inbound record is preserved verbatim, so destinations downstream see the same record structure they would without Log10x in the path. The Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether a symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:5045` so it pairs with the [input](../input/) listening on `:5044`. Override the destination with `logstashOutputHost` / `logstashOutputPort`.

The matching Logstash input config (place it in a separate pipeline so destination outputs route the processed events without the ingest filters firing a second time):

```ruby
input {
  tcp {
    host  => "0.0.0.0"
    port  => 5045
    codec => json_lines
  }
}
```
