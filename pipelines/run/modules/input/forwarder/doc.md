---
icon: simple/fluentbit
---

Runs the 10x Engine [in-path](https://doc.log10x.com/engine/launcher/sidecar) with your log forwarder to process collected log events _before_ they ship to output destinations (e.g., Splunk, Elasticsearch, S3). Depending on the forwarder, 10x runs embedded in the forwarder image (Fluentd, Fluent Bit, Filebeat), as a separate sidecar container (Logstash, OTel Collector, Vector), or as a file relay (Splunk UF, Datadog Agent); only 3 of the 8 supported forwarders are genuine sidecars.

The design enables 10x apps, the [Reporter](https://doc.log10x.com/apps/reporter/) (read-only DaemonSet alongside the forwarder) and the [Receiver](https://doc.log10x.com/apps/receiver/) (embedded or sidecar per forwarder, with pass, sample, [compact](https://doc.log10x.com/apps/receiver/#compact), tier_down, offload, and drop actions plus read-only observation), to process events at the source while integrating with existing log forwarders (e.g., Fluentd/Bit).

### :material-toy-brick-outline: Extensibility

All forwarder input [modules](https://doc.log10x.com/engine/module/) utilize core IPC I/O modules (e.g., [stdin](https://doc.log10x.com/run/input/stdin), [Unix](https://doc.log10x.com/run/output/event/unix))
as building blocks for integrating with bundled forwarders (e.g., Fluentd/Bit) and to serve as a reference for supporting additional forwarder types.
