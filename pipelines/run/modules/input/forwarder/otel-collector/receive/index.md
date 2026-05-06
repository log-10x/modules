---
icon: material/filter
---

# OpenTelemetry Collector Receiver

Read events from an OpenTelemetry Collector forwarder, apply filter policies to filter events, and write filtered events back to OTel Collector.

This module is a component of the [Receiver](https://doc.log10x.com/apps/receiver/) app.

## Overview

The OpenTelemetry Collector Receiver configures:

- A TCP JSON input stream (port 4318 default) to receive events
- Filter policies based on rules
- A Unix socket output to write filtered events back to OTel Collector

## Installation

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Receiver OpenTelemetry Collector [run instructions](https://doc.log10x.com/apps/receiver/run/#otel-collector)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Receiver OpenTelemetry Collector [deployment instructions](https://doc.log10x.com/apps/receiver/deploy/#otel-collector)

## Configuration

See [config.yaml](config.yaml) for the default Receiver configuration.

## Event Flow

```
OTel Collector → TCP JSON (4318) → Log10x Receiver → Unix Socket → OTel Collector → Exporters
```

1. OTel Collector sends events via TCP JSON to Log10x
2. Log10x applies filter policies (rate limiting, filtering)
3. Filtered events are written back via Unix socket
4. OTel Collector forwards filtered events to final destinations

## Related

- [OpenTelemetry Collector Reporter](../report/index.md)
- [OpenTelemetry Collector Optimizer](../optimize/index.md)
- [rate receiver](https://doc.log10x.com/run/receive/rate/)

