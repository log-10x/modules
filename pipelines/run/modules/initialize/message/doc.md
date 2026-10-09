---
icon: material/origin
---

Names each event by the source-code statement that wrote it. The name (`symbolMessage`, such as `Receive_ListRecommendations_for_product_ids`) and its hash (`tenx_hash`) stay the same across the IDs, timestamps and hosts of one statement's events, so cost, rate and metric reporting groups by log statement.

Raw events mix high-cardinality [variables](https://doc.log10x.com/run/transform/structure/#variables) (timestamps, IDs, values) with constant [symbols](https://doc.log10x.com/run/transform/structure/#symbols). The module reads the symbols against a [symbol library](https://doc.log10x.com/compile/link/#symbol-library), the words and source locations compiled from code, to find the statement behind each line.

## :material-target: Message Extraction

Every run of library words on a line points to candidate origins: the source files or binaries that can emit that phrase, together with the method around it. The module then:

1. **Ranks** the candidates and picks the origin whose words best explain the line.
2. **Gates** the pick: claiming an origin requires prose evidence.
3. **Emits** the name from the winner's words, leaving out every value.

??? tenx-symbolinitializer "Ranking"

    Candidates are keyed by source unit plus enclosing method, so the symbols of one method form one candidate. Five keys decide in order, each descending:

    1. **Prose evidence**: the width of the candidate's widest matched field outside any container. Container depth counts the opens and closes before the field, so a JSON value quoting another component's message does not count.
    2. **Widest phrase**: the widest single library-matched phrase, excluding [reserved](https://doc.log10x.com/run/transform/symbol/#symbolsequencereserved) words.
    3. **Distinct words**: how many distinct library words on the line the origin explains.
    4. **Character total**: the combined length of those words.
    5. **Span length**: the run length of the selected span, reached only on a four-key tie.

    Prose ranks ahead of bulk because text inside a container is citation: a twenty-token error value carried as an attribute stays behind the two-token statement it belongs to. Coverage ranks ahead of length because a word found in hundreds of files says little about where a line came from. A tie on all five keys goes to the candidate whose unit the line's own authorship region names.

??? tenx-safety "Evidence gate"

    A typed selection ([`symbolContexts`](#symbolcontexts) of `log,exec`) claims that one source statement wrote the line, so it requires prose evidence of at least two words. A line without that evidence gets no typed origin and keeps its fallback identity. Identifier fragments are not evidence, and words joined only by `/` count as one word, since a path is one value. The `any` context claims no origin and accepts a single word, so thin fragments still receive an identity.

??? tenx-text "Name construction"

    - **Anchor**: the winner's widest prose field, kept verbatim. The region runs forward to the first container open, newline or second timestamp. After `:` and whitespace the statement is quoting text, such as an exception, so the region past the anchor takes at most half of the [`symbolMaxLen`](#symbolmaxlen) budget; two statements quoting one exception keep their own words. Reserved filtering skips the anchor, which keeps `no baggage found in context` whole.
    - **Suffix**: up to sixteen distinct non-reserved words from the winner's other matched fields.
    - **Padding**: words before and after the region while the [`symbolMaxLen`](#symbolmaxlen) budget allows, with reserved words and message keys left out. The backward walk stops at the nearest timestamp, a closing bracket, a line end or an escaped line break (`\n`, `\r`). Text before that point is preamble, such as the node, request and thread ids a format prints in brackets. A logger or class name between the timestamp and the message stays in the name, as in `oteldemo_AdService_...` below.

    Timestamps, variables and repeated words never enter the name.

??? tenx-advanced "Identifier fragments"

    Every stage skips a library word that is part of a value. Glue is one `-`, `_`, `.` or `$`, and a chain is a run of tokens joined by glue. A word is a fragment when:

    - a neighbour, directly or across one glue, is a variable, numbers included;
    - its chain has two or more pieces and one of them carries a digit;
    - it carries a digit next to a `/`, such as `subdir2`;
    - its chain has a `.`, two or more pieces, and ends in `:` and a variable, such as `www.evernote.com:443`;
    - it sits in a path with two or more `/` and a variable piece;
    - it is eight or more upper-case letters and digits, both present, such as `L9ECAV7KIM`.

    The rules read only token types, delimiters and the word itself, so every line of a template gets the same verdict, and one statement keeps one name however its ids are spelled (`R21-M0-N4-C:J05-U11`, `req-b3e2...`). The trade-off: a dotted metric name loses a library word in its digit-bearing segment, a REST route loses the words after a variable segment (`/v2/<tenant>/servers/detail`), a `file:line` citation such as `server.py:127` matches the `host:port` rule, and an all-caps code such as `AES256GCM` reads as an id.

    Inside a JSON string a line break or tab arrives as `\` and a letter. After an odd run of backslashes, a token starting with `n`, `r` or `t` keeps only its remainder (`\nOrder` gives `Order`); an even run is an escaped backslash and keeps the word.

??? tenx-extractors "Input field"

    `inputField` limits the search to named JSON fields: `inputField: log` reads only the `log` value. With several fields, the first one the event carries as a JSON key is read, whether or not it yields a word. A field parsed out of free text (`org.mortbay.log: jetty-6.1.26`) is read only when it yields a word; otherwise the next field is tried. Name, skeleton and origin read the same field, so envelope keys such as `stream`, `docker` and `kubernetes` stay out of the name.

    [`symbolContexts`](#symbolcontexts) filters which symbol contexts take part. Contexts are evaluated in one pass, so list order filters and does not rank.

??? tenx-group "Multi-line events"

    A multi-line event is named from one member, its lead. With [`symbolGroupLead`](https://doc.log10x.com/run/transform/symbol/#symbolgrouplead) set to `firstWithMessage`, the lead is the first member with a word past the preamble; a name chained by a [joiner](https://doc.log10x.com/run/transform/symbol/#symbolpreamblejoiners), such as `cart.cartstore.ValkeyCartStore`, counts as preamble. The .NET console logger writes `info: cart.cartstore.ValkeyCartStore[0]` and `GetCartAsync called with userId=...` as two records, and the name, skeleton and origin come from the second. A head that holds a message, such as a stack trace's exception line, is the lead, as is the head of an event whose members are all preamble.

??? tenx-template "Shape names"

    A line with no library word is named `template_` and 16 hex digits: a hash of the field's normalized shape, meaning its constant words and punctuation, one marker per run of variables, one per timestamp in any format, and one space per run of whitespace. One statement keeps one name across padded columns, millisecond widths and repeated values, and the name is a valid metric label. A library update that turns a value on the line into a library word, or the reverse, changes the shape and the name.

??? tenx-default "Single-word fallback"

    When the selected sequence is a single token, the module re-runs the selection under the `any` context: the library words from the first word of the message, each once, minus identifier fragments, without ranking. The words before the message are preamble: [reserved](https://doc.log10x.com/run/transform/symbol/#symbolsequencereserved) words, text inside an [enclosure](https://doc.log10x.com/run/transform/symbol/#symbolpreambleenclosures) that closes within the field, and a reserved key with its value bound by an [assigner](https://doc.log10x.com/run/transform/symbol/#symbolpreambleassigners).

    A logger or class name such as `org.apache.kafka.log.LocalLog` stays in the name, since it is often the only text that tells two statements apart. A [message key](https://doc.log10x.com/run/transform/symbol/#symbolpreamblemessagekeys) (`msg=starting`, `"msg":"Serving metrics"`, `body: 'Charge request received.'`) is preamble; when an assigner binds it, the message starts inside its value at the first word none of these rules describe, `Subchannel` in `"msg":"[core][Channel #1] Subchannel created"`. In a record that opens with `{`, reading starts at the first such key that binds. `:` binds only in record form, a quoted key or a quoted value, so `WARN: GF_INSTALL_PLUGINS is deprecated` and `INFO:root:Starting worker` bind nothing.

:material-github: See the [JavaScript implementation](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/initialize/message/message-template.js) of this module on Github.

## :material-shield-check-outline: Stability

The same engine version, symbol library and configuration give the same name to every event of a template, whatever other traffic the run carries and however many times it runs.

??? tenx-checklist "Repeatability"

    Every ranking key is an integer derived from the line's content and the library, so no earlier line in the run changes the verdict. A tie that the authorship check also leaves open falls back to candidate order, which is keyed on content and so identical in every run and on every node. Two caps can hide a true origin: [`symbolMaxOrigins`](https://doc.log10x.com/run/transform/symbol/#symbolmaxorigins) (default 64, the cap that binds at runtime) and [`maxSymbolUnitsPerToken`](https://doc.log10x.com/run/symbol/#maxsymbolunitspertoken) (default 128, approximate, stopping in the low 130s).

??? tenx-scale "Cardinality bounds"

    - A value outside the library never enters a name: PIDs, IPs, IDs and timestamps.
    - A value that is a library word can, such as a username like `admin`, a service name inside a hostname, or a migration name. One Grafana migration statement yields 666 patterns, one per migration name. A cap applies per pattern, so the noisy migration is capped and its quiet siblings are not.
    - Shape names are bounded by the data's structure.
    - Patterns never outnumber templates; several templates of one statement share one pattern.

??? tenx-failuremode "Limits"

    - The compiler parses Java, Scala, Python, Go, JavaScript, TypeScript, Rust, C#, C and C++ source, and compiled Java classes. Ruby, Kotlin, PHP, Swift, Lua, Groovy and bash literals, and those of the TypeScript and Rust repositories in the default library, come from quoted-string extraction with no scope; compiling the code gives scoped symbols.
    - Message text built in a helper method that neither logs nor throws has no origin unless the literal carries a format placeholder; the line is named by its library words.
    - Origin is a ranking: it names the scope that best explains the line's message text.
    - Web access logs are named by referer host and browser family under the default configuration.

## :material-fingerprint: Pattern Identity { #pattern-identity-pattern-vs-template }

The pattern is the unit of cost attribution, and its hash is the identity tools and metrics key on.

| Term | What it is | Used for |
|---|---|---|
| **Pattern** (`symbolMessage`) | The selected subset of the line's words, such as `Receive ListRecommendations for product ids` | Cost attribution |
| **`pattern_hash`** (`tenx_hash`) | The hash of the pattern, written to [`symbolMessageHashField`](#symbolmessagehashfield). Holds across restarts and pod renames, and value-only variants of one statement share it | Stable identity for tools and metrics |
| **Template** | The full shape of the line, every token kept and each variable slot marked `$`. One pattern spans one template per format variant | Compact form |
| **`template_hash`** | The key from a compact event to its `templates.json` entry, used when the event is expanded; many templates map to one pattern | Expansion |

A recompiled library, or an engine upgrade that changes naming rules, renames the affected patterns once. A shape name changes when its shape does.

??? tenx-info "Field names by surface"

    A compact event's leading segment carries the template join key, which expansion uses to rebuild the line from `templates.json`. The Splunk app extracts it as `tenx_hash`, and the Elasticsearch plugin looks it up in its `l1es_dml` index. The pattern hash is a separate value, written to [`symbolMessageHashField`](#symbolmessagehashfield), which also defaults to `tenx_hash`. So `tenx_hash` holds the join key on a compact event in Splunk and the pattern hash on an enriched event out of the engine: the first says which template rebuilds the line, the second which pattern the line belongs to.

## :material-file-document-outline: Examples

=== ":simple-opentelemetry: OTel Demo"

    ```json
    {
      "stream": "stderr",
      "log": "2025-04-17 14:32:40,287 INFO [main] [recommendation_server.py:47] - Receive ListRecommendations for product ids:['L9ECAV7KIM', '0PUK6V6EV0']",
      "kubernetes": { "container_name": "recommendationservice", "namespace_name": "default" }
    }
    ```

    **Pattern:** `Receive_ListRecommendations_for_product_ids`

    **Origin:** `recommendation_server.py:ListRecommendations`

=== ":simple-dotnet: .NET"

    A header record from the .NET console logger, then the message:

    ```json
    { "stream": "stdout", "log": "info: cart.cartstore.ValkeyCartStore[0]", "kubernetes": { "container_name": "cart" } }
    { "stream": "stdout", "log": "      GetCartAsync called with userId=02fec73e-9f03-11f0-9b9e-a666c4b68b87", "kubernetes": { "container_name": "cart" } }
    ```

    **Pattern:** `GetCartAsync_called_with_userId`

    **Origin:** `ValkeyCartStore.cs:ValkeyCartStore`

=== ":fontawesome-brands-java: Java"

    ```json
    {
      "stream": "stdout",
      "log": "2025-10-01 20:12:37 - oteldemo.AdService - Targeted ad request received for [accessories] trace_id=262794c5d52cea66092b4d8de7d1c6ed span_id=11dc1636e05888c3 trace_flags=01 ",
      "kubernetes": { "container_name": "ad", "namespace_name": "default" }
    }
    ```

    **Pattern:** `oteldemo_AdService_Targeted_ad_request_received_for`

    **Origin:** `AdService.java:getAds`

=== ":material-web: Web"

    ```json
    {
      "stream": "stdout",
      "log": "192.168.43.96 - - [01/Aug/2025:22:21:50 +0000] \"GET /products/LensCleaningKit.jpg HTTP/1.1\" 200 101928 \"http://frontend-proxy:8080/\" \"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/133.0.0.0 Safari/537.36\"",
      "kubernetes": { "container_name": "image-provider", "namespace_name": "default" }
    }
    ```

    **Pattern:** `GET_HTTP_http_frontend_proxy_Mozilla_X_Linux_AppleWebKit_KHTML_like_Gecko_Safari`

    **Origin:** none

## :material-rocket-launch-outline: Applications

<div class="grid cards" markdown>

-   :material-chart-bar:{ .lg .middle } **Cost tracking**

    ___

    Rank event types by volume and cost, per pattern.

    [:octicons-arrow-right-24: Reporter](https://doc.log10x.com/apps/reporter/)

-   :material-tune-variant:{ .lg .middle } **Cost control**

    ___

    Sample, mute or compact each pattern before it is billed.

    [:octicons-arrow-right-24: Receiver](https://doc.log10x.com/apps/receiver/)

-   :material-chart-timeline-variant:{ .lg .middle } **Metrics**

    ___

    Publish per-pattern metrics to Datadog, CloudWatch and Prometheus.

    [:octicons-arrow-right-24: Metric outputs](https://doc.log10x.com/run/output/metric/)

-   :material-code-braces:{ .lg .middle } **Compiled from code**

    ___

    Names come from symbol libraries compiled from source; recompiling after a code change updates them, with no regex to maintain.

    [:octicons-arrow-right-24: Symbol library](https://doc.log10x.com/compile/link/#symbol-library)

</div>
