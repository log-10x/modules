---
icon: material/origin
---

Extracts consistent message identifiers from log events for accurate log-to-metrics conversion and cost control.

Raw log events contain high-cardinality [variable](https://doc.log10x.com/run/transform/structure/#variables) data (timestamps, IDs, values) mixed with constant, low-cardinality [symbols](https://doc.log10x.com/run/transform/structure/#symbols).

The message initializer uses symbol libraries to isolate stable [message patterns](https://doc.log10x.com/run/transform/symbol/) from each event, enabling accurate classification of event instances by their logical type.

## :material-target: Message Extraction

Every token the symbol library recognizes carries a set of candidate origins: the source unit, a file or a binary, that can emit the token, together with the enclosing scope the library recorded for it. A token emitted by many units resolves to many candidates, so ambiguity is the normal case and resolving it is the selector's job. Candidates are keyed by originating unit plus enclosing scope, so symbols sharing an origin and a scope coalesce into one candidate.

The initializer identifies the core message pattern by ranking those candidates from a [TenXTemplate](https://doc.log10x.com/run/template/ "Import joint JSON schemas files to expand events into typed TenXObjects."), on a five-key comparator, every key descending:

1. **Prose evidence**: the width of the candidate's widest matched field that is **not inside a container**. Container depth is counted from the opens and closes preceding the field, so a JSON attribute value that quotes another component's message is excluded here even though it is prose-shaped. This key decides first.
2. **Widest matched phrase**: a per-field maximum, rather than a sum, over library-matched, multi-character tokens that are not [reserved](https://doc.log10x.com/run/transform/symbol/#symbolsequencereserved). This is the widest single library-matched phrase the origin accounts for.
3. **Distinct known tokens**: the count of distinct library-known tokens anywhere on the line that the origin explains. This is the coverage term.
4. **Character total**: the combined character length of those distinct tokens.
5. **Span length**: the run length of the selected span. This is the only run-length key, it sits last, and the comparator reaches it only when the first four keys all tie.

Prose ranks ahead of bulk because text inside a container is citation, not authorship. A twenty-token error value carried as an attribute does not outrank the two-token statement it is attached to.

Coverage ranks ahead of length because the more places a word appears across a code base, the less that word says about where a line came from. A word appearing in one file identifies that file; a word appearing in hundreds identifies nothing. Ranking by how many distinct known words an origin explains picks the origin that best accounts for the line.

One tie-break runs after the ranking rather than as a sixth key. Where the winner ties its nearest rival on all five, the tied group yields to a candidate whose unit the line's own authorship region names.

### Evidence gate

A typed selection ([`symbolContexts`](#symbolcontexts) of `log,exec`) claims an origin: this source statement wrote this line. That claim stands on prose evidence exclusively, and a candidate whose prose score is below two is rejected rather than crowned. A library word the emission skips as an identifier fragment is not evidence, and symbols joined only by `/` count as one word: a path is one value, not a phrase. **A line with no prose evidence gets no typed origin and keeps its raw fallback identity.** The lone `any` context asserts nothing about provenance and gates at one token instead, so thin fragments still receive an identity.

### Emission

Selection picks the origin. Emission then builds the value in three stages.

- **Anchor**: the winner's widest matched prose field, emitted verbatim. The message region runs forward from the anchor's own start and stops at the first container open, newline, or second timestamp; where that boundary falls inside the anchor field the region collapses back to the field. Where the anchor follows `:` and whitespace, the statement is quoting text, an exception it reports, and the region past the anchor field takes at most half of the [`symbolMaxLen`](#symbolmaxlen) budget before the backward walk; it resumes afterwards if room is left, so two statements quoting one exception keep their own words. The anchor is **exempt from reserved filtering**: applying it here renames the statement, turning `no baggage found in context` into `no_found`. Timestamps, variables and repeats are still dropped.
- **Suffix**: distinct non-reserved tokens from the winner's other matched fields, each token counted once however often it repeats, up to a budget of sixteen.
- **Padding**: forward and backward from the emitted region while the [`symbolMaxLen`](#symbolmaxlen) budget allows. Reserved filtering governs here and in the suffix, which is where a generic word is genuinely noise. Message keys are left out here as reserved words are. The backward walk stops where the statement starts: at the nearest preceding timestamp, at a token that closes a container or ends a line, or at a line break escaped inside a quoted value (`\` followed by `n` or `r`). Everything before that point is preamble, the node ids, request ids, thread and logger names a format prints ahead of the message, and it stays out of the pattern.

Every stage, and the `any` fallback below, skips an **identifier fragment**: a library word that is part of a value. Glue is a single `-`, `_`, `.` or `$`, and a chain is the run of tokens joined by glue. A word is a fragment when:

- a token next to it, directly or across one glue, is a variable, numbers included;
- its chain has two or more pieces and one of them carries a digit;
- it carries a digit and sits beside a `/` separator, a path segment such as `subdir2`;
- its chain has a `.`, two or more pieces, and ends in `:` followed by a variable, a `host:port` such as `www.evernote.com:443`;
- it sits in a path of pieces joined by runs of `/`, `-`, `_` and `.`, with two or more `/` and a variable piece;
- it is eight or more characters of upper-case letters and digits, both present, a generated id such as `L9ECAV7KIM`.

A variable reaches only its neighbours; a digit-bearing word reaches its whole chain. The `C` in the node id `R21-M0-N4-C:J05-U11` and the `req` in `req-b3e2...` are library words, and skipping them keeps one statement on one identity however its ids are spelled. The rules read only token types, delimiter characters and the word's own text, all constant across a template's lines, so every line of a template gets the same verdict. They have a cost: a dotted metric name whose digit-bearing segment is a library word loses every word, a REST route loses the words after a variable segment (`/v2/<tenant>/servers/detail` loses `servers_detail`), a `file:line` citation (`server.py:127`) loses its words to the `host:port` rule, and an all-caps code such as `AES256GCM` reads as a generated id.

Inside a JSON string a line break or tab arrives as `\` and a letter, and `\` is a delimiter, so the letter opens the next token. A token after an odd run of backslashes that starts with `n`, `r` or `t` contributes its remainder (`\nOrder` gives `Order`), and a token that is only the letter contributes nothing. An even run is an escaped backslash and the word is kept.

The [`symbolContexts`](#symbolcontexts) list filters which symbol contexts participate. Contexts are evaluated in a single pass, so list order acts as a filter rather than a precedence chain.

The `inputField` parameter limits searches to specific JSON fields. Setting `inputField: log` searches only within the log field content.

When `inputField` lists several fields, the first listed field the event carries as a JSON key is the one read, whether or not it yields a word. A listed field parsed out of free text (`org.mortbay.log: jetty-6.1.26`) is read only when it yields a word; otherwise the next field is tried. Name, skeleton and origin read the same field. A `log` value with no library word is named by its own shape, as below, so the record's envelope keys (`stream`, `docker`, `kubernetes`) stay out of the name.

A multi-line event is named from one member, its lead. With [`symbolGroupLead`](https://doc.log10x.com/run/transform/symbol/#symbolgrouplead) set to `firstWithMessage`, the lead is the first member whose input field has a word past the preamble, a name of words chained by a [joiner](https://doc.log10x.com/run/transform/symbol/#symbolpreamblejoiners) (`cart.cartstore.ValkeyCartStore`) counting as preamble here. The .NET console logger writes `info: cart.cartstore.ValkeyCartStore[0]` and the message `GetCartAsync called with userId=...` as two records; the name, skeleton and origin come from the second. A head that holds a message, such as the exception line of a stack trace, is the lead, as is the head of an event whose every member is preamble.

A line with no library word is named `template_` followed by 16 hex digits. The digits hash the normalized shape of the input field: its constant words and punctuation, one marker for each run of variables and for each timestamp whatever its format, and one space for each run of whitespace. A statement keeps one name across padded columns, millisecond widths and repeated values, and the name is a valid metric label. Where a library update turns a value on such a line into a library word, or the reverse, the shape and the name change.

### Repeatability

The comparator is deterministic: every key is a content-derived integer, and a field's evidence is its own words and the library, so no earlier line in the run changes the verdict. Three details bound that behavior.

- A full five-key tie that the authorship pass also leaves undecided falls back to candidate order. Entries are keyed on content, so that order is the same in every run and on every node.
- Two truncation caps can hide a true origin: [`symbolMaxOrigins`](https://doc.log10x.com/run/transform/symbol/#symbolmaxorigins) (default 64, the cap that binds at runtime) and [`maxSymbolUnitsPerToken`](https://doc.log10x.com/run/symbol/#maxsymbolunitspertoken) (default 128, approximate, stopping in the low 130s).
- When the selected sequence comes back as a single token, the module re-runs the selection under the `any` context, which takes the symbol tokens in range from the first word of the message, each once, minus identifier fragments, and bypasses the comparator. The words before it are the preamble: [reserved](https://doc.log10x.com/run/transform/symbol/#symbolsequencereserved) words, text inside an [enclosure](https://doc.log10x.com/run/transform/symbol/#symbolpreambleenclosures) that closes within the field, and a reserved key with its value, quoted or not, bound by an [assigner](https://doc.log10x.com/run/transform/symbol/#symbolpreambleassigners). A logger or class name such as `org.apache.kafka.log.LocalLog` stays in the name: it is often the only text that tells two statements apart. A [message key](https://doc.log10x.com/run/transform/symbol/#symbolpreamblemessagekeys) (`msg=starting`, `"msg":"Serving metrics"`, `body: 'Charge request received.'`) is preamble, and when an assigner binds it the message starts inside its value, quoted or not, at the first word none of these describe: `Subchannel` in `"msg":"[core][Channel #1] Subchannel created"`. In a record that opens with `{`, reading starts at the first such key that binds, whatever keys come before it. `:` binds only in record form, a quoted key or a quoted value, so `WARN: GF_INSTALL_PLUGINS is deprecated` and `INFO:root:Starting worker` bind nothing.

The claim the engine supports is scoped: the same engine version, the same symbol library and the same configuration give the same pattern for every event of a template, whatever other traffic the run carries and however many times it runs.

## :material-fingerprint: Pattern identity: pattern vs template

Four terms are easy to conflate. They are distinct:

- **Pattern** (`symbolMessage`), the selection described above: a **subset** of representing tokens chosen from the template, not the whole line. Short and legible (e.g. `Receive ListRecommendations for product ids`). It is the unit of cost attribution.
- **`pattern_hash`** (alias: `tenx_hash`), the hash of the `symbolMessage` (the [`symbolMessageHashField`](#symbolmessagehashfield), default `tenx_hash`). This is the **stable, user-facing identity** that tools and metrics key on. It is stable because it keys on the representing **subset**: it stays constant across deploys, restarts, pod renames, and format drift, and many template variants that share the representing tokens collapse to the **same** `pattern_hash`.
- **Template**, the full `$`-marked structural shape of the line (every token, with variable slots marked `$`). A single pattern sits over a **set** of templates, one per format variant present in the data.
- **`template_hash`**, the engine-internal fingerprint of a template's field-set. It exists only to join encoded events back to their entry in `templates.json` at decode time. It is **not** the stable identity, it is **many-to-one** with the pattern, and it should never be surfaced to a user or agent as the identifier. Use `pattern_hash` for that.

### Field names by surface

An encoded event opens with a leading segment, and that segment always carries the template join key, the value a decoder uses to rebuild the original line from its `templates.json` entry. Each integration handles that field to suit its own schema: the Splunk app extracts it as `tenx_hash`, and the Elasticsearch plugin looks the key up in its `l1es_dml` template index. The pattern-level identity is a separate value, the hash of the selected pattern, written to the field named by [`symbolMessageHashField`](#symbolmessagehashfield) and also defaulting to `tenx_hash`. The name therefore appears on more than one surface, carrying the join key on an encoded event in Splunk and the pattern hash on an enriched event out of the engine. The two values answer different questions: the join key says which template rebuilds this line, and the pattern hash says which pattern this line belongs to.

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
