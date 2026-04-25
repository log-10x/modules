---
icon: simple/fluentbit
---

Runs the 10x Engine as a [forwarder sidecar](https://doc.log10x.com/engine/launcher/sidecar) to process collected log events _before_ they ship to output destinations (e.g., Splunk, Elasticsearch, S3).

The design enables 10x apps — the [Reporter](https://doc.log10x.com/apps/reporter/) (DaemonSet alongside the forwarder) and the [Reducer](https://doc.log10x.com/apps/reducer/) (sidecar, Filter and [Compact](https://doc.log10x.com/apps/reducer/#compact) modes) — to process events at the source while integrating with existing log forwarders (e.g., Fluentd/Bit).

### :material-toy-brick-outline: Extensibility

All forwarder input [modules](https://doc.log10x.com/engine/module/) utilize core IPC I/O modules (e.g., [stdin](https://doc.log10x.com/run/input/stdin), [Unix](https://doc.log10x.com/run/output/event/unix))
as building blocks for integrating with bundled forwarders (e.g., Fluentd/Bit) and to serve as a reference for supporting additional forwarder types.
