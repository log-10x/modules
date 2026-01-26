---
icon: material/play-circle-outline
---

Reduce log volume 50-80% by losslessly [compacting](https://doc.log10x.com/run/transform/#compact) events before shipping to analytics platforms. Events are compacted by extracting repetitive structures into reusable templates.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

??? tenx-bootstrap "Step 1: Install"

    Install the `Edge` or `JIT-Edge` binary flavor on the same machine as your log forwarder:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install --cask log-10x/tap/log10x"){data-copy="brew install --cask log-10x/tap/log10x"}
    - :material-microsoft-windows: [PowerShell script](https://doc.log10x.com/install/win/)
    - :simple-docker: [Docker image](https://doc.log10x.com/install/docker/)

??? tenx-config "Step 2: Set Environment Variables"

    Set these environment variables before running. See [path configuration](https://doc.log10x.com/install/paths/) for details.

    | Variable | Description |
    |----------|-------------|
    | `TENX_MODULES` | Path to your [modules directory](https://doc.log10x.com/install/paths/#modules) |
    | `TENX_CONFIG` | Path to your [configuration directory](https://doc.log10x.com/install/paths/#config) |
    | `TENX_API_KEY` | Your Log10x API key ([get one](https://doc.log10x.com/run/bootstrap/#apikey)) |

    ```bash
    export TENX_MODULES=/etc/tenx/modules
    export TENX_CONFIG=/etc/tenx/config
    export TENX_API_KEY=your-api-key
    ```

    See [best practices](https://doc.log10x.com/engine/gitops/#best-practices) for managing secrets in production.

??? tenx-forwarderinputs "Step 3: Configure Your Forwarder"

    === ":simple-fluentd: Fluentd"

        **Step 1**: Include the 10x optimizer configuration:

        ```toml title="my-fluentd.conf"
        # Nix/OSX
        @include "#{ENV['TENX_MODULES']}/pipelines/run/modules/input/forwarder/fluentd/conf/tenx-optimize-unix.conf"

        # Windows
        # @include "#{ENV['TENX_MODULES']}/pipelines/run/modules/input/forwarder/fluentd/conf/tenx-optimize-stdio.conf"
        ```

        **Step 2**: Apply the `@TENX` label to route events through the optimizer:

        === "Route Start"

            Process events directly after reading from input (simplest setup):

            ```xml title="my-fluentd.conf"
            <source>
              @type tail
              path /path/to/file
              tag my_tag
              @label @TENX
            </source>
            ```

            Optimized events are marked with `@TENX-PROCESSED`. To re-apply `@ROOT`:

            ```toml
            @include "#{ENV['TENX_MODULES']}/pipelines/run/modules/forwarder/fluentd/conf/auxiliary/root.conf"
            ```

        === "Route End"

            Process events after all filters have been applied:

            ```xml title="my-fluentd.conf"
            <source>
              @type tail
              tag my_logs
            </source>

            <filter my_logs>
              @type filter1
            </filter>

            <filter my_logs>
              @type filter2
            </filter>

            <match my_logs>
              @type relabel
              @label @TENX
            </match>

            <label @TENX-PROCESSED>
              <match my_logs>
                @type stdout
              </match>
            </label>
            ```

        === "Mid-Route"

            Insert the optimizer between specific plugins:

            ```xml title="my-fluentd.conf"
            <source>
              @type tail
              tag my_logs
            </source>

            <filter my_logs>
              @type filter1
            </filter>

            <match my_logs>
              @type relabel
              @label @TENX
            </match>

            <label @TENX-PROCESSED>
              <filter my_logs>
                @type filter2
              </filter>

              <match my_logs>
                @type stdout
              </match>
            </label>
            ```

        **Step 3**: Include template output for your destination:

        ```toml title="my-fluentd.conf"
        # Splunk
        @include "#{ENV['TENX_MODULES']}/pipelines/run/input/forwarder/fluentd/optimize/tenx-splunk.conf"

        # Elasticsearch
        @include "#{ENV['TENX_MODULES']}/pipelines/run/input/forwarder/fluentd/optimize/tenx-elastic.conf"
        ```

        !!! note
            For large files or volume surges, set [XMX](https://www.baeldung.com/jvm-parameters#explicit-heap-memory---xms-and-xmx-options) or use [read_bytes_limit_per_second](https://docs.fluentd.org/input/tail#read_bytes_limit_per_second).

    === ":simple-fluentbit: Fluent-bit"

        **Step 1**: Include the 10x optimizer configuration:

        ```toml title="my-fluent-bit.conf"
        # Nix/OSX
        @INCLUDE /etc/tenx/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-optimize.conf
        @INCLUDE /etc/tenx/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-unix.conf

        # Windows
        # @INCLUDE c:/program files/tenx-edge/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-optimize.conf
        # @INCLUDE c:/program files/tenx-edge/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-tcp.conf
        ```

        **Step 2**: The Lua filter catches all events by default. To optimize a subset, update the `Match` field:

        ```toml title="tenx-optimize.conf"
        [FILTER]
            Name Lua
            Match *
            script ${TENX_MODULES}/${tenx_lua}
            call tenx_process
        ```

        **Step 3**: Include template output for your destination:

        ```toml title="my-fluent-bit.conf"
        # Nix/OSX - Splunk
        @INCLUDE /etc/tenx/config/pipelines/run/input/forwarder/fluentbit/optimize/tenx-splunk.conf

        # Nix/OSX - Elasticsearch
        @INCLUDE /etc/tenx/config/pipelines/run/input/forwarder/fluentbit/optimize/tenx-elastic.conf
        ```

    === ":simple-beats: Filebeat"

        **Step 1**: Add the 10x input for receiving optimized events:

        ```yaml title="my-filebeat.yml"
        filebeat.config.inputs:
          enabled: true
          # Nix/OSX
          path: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/optimize/tenxNix.yml
          # Windows
          # path: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/optimize/tenxWin.yml
        ```

        **Step 2**: Add the optimizer processor:

        ```yaml title="my-filebeat.yml"
        filebeat.inputs:
          - type: filestream
            id: my-filestream-id
            paths:
              - /path/to/log

            processors:
              - script:
                  lang: javascript
                  file: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/script/tenx-optimize.js
        ```

        **Step 3**: Configure template output (Elasticsearch example):

        ```yaml title="my-filebeat.yml"
        output.elasticsearch:
          hosts: ["localhost:9200"]
          indices:
            - index: "l1es_dml"
              when.has_fields: ["template", "templateHash"]
        ```

    === ":simple-logstash: Logstash"

        Set up [multiple pipelines](https://www.elastic.co/guide/en/logstash/current/multiple-pipelines.html) in `pipelines.yml`:

        ```yaml title="pipelines.yml"
        - pipeline.id: raw_input
          path.config: "/path/to/conf/upstream.conf"
        - pipeline.id: tenx_pipeline
          path.config: "${TENX_CONFIG}/pipelines/run/input/forwarder/logstash/optimize/tenx-pipe-out.conf"
        - pipeline.id: tenx_unix_pipeline
          path.config: "${TENX_CONFIG}/pipelines/run/input/forwarder/logstash/optimize/tenx-pipe-in-unix.conf"
        - pipeline.id: processed
          path.config: "/path/to/conf/downstream.conf"
        ```

        ```ruby title="upstream.conf"
        input {
          file { path => /path/to/log }
        }
        output {
          pipeline { send_to => tenx_input_pipeline }
        }
        ```

        ```ruby title="downstream.conf"
        input {
          pipeline { address => user_output_pipeline }
        }
        output {
          stdout { codec => json }
        }
        ```

    === ":simple-opentelemetry: OTel Collector"

        !!! note "Requires otel-collector-contrib"
            The OpenTelemetry Collector integration requires the **contrib** distribution for `syslogexporter` and `fluentforwardreceiver` support.

        **Step 1**: Copy the OTel Collector configuration:

        ```bash
        cp $TENX_MODULES/pipelines/run/modules/input/forwarder/otel-collector/optimize/tenxNix.yaml /etc/otelcol-contrib/
        ```

        **Step 2**: Update the configuration to match your log sources:

        ```yaml title="optimize/tenxNix.yaml"
        receivers:
          filelog:
            include:
              - /var/log/**/*.log  # Customize paths
            start_at: end
        ```

        **Step 3**: Configure your final exporters in the `logs/from-tenx` pipeline:

        ```yaml title="optimize/tenxNix.yaml"
        service:
          pipelines:
            # Logs go TO Log10x for lossless compact
            logs/to-tenx:
              receivers: [filelog, otlp]
              processors: [memory_limiter, batch]
              exporters: [syslog/tenx]

            # Optimized (encoded) logs come FROM Log10x to final destinations
            logs/from-tenx:
              receivers: [fluentforward/tenx]
              processors: [batch]
              exporters: [elasticsearch]  # Add your exporters
        ```

        Two separate pipelines prevent infinite loops - events in `logs/from-tenx` never feed back to `logs/to-tenx`. Events are losslessly compacted, reducing log volume by 50-80%.

    === ":simple-splunk: Splunk UF"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, optimizes events, and writes to Folder B. Splunk UF monitors Folder B and handles forwarding to Splunk indexers.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # UF reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, optimize, and write to Folder B:

        ```toml title="fluent-bit-splunk.conf"
        [SERVICE]
            Flush        1
            Log_Level    info

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs

        # Include 10x optimizer - sends events to 10x subprocess
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-optimize.conf

        # Include Unix socket - receives processed events back from 10x
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-unix.conf

        # Write optimized events to Folder B
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       plain
        ```

        **Step 3**: Configure Splunk UF to monitor Folder B:

        ```ini title="inputs.conf"
        [monitor://${FOLDER_B}]
        index = main
        sourcetype = app_logs_encoded
        ```

        This keeps Splunk UF as the forwarder (handling buffering, retries, timeouts) while 10x optimizes events inline. See the [Splunk UF module](https://doc.log10x.com/run/input/forwarder/splunkUF/) for details.

    === ":simple-datadog: Datadog Agent"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, optimizes events, and writes to Folder B. Datadog Agent monitors Folder B and handles forwarding to Datadog.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # DD Agent reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, optimize, and write to Folder B:

        ```toml title="fluent-bit-datadog.conf"
        [SERVICE]
            Flush        1
            Log_Level    info

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs

        # Include 10x optimizer - sends events to 10x subprocess
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-optimize.conf

        # Include Unix socket - receives processed events back from 10x
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-unix.conf

        # Write optimized events to Folder B
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       plain
        ```

        **Step 3**: Configure Datadog Agent to monitor Folder B:

        ```yaml title="conf.d/tenx.d/conf.yaml"
        logs:
          - type: file
            path: ${FOLDER_B}/*.log
            service: myapp
            source: myapp
        ```

        This keeps Datadog Agent as the forwarder (handling buffering, retries, metadata enrichment) while 10x optimizes events inline. See the [Datadog Agent module](https://doc.log10x.com/run/input/forwarder/datadogAgent/) for details.

    === ":material-test-tube: Test (no forwarder)"

        Test the optimizer without setting up a forwarder using the [Dev CLI](https://doc.log10x.com/apps/dev/).

        The dev app uses the [file input module](https://doc.log10x.com/run/input/file/) to read sample log files and writes optimized (compact) output to a file, allowing you to verify optimization behavior before integrating with your forwarder.

        **No forwarder configuration required** - provide sample log files to the file input module and skip to [Step 7](#__tabbed_6_5) to run the test.

??? tenx-symbols "Step 4: Symbol Library (optional)"

    Load custom [Symbol library](https://doc.log10x.com/apps/compiler/) files to transform events into typed TenXObjects.

    Place symbol files in the `symbolPaths` folders specified in the [symbol config](#symbols).

??? tenx-initializers "Step 5: Enrichments (optional)"

    Enrichments add context (severity, HTTP codes) for richer aggregation and optimization.

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

        ```console
        $ fluentd -c my-fluentd.conf
        ```

    === ":simple-fluentbit: Fluent-bit"

        ```console
        $ fluent-bit -c my-fluent-bit.conf
        ```

    === ":simple-beats: Filebeat"

        ```console title="Nix/OSX"
        $ filebeat -c my-filebeat.yml -e 2>&1 | /opt/tenx-edge/bin/tenx run @run/input/forwarder/filebeat/optimize/config.yaml @run/apps/edge/optimizer
        ```

        ```console title="Windows"
        $ filebeat -c my-filebeat.yml -e 2>&1 | "c:\program files\tenx-edge\tenx" run @run/input/forwarder/filebeat/optimize/config.yaml @run/apps/edge/optimizer
        ```

    === ":simple-logstash: Logstash"

        ```console
        $ logstash -f my-logstash.conf
        ```

    === ":simple-opentelemetry: OTel Collector"

        **Step 1**: Start Log10x Optimizer first:

        ```console
        $ tenx run @run/input/forwarder/otel-collector/optimize @apps/edge/optimizer
        ```

        **Step 2**: Start OTel Collector with the 10x configuration:

        ```console
        $ otelcol-contrib --config=/etc/otelcol-contrib/optimize/tenxNix.yaml
        ```

    === ":simple-splunk: Splunk UF"

        **Step 1**: Start Fluent Bit with the 10x optimizer:

        ```console
        $ fluent-bit -c fluent-bit-splunk.conf
        ```

        **Step 2**: Start (or restart) Splunk UF to pick up Folder B:

        ```console
        $ splunk restart
        ```

        Fluent Bit + 10x will read from Folder A, optimize events, and write to Folder B. Splunk UF monitors Folder B and forwards to indexers.

    === ":simple-datadog: Datadog Agent"

        **Step 1**: Start Fluent Bit with the 10x optimizer:

        ```console
        $ fluent-bit -c fluent-bit-datadog.conf
        ```

        **Step 2**: Start (or restart) the Datadog Agent to pick up Folder B:

        ```console
        $ sudo systemctl restart datadog-agent
        ```

        Fluent Bit + 10x will read from Folder A, optimize events, and write to Folder B. Datadog Agent monitors Folder B and forwards to Datadog.

    === ":material-test-tube: Test (no forwarder)"

        Use the [Dev CLI](https://doc.log10x.com/apps/dev/) to test event processing and lossless compact with sample log files.

        **Step 1**: Provide sample log files to the [file input module](https://doc.log10x.com/run/input/file/):

        ```console
        $ cp /path/to/sample.log $TENX_CONFIG/data/sample/input/
        ```

        **Step 2**: Run the dev app:

        ```console
        $ tenx run @apps/dev
        ```

        The dev app reads events from `data/sample/input/*.log` via the file input module, losslessly compacts events, and writes results to the configured [file output](https://doc.log10x.com/run/output/event/file/).

        **Verify output:**

        ```console
        $ ls -la $TENX_CONFIG/data/sample/output/
        ```

        Compare input vs output byte sizes to measure the reduction ratio achieved by optimization.

??? tenx-checklist "Step 8: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location). For debugging techniques including enabling verbose logging, see [Engine Logging](https://doc.log10x.com/manage/logging/).

    **View results in the dashboard:**

    Once running, view your cost analytics in the [Edge Optimizer Dashboard](https://doc.log10x.com/roi-analytics/#edge-optimizer).
