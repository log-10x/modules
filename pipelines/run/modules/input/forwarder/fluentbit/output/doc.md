---
icon: simple/fluentbit
hidden: true
---

Sends processed events back to Fluent Bit over the [Fluent Forward protocol](https://docs.fluentbit.io/manual/pipeline/outputs/forward) — TCP on Windows, TCP or Unix domain socket on Linux/macOS.

Each event leaves Log10x with the original Fluent Bit **tag** restored on the Forward wire. On the Fluent Bit side the egress `[INPUT] Name forward` is configured with `Tag_Prefix tenx.`, which prepends `tenx.` to the returning tag — destinations that route on the suffix (Splunk index, S3 path, Kafka topic, …) behave the same as if Log10x weren't in the path, while filters and the ingest `forward` output (which `Match` on `app.*` / non-`tenx.*` patterns) skip the returning events by structure. The record body preserves every field that came in from Fluent Bit; the Receiver app's mode determines whether the message field stays verbatim or is replaced with a compacted encoded form, and whether a symbol-pattern hash field is added.

Defaults to TCP `127.0.0.1:24225` so it pairs with the [input](../input/) listening on `:24224`. Override the destination with `fluentbitOutputHost` / `fluentbitOutputPort`, or `fluentbitOutputPath` for a Unix domain socket on Linux/macOS.
