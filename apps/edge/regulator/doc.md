---
icon: material/play-circle-outline
---

Filter noisy telemetry from shipping to analytics platforms using [rate-based](https://doc.log10x.com/run/regulate/rate) filtering, preventing over-billing and reducing storage costs.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

???+ tenx-bootstrap "Step 1: Install"

    Install the `Edge` or `JIT-Edge` binary flavor on the same machine as your log forwarder:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install log-10x/tap/log10x"){data-copy="brew install log-10x/tap/log10x"}
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

        **Step 1**: Include the 10x regulator configuration:

        ```toml title="my-fluentd.conf"
        # Nix/OSX
        @include "#{ENV['TENX_MODULES']}/pipelines/run/modules/input/forwarder/fluentd/conf/tenx-regulate-unix.conf"

        # Windows
        # @include "#{ENV['TENX_MODULES']}/pipelines/run/modules/input/forwarder/fluentd/conf/tenx-regulate-stdio.conf"
        ```

        **Step 2**: Apply the `@TENX` label to route events through the regulator:

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

            Regulated events are marked with `@TENX-PROCESSED`. To re-apply `@ROOT`:

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

            Insert the regulator between specific plugins:

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

        !!! note
            For large files or volume surges, set [XMX](https://www.baeldung.com/jvm-parameters#explicit-heap-memory---xms-and-xmx-options) or use [read_bytes_limit_per_second](https://docs.fluentd.org/input/tail#read_bytes_limit_per_second).

    === ":simple-fluentbit: Fluent-bit"

        **Step 1**: Include the 10x regulator configuration:

        ```toml title="my-fluent-bit.conf"
        # Nix/OSX
        @INCLUDE /etc/tenx/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-regulate.conf
        @INCLUDE /etc/tenx/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-unix.conf

        # Windows
        # @INCLUDE c:/program files/tenx-edge/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-regulate.conf
        # @INCLUDE c:/program files/tenx-edge/config/pipelines/run/modules/forwarder/fluentbit/conf/tenx-tcp.conf
        ```

        **Step 2**: The Lua filter catches all events by default. To regulate a subset, update the `Match` field:

        ```toml title="tenx-regulate.conf"
        [FILTER]
            Name Lua
            Match *
            script ${TENX_MODULES}/${tenx_lua}
            call tenx_process
        ```

    === ":simple-beats: Filebeat"

        **Step 1**: Add the 10x input for receiving regulated events:

        ```yaml title="my-filebeat.yml"
        filebeat.config.inputs:
          enabled: true
          # Nix/OSX
          path: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/regulate/tenxNix.yml
          # Windows
          # path: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/regulate/tenxWin.yml
        ```

        **Step 2**: Add the regulator processor:

        ```yaml title="my-filebeat.yml"
        filebeat.inputs:
          - type: filestream
            id: my-filestream-id
            paths:
              - /path/to/log

            processors:
              - script:
                  lang: javascript
                  file: ${TENX_MODULES}/pipelines/run/modules/input/forwarder/filebeat/script/tenx-regulate.js
        ```

    === ":simple-logstash: Logstash"

        Set up [multiple pipelines](https://www.elastic.co/guide/en/logstash/current/multiple-pipelines.html) in `pipelines.yml`:

        ```yaml title="pipelines.yml"
        - pipeline.id: raw_input
          path.config: "/path/to/conf/upstream.conf"
        - pipeline.id: tenx_pipeline
          path.config: "${TENX_CONFIG}/pipelines/run/input/forwarder/logstash/regulate/tenx-pipe-out.conf"
        - pipeline.id: tenx_unix_pipeline
          path.config: "${TENX_CONFIG}/pipelines/run/input/forwarder/logstash/regulate/tenx-pipe-in-unix.conf"
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
        cp $TENX_MODULES/pipelines/run/modules/input/forwarder/otel-collector/regulate/tenxNix.yaml /etc/otelcol-contrib/
        ```

        **Step 2**: Update the configuration to match your log sources:

        ```yaml title="regulate/tenxNix.yaml"
        receivers:
          filelog:
            include:
              - /var/log/**/*.log  # Customize paths
            start_at: end
        ```

        **Step 3**: Configure your final exporters in the `logs/from-tenx` pipeline:

        ```yaml title="regulate/tenxNix.yaml"
        service:
          pipelines:
            # Logs go TO Log10x for regulation
            logs/to-tenx:
              receivers: [filelog, otlp]
              processors: [memory_limiter, batch]
              exporters: [syslog/tenx]

            # Regulated logs come FROM Log10x to final destinations
            logs/from-tenx:
              receivers: [fluentforward/tenx]
              processors: [batch]
              exporters: [elasticsearch]  # Add your exporters
        ```

        Two separate pipelines prevent infinite loops - events in `logs/from-tenx` never feed back to `logs/to-tenx`.

    === ":simple-splunk: Splunk UF"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, regulates events, and writes to Folder B. Splunk UF monitors Folder B and handles forwarding to Splunk indexers.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # UF reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, regulate, and write to Folder B:

        ```toml title="fluent-bit-splunk.conf"
        [SERVICE]
            Flush        1
            Log_Level    info

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs

        # Include 10x regulator - sends events to 10x subprocess
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-regulate.conf

        # Include Unix socket - receives processed events back from 10x
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-unix.conf

        # Write filtered events to Folder B
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
        sourcetype = app_logs
        ```

        This keeps Splunk UF as the forwarder (handling buffering, retries, timeouts) while 10x regulates events inline. See the [Splunk UF module](https://doc.log10x.com/run/input/forwarder/splunkUF/) for details.

    === ":simple-datadog: Datadog Agent"

        !!! note "File Relay Pattern"
            This integration uses a **file relay pattern**: Fluent Bit + 10x reads from Folder A, regulates events, and writes to Folder B. Datadog Agent monitors Folder B and handles forwarding to Datadog.

        **Step 1**: Set up folder paths:

        ```bash
        export FOLDER_A=/var/log/app        # App writes here
        export FOLDER_B=/var/log/processed  # DD Agent reads from here
        mkdir -p ${FOLDER_B}
        ```

        **Step 2**: Configure Fluent Bit to read from Folder A, regulate, and write to Folder B:

        ```toml title="fluent-bit-datadog.conf"
        [SERVICE]
            Flush        1
            Log_Level    info

        [INPUT]
            Name         tail
            Path         ${FOLDER_A}/*.log
            Tag          app.logs

        # Include 10x regulator - sends events to 10x subprocess
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-regulate.conf

        # Include Unix socket - receives processed events back from 10x
        @INCLUDE ${TENX_MODULES}/pipelines/run/modules/input/forwarder/fluentbit/conf/tenx-unix.conf

        # Write filtered events to Folder B
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

        This keeps Datadog Agent as the forwarder (handling buffering, retries, metadata enrichment) while 10x regulates events inline. See the [Datadog Agent module](https://doc.log10x.com/run/input/forwarder/datadogAgent/) for details.

    === ":material-test-tube: Test (no forwarder)"

        Test the regulator without setting up a forwarder using the [Dev CLI](https://doc.log10x.com/apps/dev/).

        The dev app uses the [file input module](https://doc.log10x.com/run/input/file/) to read sample log files and writes output to a file, allowing you to verify regulation behavior before integrating with your forwarder.

        **No forwarder configuration required** - provide sample log files to the file input module and skip to [Step 9](#__tabbed_6_5) to run the test.

??? tenx-symbols "Step 4: Symbol Library (optional)"

    Load custom [Symbol library](https://doc.log10x.com/apps/compiler/) files to transform events into typed TenXObjects.

    Place symbol files in the `symbolPaths` folders specified in the [symbol config](#symbols).

<span id="pair-with-streamer"></span>
??? tenx-integration "Step 5: Pair with Storage Streamer (optional)"

    Archive all events to S3 before regulation for full retention alongside cost control. The regulator filters what reaches your SIEM; filtered events remain in S3, queryable via [Storage Streamer](https://doc.log10x.com/apps/cloud/streamer/) for incident investigation, compliance, and auditing.

    Configure your forwarder to duplicate the event stream — one copy to S3 (all events), one through the regulator (filtered events to SIEM):

    === ":simple-fluentbit: Fluent-bit"

        Use the `rewrite_tag` filter to copy events before the 10x Lua filter:

        ```ini
        [FILTER]
            Name         rewrite_tag
            Match        app.*
            Rule         $log .+ s3.$TAG true

        [OUTPUT]
            Name         s3
            Match        s3.*
            bucket       your-archive-bucket
            region       us-east-1
            total_file_size 50M
            upload_timeout 60s

        [OUTPUT]
            Name         forward
            Match        app.*
            # → 10x sidecar processes and regulates these events
        ```

        Events tagged `s3.*` go to S3; events tagged `app.*` continue through regulation.

    === ":simple-fluentd: Fluentd"

        Use the `copy` output plugin to send events to both S3 and the 10x sidecar:

        ```xml
        <match app.**>
          @type copy
          <store>
            @type s3
            s3_bucket your-archive-bucket
            s3_region us-east-1
            path logs/
            <buffer time>
              timekey 3600
              timekey_wait 10m
            </buffer>
          </store>
          <store>
            @type forward
            # → 10x sidecar
          </store>
        </match>
        ```

    === ":simple-opentelemetry: OTel Collector"

        Add multiple exporters to the same pipeline — OTel natively fans out to all exporters:

        ```yaml
        exporters:
          awss3:
            s3uploader:
              region: us-east-1
              s3_bucket: your-archive-bucket
          otlp/siem:
            endpoint: siem-endpoint:4317
            # → 10x sidecar processes and regulates these events

        service:
          pipelines:
            logs:
              receivers: [filelog]
              exporters: [awss3, otlp/siem]
        ```

    === ":simple-logstash: Logstash"

        Use multiple outputs — Logstash natively sends to all configured outputs:

        ```ruby
        output {
          s3 {
            bucket => "your-archive-bucket"
            region => "us-east-1"
            size_file => 52428800
            time_file => 60
          }
          pipe {
            command => "/opt/tenx-edge/bin/tenx run ..."
            # → 10x sidecar processes and regulates these events
          }
        }
        ```

    === ":simple-splunk: Splunk UF"

        Splunk UF uses a [file relay pattern](https://doc.log10x.com/run/input/forwarder/splunkUF/) — Fluent Bit + 10x reads from Folder A, processes events, and writes to Folder B. Splunk UF monitors Folder B and forwards to indexers.

        Add the S3 output to the Fluent Bit configuration alongside the file output:

        ```ini
        [FILTER]
            Name         rewrite_tag
            Match        app.*
            Rule         $log .+ s3.$TAG true

        [OUTPUT]
            Name         s3
            Match        s3.*
            bucket       your-archive-bucket
            region       us-east-1
            total_file_size 50M
            upload_timeout 60s

        # Regulated events written to Folder B for Splunk UF
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       plain
        ```

        Splunk UF continues to monitor Folder B via `inputs.conf` — no changes to the UF configuration.

    === ":simple-datadog: Datadog Agent"

        Datadog Agent uses a [file relay pattern](https://doc.log10x.com/run/input/forwarder/datadogAgent/) — Fluent Bit + 10x reads from Folder A, processes events, and writes to Folder B. The Datadog Agent monitors Folder B and forwards to Datadog.

        Add the S3 output to the Fluent Bit configuration alongside the file output:

        ```ini
        [FILTER]
            Name         rewrite_tag
            Match        app.*
            Rule         $log .+ s3.$TAG true

        [OUTPUT]
            Name         s3
            Match        s3.*
            bucket       your-archive-bucket
            region       us-east-1
            total_file_size 50M
            upload_timeout 60s

        # Regulated events written to Folder B for Datadog Agent
        [OUTPUT]
            Name         file
            Match        *
            Path         ${FOLDER_B}
            Format       plain
        ```

        The Datadog Agent continues to monitor Folder B via `conf.d` — no changes to the Agent configuration.

<span id="regulators2"></span>
??? tenx-regulators "Step 6: Configure Regulators (optional)"

    Configure [rate regulators](https://doc.log10x.com/run/regulate/rate/) for common scenarios. Edit these settings in your regulator [config.yaml](#regulators).

    === ":material-percent: Per-Event-Type Budget"

        Cap any single event type at 20% of total spend. Use the [Level Classifier](https://doc.log10x.com/run/initialize/level/) to enrich events with severity levels, so ERROR events have a higher minimum retention floor than DEBUG and critical events survive throttling.

        ```yaml
        rateRegulator:
          budgetPerHour: 1.50
          ingestionCostPerGB: 1.5          # Splunk Cloud
          maxSharePerFieldSet: 0.2         # No event type exceeds 20%
          minRetentionThreshold: 0.1       # At least 10% retained when over budget
          levelBoost:
            - TRACE=0.25
            - DEBUG=0.5
            - INFO=1
            - WARN=1.5
            - ERROR=2
            - FATAL=3
        ```

        With `minRetentionThreshold: 0.1` and `levelBoost`, the minimum retention floor when over budget is: DEBUG = 5% (0.1 &times; 0.5), INFO = 10% (0.1 &times; 1), ERROR = 20% (0.1 &times; 2). Under budget, all events pass through — boost only affects the floor.

    === ":material-kubernetes: Multi-App Kubernetes"

        Prevent any single app from exceeding 20% of the budget across all its pods. Uses [k8s container name](https://doc.log10x.com/run/initialize/k8s/) for stable aggregation across replicas.

        ```yaml
        rateRegulator:
          fieldNames:
            - symbolMessage
            - container                    # Same name across all pod replicas
          ingestionCostPerGB: 2.50         # Datadog
        ```

        Each (event type &times; app) combination gets its own 20% cap. Scaling from 1 to 10 pods doesn't bypass limits because `container` name is stable across replicas.

    === ":material-file-document-edit-outline: Mute File (GitOps)"

        Apply a declarative, field-set keyed mute file pulled from a git repo. Entries are keyed by the same `rateRegulatorFieldNames` values the local regulator uses (e.g. `symbolMessage`), so mutes target the same patterns the Reporter attributes cost to. Each entry caps a specific pattern with an explicit sample rate and epoch expiry, so mutes are diff-reviewed, audited, and self-healing.

        ```yaml
        rateRegulator:
          fieldNames:
            - symbolMessage
          lookup:
            file: /etc/log10x/config/data/sample/mutes/mutes.csv
            retain: 300000                 # 5 minutes — log a drift warning if stale
        ```

        Entries in `mutes.csv` look like `Error_syncing_pod=0.10:1744848000:pod error spam OPS-4821`. See [mute file mode](https://doc.log10x.com/run/regulate/rate/#mute-file-mode-declarative-field-set-caps) for the full format and workflow.

??? tenx-initializers "Step 7: Enrichments (optional)"

    Enrichments add context (severity, HTTP codes) for richer aggregation and filtering.

    **To enable:**

    1. In the [app config](#mainConfig), uncomment the desired enrichment `include` entries
    2. In the [initializers](#initializers) section below, configure each enrichment's settings

??? tenx-metricoutputs "Step 8: Metrics Output (optional)"

    Publish [aggregated](https://doc.log10x.com/run/aggregate/) metrics to time-series databases (Prometheus, Datadog).

    **To enable:**

    1. In the [app config](#mainConfig), uncomment the desired metric output `include` entry
    2. In the [metric outputs](#metricOutputs) section below, configure connection details

??? tenx-mainconfig "Step 9: Run"

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
        $ filebeat -c my-filebeat.yml -e 2>&1 | /opt/tenx-edge/bin/tenx run @run/input/forwarder/filebeat/regulate/config.yaml @run/apps/edge/regulator
        ```

        ```console title="Windows"
        $ filebeat -c my-filebeat.yml -e 2>&1 | "c:\program files\tenx-edge\tenx" run @run/input/forwarder/filebeat/regulate/config.yaml @run/apps/edge/regulator
        ```

    === ":simple-logstash: Logstash"

        ```console
        $ logstash -f my-logstash.conf
        ```

    === ":simple-opentelemetry: OTel Collector"

        **Step 1**: Start Log10x Regulator first:

        ```console
        $ tenx run @run/input/forwarder/otel-collector/regulate @apps/edge/regulator
        ```

        **Step 2**: Start OTel Collector with the 10x configuration:

        ```console
        $ otelcol-contrib --config=/etc/otelcol-contrib/regulate/tenxNix.yaml
        ```

    === ":simple-splunk: Splunk UF"

        **Step 1**: Start Fluent Bit with the 10x regulator:

        ```console
        $ fluent-bit -c fluent-bit-splunk.conf
        ```

        **Step 2**: Start (or restart) Splunk UF to pick up Folder B:

        ```console
        $ splunk restart
        ```

        Fluent Bit + 10x will read from Folder A, regulate events, and write filtered events to Folder B. Splunk UF monitors Folder B and forwards to indexers.

    === ":simple-datadog: Datadog Agent"

        **Step 1**: Start Fluent Bit with the 10x regulator:

        ```console
        $ fluent-bit -c fluent-bit-datadog.conf
        ```

        **Step 2**: Start (or restart) the Datadog Agent to pick up Folder B:

        ```console
        $ sudo systemctl restart datadog-agent
        ```

        Fluent Bit + 10x will read from Folder A, regulate events, and write filtered events to Folder B. Datadog Agent monitors Folder B and forwards to Datadog.

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

        The dev app reads events from `data/sample/input/*.log` via the file input module, processes them through the regulation pipeline, and writes results to the configured [file output](https://doc.log10x.com/run/output/event/file/).

        **Verify output:**

        ```console
        $ wc -l $TENX_CONFIG/data/sample/output/encoded.log
        ```

        Compare input vs output line counts to verify event processing.

??? tenx-checklist "Step 10: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location). For debugging techniques including enabling verbose logging, see [Engine Logging](https://doc.log10x.com/manage/logging/).

    **View results in the dashboard:**

    Once running, view your cost analytics in the [Edge Regulator Dashboard](https://doc.log10x.com/roi-analytics/#edge-regulator).

??? tenx-delete "Step 11: Teardown"

    Nothing runs in the background — uninstall removes only what was installed.

    === ":simple-macos: Homebrew"

        ```bash
        brew uninstall --cask log10x && rm -rf /etc/tenx
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
        docker rmi log10x/pipeline-10x:latest
        ```
