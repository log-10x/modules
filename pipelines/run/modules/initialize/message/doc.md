---
icon: material/origin
---

Extracts consistent message identifiers from log events for accurate log-to-metrics conversion and cost control.

Raw log events contain high-cardinality [variable](https://doc.log10x.com/run/transform/structure/#variables) data (timestamps, IDs, values) mixed with constant, low-cardinality [symbols](https://doc.log10x.com/run/transform/structure/#symbols).

The message initializer uses symbol libraries to isolate stable [message patterns](https://doc.log10x.com/run/transform/symbol/) from each event, enabling accurate classification of event instances by their logical type.

## :material-target: Message Extraction

The initializer identifies the core message pattern by selecting the longest sequence of consecutive symbols from a [TenXTemplate](https://doc.log10x.com/run/template/ "Import joint JSON schemas files to expand events into typed TenXObjects.") originating from the same source code or binary file.

The `inputField` parameter limits searches to specific JSON fields. Setting `inputField: log` searches only within the log field content.

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

📈 **Cost control**: Apply intelligent filtering using the [Regulator](https://doc.log10x.com/apps/regulator/) app to prevent over-billing

🤖 **Multi-platform analytics**: Feed patterns into AIOps and monitoring systems via [metric outputs](https://doc.log10x.com/run/output/metric/) for Datadog, CloudWatch, SignalFx, and Prometheus

🔄 **Automatic adaptation**: Updates automatically with code changes using [symbol libraries](https://doc.log10x.com/compile/link/#symbol-library). No manual regex pattern configuration and maintenance
