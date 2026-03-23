---
icon: material/play-circle-outline
---

Identify high-cost log events in your analytics platforms (Splunk, Elasticsearch, Datadog, CloudWatch) to pinpoint optimization targets.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

??? tenx-bootstrap "Step 1: Install"

    Install the `Cloud` binary flavor:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install --cask log-10x/tap/log10x-cloud"){data-copy="brew install --cask log-10x/tap/log10x-cloud"}
    - :material-microsoft-windows: [PowerShell script](https://doc.log10x.com/install/win/)
    - :simple-docker: [Docker image](https://doc.log10x.com/install/docker/)

??? tenx-config "Step 2: Set Environment Variables (Required)"

    Set these environment variables before running. See [path configuration](https://doc.log10x.com/install/paths/) for details.

    | Variable | Description | Required |
    |----------|-------------|----------|
    | `TENX_CONFIG` | Path to your [configuration directory](https://doc.log10x.com/install/paths/#config) | Yes |
    | `TENX_API_KEY` | Your Log10x API key ([get one](https://doc.log10x.com/run/bootstrap/#apikey)) | **Yes** |

    !!! warning "API Key Required"
        Unlike local development apps, the Cloud Reporter **requires** a valid `TENX_API_KEY` to run. The app will fail immediately without it.

    **Analyzer credentials** (based on your platform):

    | Platform | Variables | Documentation |
    |----------|-----------|---------------|
    | Splunk | `SPLUNK_USERNAME`, `SPLUNK_PASSWORD` | [Splunk Authentication](https://docs.splunk.com/Documentation/Splunk/latest/Security/Aboutauthentication){target="\_blank"} |
    | Elasticsearch | `ELASTIC_USERNAME`, `ELASTIC_PASSWORD` | [Elastic Security](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-minimal-setup.html){target="\_blank"} |
    | Datadog | `DD_API_KEY`, `DD_APP_KEY` | [Datadog API Keys](https://docs.datadoghq.com/account_management/api-app-keys/){target="\_blank"} |
    | CloudWatch | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | [AWS Access Keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html){target="\_blank"} |

    ```bash
    export TENX_CONFIG=/path/to/your/config
    export TENX_API_KEY=your-api-key
    export SPLUNK_USERNAME=your-username
    export SPLUNK_PASSWORD=your-password
    ```

    See [best practices](https://doc.log10x.com/engine/gitops/#best-practices) for managing secrets in production.

??? tenx-analyzerinputs "Step 3: Enable Analyzer Input"

    1. In the [app config](#mainConfig), uncomment the input line for your analyzer (Splunk, Elasticsearch, Datadog, CloudWatch, Coralogix, or Logz.io)

    2. In the [analyzer inputs](#analyzerInputs) section below, find your analyzer's tab and set the host, credentials, index/log group, and time range

??? tenx-symbols "Step 4: Symbol Library (optional)"

    Load custom [Symbol library](https://doc.log10x.com/apps/compiler/) files to transform events into typed TenXObjects.

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

    === ":material-laptop: Nix/Win/OSX"

        **Best for**: Quick local testing and development.

        ```bash
        tenx @apps/cloud/reporter
        ```

        ??? tenx-schedule "Schedule periodically"

            ```bash
            crontab -e
            ```

            Add (runs every 15 minutes):

            ```bash
            */15 * * * * /usr/local/bin/tenx @apps/cloud/reporter
            ```

    === ":material-docker: Docker (+ :material-laptop: local config)"

        **Best for**: Isolated testing with local configuration.

        ```bash
        docker run --rm \
          -v $TENX_CONFIG:/etc/tenx/config/ \
          -e TENX_CONFIG=/etc/tenx/config/ \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e SPLUNK_USERNAME=${SPLUNK_USERNAME} \
          -e SPLUNK_PASSWORD=${SPLUNK_PASSWORD} \
          log10x/pipeline-10x:latest \
          @apps/cloud/reporter
        ```

        ??? tenx-schedule "Schedule periodically"

            Create `/opt/scripts/cloud-reporter.sh`:

            ```bash
            #!/bin/bash
            docker run --rm \
              -v $TENX_CONFIG:/etc/tenx/config/ \
              -e TENX_CONFIG=/etc/tenx/config/ \
              -e TENX_API_KEY=${TENX_API_KEY} \
              -e SPLUNK_USERNAME=${SPLUNK_USERNAME} \
              -e SPLUNK_PASSWORD=${SPLUNK_PASSWORD} \
              log10x/pipeline-10x:latest \
              @apps/cloud/reporter
            ```

            Schedule:

            ```bash
            chmod +x /opt/scripts/cloud-reporter.sh
            crontab -e
            ```

            Add (runs every 15 minutes):

            ```bash
            */15 * * * * /opt/scripts/cloud-reporter.sh
            ```

    === ":material-docker: Docker (+ :material-github: GitOps config)"

        **Best for**: CI/CD pipelines with version-controlled configuration.

        ```bash
        docker run --rm \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e SPLUNK_USERNAME=${SPLUNK_USERNAME} \
          -e SPLUNK_PASSWORD=${SPLUNK_PASSWORD} \
          log10x/pipeline-10x:latest \
          '@github={"token": "${GH_TOKEN}", "repo": "my-user/my-repo"}' \
          @apps/cloud/reporter
        ```

        ??? tenx-schedule "Schedule periodically"

            Create `/opt/scripts/cloud-reporter-gitops.sh`:

            ```bash
            #!/bin/bash
            docker run --rm \
              -e TENX_API_KEY=${TENX_API_KEY} \
              -e SPLUNK_USERNAME=${SPLUNK_USERNAME} \
              -e SPLUNK_PASSWORD=${SPLUNK_PASSWORD} \
              log10x/pipeline-10x:latest \
              '@github={"token": "${GH_TOKEN}", "repo": "my-user/my-repo"}' \
              @apps/cloud/reporter
            ```

            Schedule:

            ```bash
            chmod +x /opt/scripts/cloud-reporter-gitops.sh
            crontab -e
            ```

            Add (runs every 15 minutes):

            ```bash
            */15 * * * * /opt/scripts/cloud-reporter-gitops.sh
            ```

??? tenx-checklist "Step 8: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location).

    **Check for Camel route errors:**

    1. View the log file for errors:

        ```bash
        tail -f /var/log/tenx/tenx.log | grep -iE "(error|exception|failed)"
        ```

    2. If you see connection or authentication errors, enable debug logging for your analyzer's route. See [Debugging Camel Routes](https://doc.log10x.com/run/input/analyzer/#debugging-camel-routes) for detailed instructions.

    3. **Quick debug example** - add to `$TENX_CONFIG/log4j2.yaml`:

        === "Splunk"

            ```yaml
            loggers:
              logger:
                - name: splunkRoute
                  level: trace
            ```

        === "Elasticsearch"

            ```yaml
            loggers:
              logger:
                - name: elasticsearchRoute
                  level: trace
            ```

        === "CloudWatch"

            ```yaml
            loggers:
              logger:
                - name: cloudwatchLogsRoute
                  level: trace
            ```

        === "Datadog"

            ```yaml
            loggers:
              logger:
                - name: datadogLogsRoute
                  level: trace
            ```

    **View results in the dashboard:**

    Once running, view your cost analytics in the [Cloud Reporter Dashboard](https://doc.log10x.com/roi-analytics/#cloud-reporter).
