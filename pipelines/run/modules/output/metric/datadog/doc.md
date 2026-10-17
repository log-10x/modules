---
icon: simple/datadog
---

Publishes [TenXSummary](https://doc.log10x.com/api/js/#TenXSummary) values to Datadog as [distribution](https://docs.datadoghq.com/metrics/distributions/) points, named `log10x.<aggregator>_<counter>`, for example `log10x.emitted_events_summaryBytes`.

## :material-tag-outline: What Datadog counts

The shipped output tags each series with the pattern and where it ran (`message_pattern`, `tenx_hash`, `tenx_user_service`, `severity_level`, `routeState`, `k8s_container`, `k8s_namespace`, and `tenx_team` when [`k8sTeamLabel`](https://doc.log10x.com/run/initialize/k8s/) names a pod label) and with the runtime attributes, and with nothing that names one node or one process. Every node sends the same tag sets, and Datadog merges their distribution points, so a query such as `sum:log10x.emitted_events_summaryBytes{*}.as_count()` returns the fleet's exact total.

Datadog bills a distribution as five custom metrics (count, sum, min, max and avg) for each tag set. The output publishes the 200 tag sets with the most bytes (`topSeries`); with the two shipped aggregators and two counters each that is 4,000 custom metrics, the same on any number of nodes, inside a Pro plan's allotment of 100 per host from 40 hosts up. A pattern outside the top is published once it costs more than the smallest one inside.
