---
icon: material/rocket-launch
---

# Apps

Start with the [**MCP Server**](https://doc.log10x.com/manage/mcp-server/) — install it into Claude Desktop / Code / Cursor and it'll guide you through installing each of the apps below based on k8s discovery of your environment. You can also install and run these apps manually; MCP just makes it faster and safer by knowing your stack.

<div style="text-align: center;">

```mermaid
graph LR
    Forwarders["Log Forwarders"] -->|IPC| Edge["10x Regulator"]
    Edge --> Analyzers["Analyzers & Storage"]
    Forwarders -.->|IPC| Reporter["10x Reporter (DaemonSet)"]
    Analyzers --> Cloud["10x Retriever"]
    Reporter -.->|Metrics| Console["TSDB & Dashboards"]
    Edge -.->|Metrics| Console
    Cloud -.->|Metrics| Console

    classDef forwarders fill:#9333ea88,stroke:#7c3aed,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef edge fill:#2563eb88,stroke:#1d4ed8,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef analyzers fill:#ea580c88,stroke:#c2410c,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef cloud fill:#059669,stroke:#047857,color:#ffffff,stroke-width:2px,rx:8,ry:8
    classDef console fill:#16a34a88,stroke:#15803d,color:#ffffff,stroke-width:2px,rx:8,ry:8

    class Forwarders forwarders
    class Edge edge
    class Reporter edge
    class Analyzers analyzers
    class Cloud cloud
    class Console console
```

</div>

Suggested adoption path (guided by the [MCP Server](https://doc.log10x.com/manage/mcp-server/)):

:material-laptop: **Dev** — preview savings on your own log files (MCP can fetch and run it for you)

:material-chart-bar: **Reporter** — pinpoint the event types driving 80% of cost (MCP generates the Helm values)

:material-pipe-valve: **Regulator** — filter noisy events and losslessly compact survivors (MCP proposes filter configs)

:material-cloud-arrow-right-outline: **Retriever** — store events in S3, stream on-demand (MCP recommends the setup)

## :material-laptop: Dev

Preview savings on your actual log files before deploying. Installs locally or via Docker — or ask MCP to fetch and invoke it for you.

[Overview](https://doc.log10x.com/apps/dev){ .md-button .md-button--primary } · [FAQ](https://doc.log10x.com/apps/dev/faq/) · [Live Demo :octicons-link-external-16:](https://console.log10x.com?demo=true)

___

## :material-chart-bar: Reporter

See which event types drive 80% of your analytics platform cost, observed **pre-SIEM** from the forwarder stream. Deploys as a **DaemonSet** alongside your forwarder — not as a sidecar inside it. Not in the critical log path.

**MCP can generate tailored Helm values** — ask "set me up with the Reporter" after installing the MCP Server.

[Overview](https://doc.log10x.com/apps/reporter){ .md-button .md-button--primary } · [Architecture](https://doc.log10x.com/apps/reporter/#architecture) · [FAQ](https://doc.log10x.com/apps/reporter/faq/) · [Live Demo :octicons-link-external-16:](https://console.log10x.com?demo=true&step=3&apps=reporter,regulator,retriever&timeframe=year&volume=20&cost=2.50&highlight=reporter)

___

## :material-pipe-valve: Regulator

Execution arm. **Two modes**, one app:

- **Filter** (lossy): drop events matching a rule — up to 80% volume reduction. Safe defaults are deny; explicit allow required.
- **Compact** (lossless): replace events with a compact wire-form that the downstream SIEM plugin expands at query time. 50–80% reduction (64% on K8s OTel logs), no dashboard/query changes. Requires the expand plugin installed in [Splunk](https://doc.log10x.com/apps/regulator/splunk/) or [Elasticsearch](https://doc.log10x.com/apps/regulator/elasticsearch/).

**MCP can propose filter configs per pattern** based on the Reporter's cost attribution.

[Overview](https://doc.log10x.com/apps/regulator){ .md-button .md-button--primary } · [Architecture](https://doc.log10x.com/apps/regulator/#architecture) · [FAQ](https://doc.log10x.com/apps/regulator/faq/) · [Live Demo :octicons-link-external-16:](https://console.log10x.com?demo=true&step=3&apps=reporter,regulator,retriever&timeframe=year&volume=20&cost=2.50&highlight=regulator)

___

## :material-cloud-arrow-right-outline: Retriever

Keep all events in S3 at ~$0.023/GB instead of paying analytics platform ingestion rates. Stream only what you need to your analytics platform on-demand — 70-80% lower analytics cost.

**MCP can recommend the Terraform + Helm pair** for your environment.

[Overview](https://doc.log10x.com/apps/retriever){ .md-button .md-button--primary } · [Architecture](https://doc.log10x.com/apps/retriever/#architecture) · [FAQ](https://doc.log10x.com/apps/retriever/faq/) · [Live Demo :octicons-link-external-16:](https://console.log10x.com?demo=true&step=4&apps=reporter,regulator,retriever&timeframe=year&volume=20&cost=2.50)

___

## :material-link-variant: Related

- **Install the orchestrator:** [MCP Server](https://doc.log10x.com/manage/mcp-server/) — starts the adoption journey, then guides you through each app above
- **Generating custom symbols?** See [Compile](https://doc.log10x.com/compile/) — the AOT symbol generation pipeline. Optional.
