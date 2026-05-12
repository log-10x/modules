---
icon: simple/vector
hidden: true
---

Sends processed events back to Vector over the [Fluent Forward protocol](https://docs.fluentd.org/output/forward) — Vector consumes this on the receiving side via its [`fluent` source](https://vector.dev/docs/reference/configuration/sources/fluent/) (TCP on every OS, or a Unix domain socket on Linux/macOS).

Each event leaves Log10x with the tag stamped on the way in restored on the Forward wire — destinations that route on the tag (Splunk index, S3 path, Kafka topic, …) behave the same as if Log10x weren't in the path. The record body preserves every field that came in from Vector; the Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether a symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:9001` so it pairs with the [input](../input/) listening on `:9000`. Override the destination with `vectorOutputHost` / `vectorOutputPort`, or `vectorOutputPath` for a Unix domain socket on Linux/macOS.

The matching Vector source config:

```yaml
sources:
  tenx_out:
    type: fluent
    mode: tcp                      # or unix on Linux/macOS
    address: 0.0.0.0:9001          # or path: /tmp/tenx-vector-out.sock
```
