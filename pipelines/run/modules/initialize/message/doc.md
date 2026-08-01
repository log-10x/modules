---
icon: material/origin
---

Extracts consistent message identifiers from log events for accurate log-to-metrics conversion and cost control.

Raw log events contain high-cardinality [variable](https://doc.log10x.com/run/transform/structure/#variables) data (timestamps, IDs, values) mixed with constant, low-cardinality [symbols](https://doc.log10x.com/run/transform/structure/#symbols).

The message initializer uses symbol libraries to isolate stable [message patterns](https://doc.log10x.com/run/transform/symbol/) from each event, enabling accurate classification of event instances by their logical type.

## :material-target: Message Extraction

Every token the symbol library recognizes carries a set of candidate origins: the source unit, a file or a binary, that can emit the token, together with the enclosing scope the library recorded for it. A token emitted by many units resolves to many candidates, so ambiguity is the normal case and resolving it is the selector's job. Candidates are keyed by originating unit plus enclosing scope, so symbols sharing an origin and a scope coalesce into one candidate.

The initializer identifies the core message pattern by ranking those candidates from a [TenXTemplate](https://doc.log10x.com/run/template/ "Import joint JSON schemas files to expand events into typed TenXObjects.") **by coverage**, on a four-key comparator, every key descending:

1. **Widest matched phrase**: a per-field maximum, rather than a sum, over library-matched, multi-character tokens that are not [reserved](https://doc.log10x.com/run/transform/symbol/#symbolsequencereserved). This is the widest single library-matched phrase the origin accounts for.
2. **Distinct known tokens**: the count of distinct library-known tokens anywhere on the line that the origin explains. This is the coverage term, and it decides most events.
3. **Character total**: the combined character length of those distinct tokens.
4. **Span length**: the run length of the selected span. This is the only run-length key, it sits last, and the comparator reaches it only when the first three keys all tie.

Coverage ranks ahead of length because the more places a word appears across a code base, the less that word says about where a line came from. A word appearing in one file identifies that file; a word appearing in hundreds identifies nothing. Ranking by how many distinct known words an origin explains picks the origin that best accounts for the line.

Contiguity is a property of the emitted value rather than of the selection. Once a candidate wins, the output spans from the candidate's first field start to its last field end, then pads forward and backward while the [`symbolMaxLen`](#symbolmaxlen) budget allows. A candidate whose tokens sit in three separate phrases scattered across the line can beat a candidate holding one longer contiguous run.

The [`symbolContexts`](#symbolcontexts) list filters which symbol contexts participate. Contexts are evaluated in a single pass, so list order acts as a filter rather than a precedence chain.

The `inputField` parameter limits searches to specific JSON fields. Setting `inputField: log` searches only within the log field content.

### Repeatability

The comparator is deterministic: every key is a content-derived integer. Three details bound that guarantee.

- A full four-key tie falls back to candidate insertion order, which holds stable for a given engine build and is not a documented ordering.
- Two truncation caps can hide a true origin: [`symbolMaxOrigins`](https://doc.log10x.com/run/transform/symbol/#symbolmaxorigins) (default 64, the cap that binds at runtime) and [`maxSymbolUnitsPerToken`](https://doc.log10x.com/run/symbol/#maxsymbolunitspertoken) (default 128, approximate, stopping in the low 130s).
- When the selected sequence comes back as a single token, the module re-runs the selection under the `any` context, which concatenates all symbol tokens in range and bypasses the comparator.

The claim the engine supports is scoped: the same engine version, the same symbol library, the same configuration and the same event yield the same pattern.

## :material-fingerprint: Pattern identity: pattern vs template

Four terms are easy to conflate. They are distinct:

- **Pattern** (`symbolMessage`), the selection described above: a **subset** of representing tokens chosen from the template, not the whole line. Short and legible (e.g. `Receive ListRecommendations for product ids`). It is the unit of cost attribution.
- **`pattern_hash`** (alias: `tenx_hash`), the hash of the `symbolMessage` (the [`symbolMessageHashField`](#symbolmessagehashfield), default `tenx_hash`). This is the **stable, user-facing identity** that tools and metrics key on. It is stable because it keys on the representing **subset**: it stays constant across deploys, restarts, pod renames, and format drift, and many template variants that share the representing tokens collapse to the **same** `pattern_hash`.
- **Template**, the full `$`-marked structural shape of the line (every token, with variable slots marked `$`). A single pattern sits over a **set** of templates, one per format variant present in the data.
- **`template_hash`**, the engine-internal fingerprint of a template's field-set. It exists only to join encoded events back to their entry in `templates.json` at decode time. It is **not** the stable identity, it is **many-to-one** with the pattern, and it should never be surfaced to a user or agent as the identifier. Use `pattern_hash` for that.

### Field names by surface

An encoded event opens with a leading segment, and that segment always carries the template join key, the value a decoder uses to rebuild the original line from its `templates.json` entry. Each integration labels that field to suit its own schema: a ClickHouse table names it as a template hash column, and the Splunk app extracts it as `tenx_hash`. The pattern-level identity is a separate value, the hash of the selected pattern, written to the field named by [`symbolMessageHashField`](#symbolmessagehashfield) and also defaulting to `tenx_hash`. The name therefore appears on more than one surface, carrying the join key on an encoded event in Splunk and the pattern hash on an enriched event out of the engine. The two values answer different questions: the join key says which template rebuilds this line, and the pattern hash says which pattern this line belongs to.

Building on this process, here's how it applies to real events:

=== ":simple-opentelemetry: OTel Demo"

    **Kubernetes Example:**

    ```json
    {
      "stream": "stderr",
      "log": "2025-04-17 14:32:40,287 INFO [main] [recommendation_server.py:47] - Receive ListRecommendations for product ids:['L9ECAV7KIM', '0PUK6V6EV0']",
      "docker": {
        "container_id": "9c04355088aa168abb1a074b696ad15366c254602be8cbb69299e1e87d3bcffb"
      },
      "kubernetes": {
        "container_name": "recommendationservice",
        "namespace_name": "default"
      }
    }
    ```

    **Extracted Message:**

    `Receive_ListRecommendations_for_product_ids`

=== ":material-apache-kafka: Kafka"

    **Kafka Controller Event:**

    ```json
    {
      "stream": "stdout",
      "log": "[2025-08-01 22:19:30,905] INFO [controller-1-to-controller-registration-channel-manager]: Recorded new controller, from now on will use node 0.0.0.0:9093 (id: 1 rack: null) (kafka.server.NodeToControllerRequestThread)",
      "docker": {
        "container_id": "79af0d7ce5f3c159411c6a15ee2d9044f3559bd2fe1630f8a6640d4c2cc87771"
      },
      "kubernetes": {
        "container_name": "kafka",
        "namespace_name": "default",
        "pod_name": "kafka-549545757c-2lmxv",
        "container_image": "ghcr.io/open-telemetry/demo:2.0.2-kafka"
      }
    }
    ```

    **Extracted Message:**

    `channel_manager_Recorded_new_controller_from_now_on_will_use_node_id_rack`

=== ":simple-opensearch: OpenSearch"

    **OpenSearch PeerFinder Event:**

    ```json
    {
      "stream": "stdout",
      "log": "[2025-08-01T22:19:24,590][INFO ][o.o.d.PeerFinder         ] [opensearch-0] setting findPeersInterval to [1s] as node commission status = [true] for local node [{opensearch-0}{N_KuFBFGRmSnettsBzOX3Q}{3XUyt5iPRMKvzuHPCaPFyg}{192.168.57.56}{192.168.57.56:9300}{dimr}{shard_indexing_pressure_enabled=true}]",
      "docker": {
        "container_id": "b6f244ebdaa72d7565b8944a1aad79cd5ac06ac767e4e603145a5e4bfd121883"
      },
      "kubernetes": {
        "container_name": "opensearch",
        "namespace_name": "default",
        "pod_name": "opensearch-0",
        "container_image": "docker.io/opensearchproject/opensearch:2.19.0"
      }
    }
    ```

    **Extracted Message:**

    `commission_status_local_node_opensearch_shard_indexing_pressure_enabled`

=== ":material-web: Web"

    **HTTP Access Log Event:**

    ```json
    {
      "stream": "stdout",
      "log": "192.168.43.96 - - [01/Aug/2025:22:21:50 +0000] \"GET /products/LensCleaningKit.jpg HTTP/1.1\" 200 101928 \"http://frontend-proxy:8080/\" \"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/133.0.0.0 Safari/537.36\"",
      "docker": {
        "container_id": "ac37d50d39857193f5d2ff92872f1c022d3b746fa721233eccd1b4aae7d26a8b"
      },
      "kubernetes": {
        "container_name": "image-provider",
        "namespace_name": "default",
        "pod_name": "image-provider-58c6f8444-q4c8p",
        "container_image": "ghcr.io/open-telemetry/demo:2.0.2-image-provider"
      }
    }
    ```

    **Extracted Message:**

    `frontend_proxy_Mozilla_X11_Linux_x86_AppleWebKit_KHTML_like_Gecko_Safari`


:material-github: See the [JavaScript implementation](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/initialize/message/message-template.js) of this module on Github.

---

## :material-rocket-launch-outline: Applications

💰 **Cost tracking**: Identifies high-volume event types consuming log budgets with the [Dev app](https://doc.log10x.com/apps/dev/) app

📈 **Cost control**: Apply intelligent filtering using the [Receiver](https://doc.log10x.com/apps/receiver/) app to prevent over-billing

🤖 **Multi-platform analytics**: Feed patterns into AIOps and monitoring systems via [metric outputs](https://doc.log10x.com/run/output/metric/) for Datadog, CloudWatch, and Prometheus

🔄 **Automatic adaptation**: Updates automatically with code changes using [symbol libraries](https://doc.log10x.com/compile/link/#symbol-library). No manual regex pattern configuration and maintenance
