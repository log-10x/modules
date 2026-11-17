---
icon: material/play-circle-outline
---

The Reporter app is the **read-only insights arm** of the 10x pipeline. It pinpoints high-cost app/infra events **before** forwarders ship them to log analyzers, enabling storage and licensing **cost optimization**.

**Deployment**: a DaemonSet alongside your forwarder, *not* a sidecar injected into it, and *not* a cloud app polling your SIEM's REST API. The reporter tails the same event stream your forwarder sees (pre-SIEM) and publishes cost insight metrics.

With Fluent Bit, Fluentd, the OTel Collector and the Splunk Universal Forwarder, logs keep reaching their destination while the Reporter is down. Logstash stops reading once the Reporter's queue is full, and resumes when the Reporter is back. Filebeat exits when the Reporter goes down, and resumes where it stopped once it is started again. No line is lost or sent twice, so run the Reporter as part of the same deployment. Each tab below adds what sends the Reporter a copy of each event, and the forwarder's existing destinations stay as they are. Similar deployment pattern to `datadog-agent` or `splunk-otel-collector`.

The engine never moves or stores log data. Its only write is per-pattern metrics, sent to a time-series backend of the customer's choice (Prometheus, Datadog, Elastic, CloudWatch, and others). With no backend configured, metrics are collected locally and sent nowhere; fully air-gapped operation is supported. Events never leave the customer's path.

Log10x is normally driven by an AI agent (Claude, or a model the customer brings) through the log10x MCP server, which installs, configures, and queries via MCP tools: deploy via `log10x_advise_install`, verify via `log10x_doctor`. To trial without deploying anything, run `log10x_poc_from_local` (local sample files) or `log10x_poc_from_siem` (a SIEM sample). The manual steps below are the same operations without an agent.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

???+ tenx-bootstrap "Step 1: Install"

    Install the engine on the same machine as your log forwarder. The script installs the [`Runtime`](https://doc.log10x.com/engine/flavors/#runtime) native binary; the DEB and RPM packages carry either the [`Compiler`](https://doc.log10x.com/engine/flavors/#compiler) or [`Runtime (JVM)`](https://doc.log10x.com/engine/flavors/#runtime-jvm). Windows has no native build, so the PowerShell script installs `Runtime (JVM)`:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor runtime"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor runtime"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install log-10x/tap/log10x"){data-copy="brew install log-10x/tap/log10x"}
    - :material-microsoft-windows: [PowerShell script](https://doc.log10x.com/install/win/)
    - :simple-docker: [Docker image](https://doc.log10x.com/install/docker/)

??? tenx-config "Step 2: Set Environment Variables"

    Set these environment variables before running. See [path configuration](https://doc.log10x.com/install/paths/) for details.

    | Variable | Description |
    |----------|-------------|
    | `TENX_MODULES` | Path to your [modules directory](https://doc.log10x.com/install/paths/#modules) |
    | `TENX_CONFIG` | Path to your [configuration directory](https://doc.log10x.com/install/paths/#config) |
    | `TENX_LICENSE_KEY` | Your Log10x license JWT ([licensing](https://doc.log10x.com/manage/license/)); unset, the engine runs on the built-in Free tier (up to 10 nodes, no expiry) |

    ```bash
    export TENX_MODULES=/etc/tenx/modules
    export TENX_CONFIG=/etc/tenx/config
    export TENX_LICENSE_KEY="$(cat license.jwt)"
    ```

    For production deployments, mount the license as a file and set `TENX_LICENSE_FILE` instead.

??? tenx-forwarderinputs "Step 3: Configure Your Forwarder"

    === ":simple-fluentd: Fluentd"

        Use a `copy` directive to report on events while still sending them to output. The second `<store>` sends a copy of each event to the Reporter's Forward input on port 24224, the same handoff as the [tenx-sidecar.conf](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/fluentd/conf/tenx-sidecar.conf) recipe:

        ```xml title="my-fluentd.conf"
        <source>
          @type tail
          path /path/to/file.log
          tag my_logs
          <parse>
            @type none
          </parse>
        </source>

        <match my_logs>
          @type copy

          # Write to output (e.g. Elastic, Splunk)
          <store>
            @type stdout
          </store>

          # Report to 10x
          <store>
            @type forward
            <server>
              host 127.0.0.1
              port 24224
            </server>
          </store>
        </match>
        ```

        !!! note
            For large files or volume surges, set [XMX](https://www.baeldung.com/jvm-parameters#explicit-heap-memory---xms-and-xmx-options) or use [read_bytes_limit_per_second](https://docs.fluentd.org/input/tail#read_bytes_limit_per_second).

    === ":simple-fluentbit: Fluent-bit"

        Add a `forward` output that sends a copy of each event to the Reporter's Forward input on port 24224, the same handoff as the [tenx-sidecar.conf](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-sidecar.conf) recipe. The existing outputs stay as they are. The output catches all events; to report on a subset, update the `Match` field:

        ```toml title="my-fluent-bit.conf"
        # Report: send a copy of each event to the Reporter.
        [OUTPUT]
            Name         forward
            Match        *
            Host         127.0.0.1
            Port         24224
        ```

    === ":simple-beats: Filebeat"

        Add the reporter processor script to your configuration:

        ```yaml title="my-filebeat.yml"
        filebeat.inputs:
          - type: filestream
            id: my-filestream-id
            paths:
              - /path/to/log

            processors:
              - script:
                  lang: javascript
                  file: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/script/tenx-report.js
        ```

    === ":simple-logstash: Logstash"

        Give the copy for the Reporter its own pipeline with a persisted queue, so the existing outputs do not wait for the Reporter. In `pipelines.yml`, the `ingest` pipeline holds the existing inputs and filters and sends each event to two pipelines: `destinations`, which holds the existing outputs, and `tenx-report`, which sends a copy to the Reporter's Logstash input on port 5044, the same handoff as the [tenx-ingest.conf](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/logstash/conf/tenx-ingest.conf) recipe:

        ```yaml title="pipelines.yml"
        - pipeline.id: ingest
          path.config: "/etc/logstash/conf.d/ingest.conf"
        - pipeline.id: destinations
          path.config: "/etc/logstash/conf.d/destinations.conf"
        - pipeline.id: tenx-report
          queue.type: persisted
          path.config: "/etc/logstash/conf.d/tenx-report.conf"
        ```

        ```ruby title="ingest.conf"
        input {
          # Existing inputs and filters stay here.
        }
        output {
          pipeline { send_to => ["destinations"] }
          pipeline { send_to => ["tenx-report"] }
        }
        ```

        ```ruby title="destinations.conf"
        input { pipeline { address => "destinations" } }
        output {
          # Existing outputs (e.g. Elastic, Splunk) move here.
        }
        ```

        ```ruby title="tenx-report.conf"
        input { pipeline { address => "tenx-report" } }
        output {
          # Report: send a copy of each event to the Reporter.
          tcp {
            host  => "127.0.0.1"
            port  => 5044
            codec => json_lines
          }
        }
        ```

        While the Reporter is down, the `tenx-report` queue keeps the copies on disk and the existing outputs keep receiving events. The Reporter receives the queued copies when it is back. If the queue fills up first, at `queue.max_bytes` (1024mb unless set), Logstash stops reading new events until the Reporter is back.

    === ":simple-opentelemetry: OTel Collector"

        Add an `otlp` exporter that sends a copy of each log record to the Reporter's OTLP input on port 4317, the same handoff as the [tenx-sidecar.yaml](https://github.com/log-10x/modules/blob/main/pipelines/run/modules/input/forwarder/otel-collector/conf/tenx-sidecar.yaml) recipe, and add it to the exporters of the existing logs pipeline. The existing exporters stay as they are:

        ```yaml title="my-otelcol.yaml"
        exporters:
          # Report: send a copy of each log record to the Reporter.
          otlp/tenx:
            endpoint: 127.0.0.1:4317
            tls:
              insecure: true
            # The Reporter answers a request once its records are processed, which
            # can take several seconds; a shorter timeout sends the request again.
            timeout: 30s
            # Requests of at most 2 MiB, whatever the pipeline's batch processor
            # sends: the Reporter refuses a request above its message limit, and
            # the Collector drops a refused request.
            sending_queue:
              enabled: true
              batch:
                flush_timeout: 1s
                sizer: bytes
                min_size: 1048576
                max_size: 2097152

        service:
          pipelines:
            logs:
              receivers: [filelog]                    # existing receivers
              exporters: [elasticsearch, otlp/tenx]   # existing exporters, plus otlp/tenx
        ```

    === ":simple-splunk: Splunk UF"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, reports on events, and writes to Folder B. Splunk UF monitors Folder B and handles forwarding to Splunk indexers. Events are unchanged - 10x only observes and reports metrics.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # UF reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, report, and write to Folder B:

        ```toml title="fluent-bit-splunk.conf"
        [SERVICE]
            Flush        1
            Log_Level    info
            storage.path ${FOLDER_A}/flb-storage

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs
            storage.type filesystem

        # Report: send a copy of each event to the Reporter.
        [OUTPUT]
            Name         forward
            Match        app.*
            Host         127.0.0.1
            Port         24224

        # Write events (unchanged) to Folder B
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       template
            Template     {log}
        ```

        **Step 3**: Configure Splunk UF to monitor Folder B:

        ```ini title="inputs.conf"
        [monitor://${FOLDER_B}]
        index = main
        sourcetype = app_logs
        ```

        This keeps Splunk UF as the forwarder (handling buffering, retries, timeouts) while 10x reports on events inline. See the [Splunk UF module](https://doc.log10x.com/run/input/forwarder/splunkUF/) for details.

    === ":simple-datadog: Datadog Agent"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, reports on events, and writes to Folder B. Datadog Agent monitors Folder B and handles forwarding to Datadog. Events are unchanged - 10x only observes and reports metrics.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # DD Agent reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, report, and write to Folder B:

        ```toml title="fluent-bit-datadog.conf"
        [SERVICE]
            Flush        1
            Log_Level    info
            storage.path ${FOLDER_A}/flb-storage

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs
            storage.type filesystem

        # Report: send a copy of each event to the Reporter.
        [OUTPUT]
            Name         forward
            Match        app.*
            Host         127.0.0.1
            Port         24224

        # Write events (unchanged) to Folder B
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       template
            Template     {log}
        ```

        **Step 3**: Configure Datadog Agent to monitor Folder B:

        ```yaml title="conf.d/tenx.d/conf.yaml"
        logs:
          - type: file
            path: ${FOLDER_B}/*   # the file output names each file after its tag, here app.logs
            service: myapp
            source: myapp
        ```

        This keeps Datadog Agent as the forwarder (handling buffering, retries, metadata enrichment) while 10x reports on events inline. See the [Datadog Agent module](https://doc.log10x.com/run/input/forwarder/datadogAgent/) for details.

    === ":material-test-tube: Test (no forwarder)"

        Test the reporter without setting up a forwarder using the [Dev CLI](https://doc.log10x.com/apps/dev/).

        The dev app uses the [file input module](https://doc.log10x.com/run/input/file/) to read sample log files and generates cost analytics reports, allowing you to verify reporting behavior before integrating with your forwarder.

        **No forwarder configuration required** - provide sample log files to the file input module and skip to [Step 7](#__tabbed_6_5) to run the test.

??? tenx-symbols "Step 4: Symbol Library (optional)"

    Load custom [Symbol library](https://doc.log10x.com/compile/) files to transform events into typed TenXObjects.

    Place symbol files in the `symbolPaths` folders specified in the [symbol config](#symbols).

??? tenx-initializers "Step 5: Enrichments (optional)"

    Enrichments add context (severity, HTTP codes) for richer aggregation reports.

    **To enable:**

    1. In the [app config](#mainConfig), uncomment the desired enrichment `include` entries
    2. In the [initializers](#initializers) section below, configure each enrichment's settings

??? tenx-metricoutputs "Step 6: Metrics Output (optional)"

    Publish [aggregated](https://doc.log10x.com/run/aggregate/) metrics to time-series databases (Prometheus, Datadog).

    **To enable:**

    1. In the [app config](#mainConfig), uncomment the desired metric output `include` entry
    2. In the [metric outputs](#metricOutputs) section below, configure connection details

??? tenx-mainconfig "Step 7: Run"

    Start your forwarder with the updated configuration:

    === ":simple-fluentd: Fluentd"

        Start the Reporter first, then Fluentd:

        ```console
        $ tenx run @apps/reporter
        $ fluentd -c my-fluentd.conf
        ```

    === ":simple-fluentbit: Fluent-bit"

        Start the Reporter first, then Fluent Bit:

        ```console
        $ tenx run @apps/reporter
        $ fluent-bit -c my-fluent-bit.conf
        ```

    === ":simple-beats: Filebeat"

        ```console title="Nix/OSX"
        $ filebeat -c my-filebeat.yml -e 2>&1 | receiverReadOnly=true /opt/tenx-edge/bin/tenx run @run/input/forwarder/filebeat @apps/reporter
        ```

        ```console title="Windows"
        $ set receiverReadOnly=true
        $ filebeat -c my-filebeat.yml -e 2>&1 | "c:\program files\tenx-edge\tenx" run @run/input/forwarder/filebeat @apps/reporter
        ```

        `receiverReadOnly=true` keeps the Reporter from sending events back to Filebeat.

    === ":simple-logstash: Logstash"

        Start the Reporter with its Logstash input first, then Logstash, which reads `pipelines.yml` from its settings folder:

        ```console
        $ receiverReadOnly=true tenx run @run/input/forwarder/logstash @apps/reporter
        $ logstash --path.settings /etc/logstash
        ```

        `receiverReadOnly=true` keeps the Reporter from sending events back to Logstash.

    === ":simple-opentelemetry: OTel Collector"

        Start the Reporter with its OTLP input first, then the Collector:

        ```console
        $ receiverReadOnly=true tenx run @run/input/forwarder/otel-collector @apps/reporter
        $ otelcol-contrib --config=my-otelcol.yaml
        ```

        `receiverReadOnly=true` keeps the Reporter from sending log records back to the Collector.

    === ":simple-splunk: Splunk UF"

        **Step 1**: Start the Reporter first, then Fluent Bit:

        ```console
        $ tenx run @apps/reporter
        $ fluent-bit -c fluent-bit-splunk.conf
        ```

        **Step 2**: Start (or restart) Splunk UF to pick up Folder B:

        ```console
        $ splunk restart
        ```

        Fluent Bit + 10x will read from Folder A, report on events (without modification), and write to Folder B. Splunk UF monitors Folder B and forwards to indexers.

    === ":simple-datadog: Datadog Agent"

        **Step 1**: Start the Reporter first, then Fluent Bit:

        ```console
        $ tenx run @apps/reporter
        $ fluent-bit -c fluent-bit-datadog.conf
        ```

        **Step 2**: Start (or restart) the Datadog Agent to pick up Folder B:

        ```console
        $ sudo systemctl restart datadog-agent
        ```

        Fluent Bit + 10x will read from Folder A, report on events (without modification), and write to Folder B. Datadog Agent monitors Folder B and forwards to Datadog.

    === ":material-test-tube: Test (no forwarder)"

        Use the [Dev CLI](https://doc.log10x.com/apps/dev/) to test event processing with sample log files.

        **Step 1**: Provide sample log files to the [file input module](https://doc.log10x.com/run/input/file/):

        ```console
        $ cp /path/to/sample.log $TENX_CONFIG/data/sample/input/
        ```

        **Step 2**: Run the dev app:

        ```console
        $ tenx run @apps/dev
        ```

        The dev app reads events from `data/sample/input/*.log` via the file input module and generates cost analytics reports without needing a forwarder.

        **View results in the dashboard** after running to verify reporting works correctly.

??? tenx-checklist "Step 8: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location). For debugging techniques including enabling verbose logging, see [Engine Logging](https://doc.log10x.com/manage/logging/).

    With an agent, `log10x_doctor` confirms reporter detection and metric freshness, and `log10x_baseline` captures the starting per-pattern volume and cost.

    **View results in the dashboard:**

    Once running, view your cost analytics in the [Reporter Dashboard](https://doc.log10x.com/roi-analytics/#edge-reporter).

??? tenx-delete "Step 9: Teardown"

    Nothing runs in the background. Uninstall removes only what was installed.

    === ":simple-macos: Homebrew"

        ```bash
        brew uninstall log10x
        ```

    === ":simple-linux: Linux"

        ```bash
        sudo rm -rf /opt/tenx-edge /etc/tenx /etc/profile.d/tenx-edge.sh
        ```

        If installed via DEB: `sudo apt-get remove tenx-edge`
        If installed via RPM: `sudo yum remove tenx-edge`

    === ":material-microsoft-windows: Windows"

        Uninstall from **Settings > Apps > Installed apps**.

    === ":simple-docker: Docker"

        ```bash
        docker rmi log10x/pipeline-10x:1.1.181
        ```
