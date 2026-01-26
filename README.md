# Log10x Modules

Core module definitions for the Log10x engine - the brain that powers log optimization, regulation, and cost analysis across edge and cloud environments.

**Full Documentation**: [doc.log10x.com](https://doc.log10x.com/)

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            Log10x Engine                                  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                          Applications                               │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐   │  │
│  │  │       Edge Apps         │  │         Cloud Apps              │   │  │
│  │  │                         │  │                                 │   │  │
│  │  │  ├─ Optimizer           │  │  ├─ Reporter (cost analysis)    │   │  │
│  │  │  ├─ Regulator           │  │  └─ Streamer (S3 data lake)     │   │  │
│  │  │  ├─ Reporter            │  │                                 │   │  │
│  │  │  └─ Policy              │  │                                 │   │  │
│  │  └─────────────────────────┘  └─────────────────────────────────┘   │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐   │  │
│  │  │       Dev Apps          │  │        Compiler App             │   │  │
│  │  │                         │  │                                 │   │  │
│  │  │  ├─ Analyzer            │  │  ├─ Pull (github, docker, helm) │   │  │
│  │  │  ├─ Optimizer           │  │  ├─ Scan (Java, Python, Go...)  │   │  │
│  │  │  ├─ Regulator           │  │  └─ Push (symbol generation)    │   │  │
│  │  │  └─ Reporter            │  │                                 │   │  │
│  │  └─────────────────────────┘  └─────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                           Pipelines                                 │  │
│  │                                                                     │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │  COMPILE: Pull ──► Scan ──► Link ──► Push                     │  │  │
│  │  │           (GitHub, Docker, Helm) → (AST, Bytecode) → Symbols  │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌───────────────────────────────────────────────────────────────┐  │  │
│  │  │  RUN: Input ──► Transform ──► Aggregate ──► Output            │  │  │
│  │  │       (Forwarders, Analyzers) → (Script) → (Events, Metrics)  │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
modules/
├── apps/                           # Pre-built applications
│   ├── compiler/                   # Symbol compilation app
│   ├── dev/                        # Development/testing apps
│   ├── edge/                       # Edge (forwarder sidecar) apps
│   │   ├── optimizer/              # Template extraction & volume reduction
│   │   ├── regulator/              # Policy-based filtering
│   │   ├── reporter/               # Cost attribution metrics
│   │   └── policy/                 # Compliance enforcement
│   └── cloud/                      # Cloud platform apps
│       ├── reporter/               # Splunk/Elastic/Datadog cost analysis
│       └── streamer/               # S3 data lake indexing
│
├── pipelines/                      # Core pipeline definitions
│   ├── compile/                    # Symbol compilation pipeline
│   │   └── modules/                # pull/, scanner/, link/
│   ├── run/                        # Event processing pipeline
│   │   └── modules/                # input/, transform/, aggregate/, output/
│   ├── doc/                        # Documentation generation pipeline
│   └── shared/                     # Shared utilities
│
└── lib/                            # Shared libraries
    └── script/                     # JavaScript libraries
```

## Applications

### Edge Applications

Deployed as sidecars alongside log forwarders (Fluentd, Fluent Bit, Filebeat, Logstash).

| App | Purpose | Documentation | Run Guide |
|-----|---------|---------------|-----------|
| **Edge Optimizer** | Reduce log volume via template extraction | [Overview](https://doc.log10x.com/apps/edge/optimizer/) | [Run](https://doc.log10x.com/apps/edge/optimizer/run/) |
| **Edge Regulator** | Policy-based filtering & sampling | [Overview](https://doc.log10x.com/apps/edge/regulator/) | [Run](https://doc.log10x.com/apps/edge/regulator/run/) |
| **Edge Reporter** | Cost attribution metrics | [Overview](https://doc.log10x.com/apps/edge/reporter/) | [Run](https://doc.log10x.com/apps/edge/reporter/run/) |
| **Edge Policy** | PII detection & compliance | [Overview](https://doc.log10x.com/apps/edge/policy/) | [Run](https://doc.log10x.com/apps/edge/policy/run/) |

```
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Deployment                               │
│                                                                  │
│   Application ──► Log Forwarder ──► Log10x Sidecar ──► Analyzer │
│   (logs)          (Fluentd,         (Optimizer/       (Splunk,   │
│                    Filebeat)         Regulator)        Elastic)  │
│                                                                  │
│   Metrics: ───────────────────────► Prometheus ────► Grafana    │
└─────────────────────────────────────────────────────────────────┘
```

### Cloud Applications

Run as containers analyzing logs already in observability platforms.

| App | Purpose | Documentation | Run Guide |
|-----|---------|---------------|-----------|
| **Cloud Reporter** | Query analyzers, calculate spend per app | [Overview](https://doc.log10x.com/apps/cloud/reporter/) | [Run](https://doc.log10x.com/apps/cloud/reporter/run/) |
| **Storage Streamer** | S3 data lake indexing & queries | [Overview](https://doc.log10x.com/apps/cloud/streamer/) | [Run](https://doc.log10x.com/apps/cloud/streamer/run/) |

### Development & Compiler Applications

| App | Purpose | Documentation | Run Guide |
|-----|---------|---------------|-----------|
| **Dev Apps** | Local testing of optimizer/regulator/reporter | [Overview](https://doc.log10x.com/apps/dev/) | [Run](https://doc.log10x.com/apps/dev/run/) |
| **Compiler** | Generate symbol files from source code | [Overview](https://doc.log10x.com/apps/compiler/) | [Run](https://doc.log10x.com/apps/compiler/run/) |

## Pipelines

### Compile Pipeline

Scans source code and generates symbol files for log template extraction.

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  PULL    │───►│  SCAN    │───►│  LINK    │───►│  PUSH    │
│          │    │          │    │          │    │          │
│ GitHub   │    │ javaParser│   │ Cross-ref│    │ S3       │
│ Docker   │    │ pythonAST │   │ analysis │    │ Local    │
│ Helm     │    │ ANTLR     │   │          │    │          │
│ Local    │    │ bytecode  │   │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Documentation**: [Compile Pipeline](https://doc.log10x.com/compile/)

| Module Type | Examples | Docs |
|-------------|----------|------|
| Pull | github, docker, helm, local | [Pull Modules](https://doc.log10x.com/compile/pull/) |
| Scanner | javaParser, pythonAST, scalameta, antlr, bytecode | [Scanner Modules](https://doc.log10x.com/compile/scanner/) |

### Run Pipeline

Processes log events in real-time for optimization, regulation, and reporting.

```
┌──────────┐    ┌───────────┐    ┌───────────┐    ┌──────────┐
│  INPUT   │───►│ TRANSFORM │───►│ AGGREGATE │───►│  OUTPUT  │
│          │    │           │    │           │    │          │
│ Forwarder│    │ Script    │    │ Group by  │    │ Events   │
│ Analyzer │    │ Fields    │    │ template  │    │ Metrics  │
│ S3       │    │ Timestamp │    │ app       │    │ Stream   │
│ Stdin    │    │ Structure │    │ level     │    │          │
└──────────┘    └───────────┘    └───────────┘    └──────────┘
```

**Documentation**: [Run Pipeline](https://doc.log10x.com/run/)

| Module Type | Examples | Docs |
|-------------|----------|------|
| Input/Forwarder | fluentd, fluentbit, filebeat, logstash, otel | [Forwarders](https://doc.log10x.com/run/input/forwarder/) |
| Input/Analyzer | splunk, elastic, datadog, cloudwatchLogs | [Analyzers](https://doc.log10x.com/run/input/analyzer/) |
| Transform | script, fields, timestamp, structure | [Transform](https://doc.log10x.com/run/transform/) |
| Output/Event | stdout, file, http, unix | [Event Output](https://doc.log10x.com/run/output/event/) |
| Output/Metric | prometheus, datadog, cloudwatch | [Metric Output](https://doc.log10x.com/run/output/metric/) |

## Configuration Reference

All configuration formats and specifications are documented at [doc.log10x.com/config](https://doc.log10x.com/config/).

| Topic | Description | Documentation |
|-------|-------------|---------------|
| **Module Configuration** | module.yaml structure and settings | [Module Config](https://doc.log10x.com/config/module/) |
| **App Configuration** | app.yaml structure and configFolders | [App Config](https://doc.log10x.com/config/app/) |
| **YAML Format** | YAML syntax and +include directives | [YAML Reference](https://doc.log10x.com/config/yaml/) |
| **JavaScript** | Scripting API and functions | [JavaScript](https://doc.log10x.com/config/javascript/) |
| **Symbol Files** | Symbol file format and usage | [Symbols](https://doc.log10x.com/config/symbol/) |
| **Folder Structure** | Configuration folder conventions | [Folders](https://doc.log10x.com/config/folder/) |
| **Matching Rules** | Pattern matching syntax | [Match](https://doc.log10x.com/config/match/) |
| **CLI Options** | Command-line interface reference | [CLI](https://doc.log10x.com/config/cli/) |

## API Reference

| Topic | Description | Documentation |
|-------|-------------|---------------|
| **Input API** | TenXObject structure and input handling | [Input API](https://doc.log10x.com/api/input/) |
| **Output API** | TenXSummary structure and output handling | [Output API](https://doc.log10x.com/api/output/) |
| **JavaScript API** | Scripting functions and objects | [JavaScript API](https://doc.log10x.com/api/js/) |
| **Compile API** | Compiler programmatic interface | [Compile API](https://doc.log10x.com/api/compile/) |

## Architecture

For detailed architecture documentation:

| Topic | Documentation |
|-------|---------------|
| **Engine Architecture** | [Architecture Overview](https://doc.log10x.com/apps/) |
| **Pipeline Architecture** | [Pipeline Design](https://doc.log10x.com/engine/pipeline/) |
| **Module System** | [Module Architecture](https://doc.log10x.com/engine/module/) |
| **Launcher Options** | [Launcher (sidecar, job, function)](https://doc.log10x.com/engine/launcher/) |
| **GitOps Integration** | [GitOps Workflows](https://doc.log10x.com/engine/gitops/) |

## Statistics

| Category | Count |
|----------|-------|
| Total Directories | 180+ |
| YAML Configuration Files | 275+ |
| Applications | 10 |
| Pipeline Types | 4 |
| Input Modules | 15+ |
| Output Modules | 20+ |
| Scanner Modules | 12+ |
| Supported Forwarders | 5 |
| Supported Analyzers | 6 |

## Quick Links

| Resource | URL |
|----------|-----|
| **Documentation Hub** | [doc.log10x.com](https://doc.log10x.com/) |
| **Getting Started** | [doc.log10x.com/home](https://doc.log10x.com/home/) |
| **Installation** | [doc.log10x.com/install](https://doc.log10x.com/install/) |
| **Applications** | [doc.log10x.com/apps](https://doc.log10x.com/apps/) |
| **Configuration** | [doc.log10x.com/config](https://doc.log10x.com/config/) |
| **API Reference** | [doc.log10x.com/api](https://doc.log10x.com/api/) |

## License

This repository is licensed under the [Apache License 2.0](LICENSE).

### Log10x Product License Required

This repository contains module definitions for the Log10x engine. While these
definitions are open source, **running Log10x requires a commercial license.**

| What's Open Source | What Requires License |
|-------------------|----------------------|
| Module YAML definitions | Log10x engine/runtime |
| Documentation files | Log10x apps (Reporter, Optimizer, etc.) |
| Schema definitions | Executing pipelines |

**Get a Log10x License:**
- [Pricing](https://log10x.com/pricing)
- [Documentation](https://doc.log10x.com)
- [Contact Sales](mailto:sales@log10x.com)
