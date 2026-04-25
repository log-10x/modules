# OpenTelemetry Collector Configuration Files for Log10x Integration

This directory contains OpenTelemetry Collector configuration files that enable integration with Log10x for reporting, regulation, and optimization of log and trace events.

## Overview

Unlike other forwarders (Fluentd, Fluent Bit) that can launch Log10x as a sidecar process, the OpenTelemetry Collector integration requires running Log10x as a separate service.

## Architecture

```
┌─────────────────────┐
│  Log Sources        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐     TCP JSON (4318)      ┌──────────────┐
│  OTel Collector     │─────────────────────────→│   Log10x     │
│                     │                           │   Pipeline   │
│                     │←──────TCP/Unix Socket─────│              │
└─────────────────────┘      (port 4319)          └──────────────┘
           │
           ↓
┌─────────────────────┐
│  Final Destinations │
│  (Splunk, Elastic)  │
└─────────────────────┘
```

## Configuration Files

Configuration files are located in each mode's directory, following the naming convention `tenxNix.yaml` (Linux) and `tenxWin.yaml` (Windows).

### Report Mode (Metrics Only)

- **`report/tenxNix.yaml`** - Linux configuration for sending events to Log10x reporter
- **`report/tenxWin.yaml`** - Windows configuration for sending events to Log10x reporter

In report mode, events are sent to Log10x for metric aggregation only. No events are returned.

### Regulate Mode (Filtering)

- **`regulate/tenxNix.yaml`** - Linux configuration for event filtering
- **`regulate/tenxWin.yaml`** - Windows configuration for event filtering

In regulate mode, events are sent to Log10x, filtered based on policies, and returned for forwarding to destinations.

### Optimize Mode (Transformation)

- **`optimize/tenxNix.yaml`** - Linux configuration for event optimization
- **`optimize/tenxWin.yaml`** - Windows configuration for event optimization

In optimize mode, events are sent to Log10x, optimized/transformed, and returned for forwarding to destinations.

## Usage

### Step 1: Start Log10x

First, start the Log10x pipeline in the desired mode:

**Report:**
```bash
tenx @run/input/forward @apps/reporter
```

**Regulate:**
```bash
tenx @run/input/forwarder/otel-collector/regulate @apps/reducer
```

**Regulate with optimization:**
```bash
tenx @run/input/forwarder/otel-collector/regulate @apps/reducer reducerOptimize true
```

### Step 2: Start OpenTelemetry Collector

**Linux:**
```bash
otelcol --config=report/tenxNix.yaml
# or
otelcol --config=regulate/tenxNix.yaml
# or
otelcol --config=optimize/tenxNix.yaml
```

**Windows:**
```powershell
otelcol.exe --config=report/tenxWin.yaml
# or
otelcol.exe --config=regulate/tenxWin.yaml
# or
otelcol.exe --config=optimize/tenxWin.yaml
```

## Configuration Options

### Environment Variables

The following environment variables can be used to customize the configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `unknown` | Service name for telemetry |
| `ENVIRONMENT` | `production` | Deployment environment |
| `ELASTIC_ENDPOINT` | `http://elasticsearch:9200` | Elasticsearch endpoint |
| `SPLUNK_HEC_ENDPOINT` | `https://splunk:8088` | Splunk HEC endpoint |
| `SPLUNK_HEC_TOKEN` | - | Splunk HEC authentication token |

### Port Configuration

- **4317** - OTLP gRPC receiver (incoming events)
- **4318** - OTLP HTTP receiver (incoming events) / Log10x TCP input
- **4319** - TCP receiver for events returned from Log10x (regulate/optimize modes)

## Important Notes

### Unix Socket Limitation

OpenTelemetry Collector does not natively support Unix domain socket receivers. For regulate and optimize modes, the configurations use TCP port 4319 as an alternative for receiving events back from Log10x.

**For Linux:** You may need to update the Log10x output configuration to use TCP instead of Unix socket:
```yaml
otelCollectorOutputForwardAddress: "tcp://localhost:4319"
```

**For Windows:** TCP is used by default as Windows doesn't support Unix domain sockets.

### Customization

These configuration files are templates. You should customize them based on your needs:

1. **Receivers** - Add or modify receivers based on your log sources
2. **Processors** - Add processors for filtering, transformation, etc.
3. **Exporters** - Configure actual destinations (Elastic, Splunk, S3, etc.)
4. **Resource Attributes** - Add custom attributes for your environment

## Troubleshooting

### Enable Debug Logging

Set the telemetry log level to `debug` in the config:
```yaml
service:
  telemetry:
    logs:
      level: debug
```

### Test Connectivity

Verify Log10x is listening:
```bash
# Linux
netstat -tuln | grep 4318

# Windows
netstat -an | findstr 4318
```

### Check OTel Collector Logs

```bash
# Linux
journalctl -u otelcol -f

# Windows
# Check Event Viewer or service logs
```

## See Also

- [OpenTelemetry Collector Documentation](https://opentelemetry.io/docs/collector/)
- [Log10x OTel Collector Integration Guide](../index.md)
- [Log10x Configuration Reference](https://doc.log10x.com/)

