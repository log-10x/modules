---
icon: material/pipe-leak
---

# OpenTelemetry Collector Reporter

Read events from an OpenTelemetry Collector forwarder to transform into well-defined [TenXObjects](https://doc.log10x.com/api/js/#TenXObject) to aggregate and report on.

This module is a component of the [Edge Reporter](https://doc.log10x.com/apps/edge/reporter/) app.

## Overview

The OpenTelemetry Collector Reporter configures a TCP JSON input stream that:

- Listens on port 4318 (default) for JSON log and trace events
- Receives events from the OpenTelemetry Collector exporter
- Transforms events into TenXObjects
- Aggregates metrics and publishes to time-series outputs

## Installation

=== ":material-laptop: Nix/Win/OSX"

    See the Log10x Edge Reporter OpenTelemetry Collector [run instructions](https://doc.log10x.com/apps/edge/reporter/run/#otel-collector)

=== ":material-kubernetes: k8s"

    Deploy to k8s via [Helm](https://helm.sh/){target="_blank"}

    See the Log10x Edge Reporter OpenTelemetry Collector [deployment instructions](https://doc.log10x.com/apps/edge/reporter/deploy/#otel-collector)

## Configuration

See [config.yaml](config.yaml) for the default reporter configuration.

## Architecture

Unlike forwarders like Fluentd or Fluent Bit that can launch a Log10x sidecar process, the OpenTelemetry Collector integration works differently:

1. Log10x runs as a standalone service
2. OTel Collector exports JSON logs via TCP to Log10x
3. Log10x processes events and generates metrics
4. Metrics are published to time-series outputs

## Related

- [OpenTelemetry Collector Regulator](../regulate/index.md)
- [OpenTelemetry Collector Optimizer](../optimize/index.md)

