---
icon: simple/prometheus
hidden: true
---

Generate [filter tables](https://doc.log10x.com/run/regulate/policy/) for Edge Regulator instances by analyzing aggregated event statistics from Prometheus.

Data comes from [Edge Reporter](https://doc.log10x.com/apps/edge/reporter/) instances that publish event frequency metrics, enabling centralized rate-based filtering across your infrastructure.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

??? tenx-bootstrap "Step 1: Install"

    Install the `Edge` binary flavor:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash -s -- --flavor edge"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install log-10x/tap/log10x"){data-copy="brew install log-10x/tap/log10x"}
    - :material-microsoft-windows: [PowerShell script](https://doc.log10x.com/install/win/)
    - :simple-docker: [Docker image](https://doc.log10x.com/install/docker/)

??? tenx-config "Step 2: Set Environment Variables"

    Set these environment variables before running. See [path configuration](https://doc.log10x.com/install/paths/) for details.

    | Variable | Description |
    |----------|-------------|
    | `TENX_CONFIG` | Path to your [configuration directory](https://doc.log10x.com/install/paths/#config) |
    | `TENX_API_KEY` | Your Log10x API key ([get one](https://doc.log10x.com/run/bootstrap/#apikey)) |
    | `GH_TOKEN` | GitHub personal access token ([create one](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens){target="\_blank"}) (if using GitHub output) |

    ```bash
    export TENX_CONFIG=/path/to/your/config
    export TENX_API_KEY=your-api-key
    export GH_TOKEN=your-github-token
    ```

    See [best practices](https://doc.log10x.com/engine/gitops/#best-practices) for managing secrets in production.

??? tenx-policyinput "Step 3: Enable Prometheus Input"

    1. In the [app config](#mainConfig), uncomment the Prometheus `include` entry
    2. In the [policy input](#policyinput) section below, configure connection details and query parameters

??? tenx-eventforwardoutput "Step 4: Choose Filter Table Output"

    === ":simple-github: GitHub Output"

        Push filter tables to a GitHub repository for centralized distribution. Edge Regulators pull these tables automatically.

        **Benefits**: Version control, automatic updates, easy rollback.

    === ":material-file-outline: File Output"

        Write filter tables to local files for manual distribution.

        **Benefits**: No external dependencies, works in air-gapped environments.

        **Distribution**: Shared storage (NFS, S3), config management (Ansible, Puppet), or manual copying.

    1. In the [app config](#mainConfig), uncomment your chosen output `include` entry
    2. In the [event outputs](#eventOutputs) section below, configure your output settings

??? tenx-mainconfig "Step 5: Run"

    === ":material-laptop: Nix/Win/OSX"

        **Best for**: Quick local testing and development.

        ```bash
        tenx @apps/edge/policy
        ```

    === ":material-docker: Docker (+ :material-laptop: local config)"

        **Best for**: Isolated testing with local configuration.

        ```bash
        docker run --rm \
          -v $TENX_CONFIG:/etc/tenx/config/ \
          -e TENX_CONFIG=/etc/tenx/config/ \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e GH_TOKEN=${GH_TOKEN} \
          ghcr.io/log-10x/pipeline-10x:latest \
          @apps/edge/policy
        ```

    === ":material-docker: Docker (+ :material-github: GitOps config)"

        **Best for**: CI/CD pipelines with version-controlled configuration.

        ```bash
        docker run --rm \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e GH_TOKEN=${GH_TOKEN} \
          ghcr.io/log-10x/pipeline-10x:latest \
          '@github={"token": "${GH_TOKEN}", "repo": "my-user/my-repo"}' \
          @apps/edge/policy
        ```

??? tenx-top10-events "Step 6: Output"

    With [File Output](#file-output) enabled, the app generates filter tables containing event patterns and frequency rates:

    ??? example "Sample Filter Table (first 25 lines)"

        ```csv
        symbolMessage,normalized_rate
        products_jpg_HTTP_frontend_proxy_Mozilla_X11,3381.58
        products_jpg_HTTP_frontend_proxy_cart_Mozilla,3356.73
        service_name_recommendation_trace_sampled,1774.70
        opentelemetry_demo_logo_png_HTTP_frontend,1056.09
        frontend_proxy_Mozilla_X11_Linux_x86_AppleWebKit,445.86
        time_level_msg_Reloading_Product_Catalog,1203.03
        time_level_msg_Loaded_products,1148.40
        Accounting_Consumer,983.08
        Sending_Quote,889.58
        orders_u003e_u003e_UTC_u003e_severity_timestamp,926.15
        sending_postProcessor_severity_timestamp,691.03
        Received_quote,1012.73
        POST_send_order_confirmation_HTTP,965.85
        message_offset_duration_severity_timestamp,730.05
        nanos_creditCard_msg_Charge_request_received,693.80
        through_transaction_id_severity_timestamp,692.13
        service_name_payment_transactionId_visa_amount,730.43
        Tracking_ID_Created,752.38
        user_id_user_currency_USD_severity_timestamp,544.75
        United_States_zipCode_items_item_productId,451.35
        migrator_t_level_msg_Migration_successfully,428.33
        cache_size_pod_cache_size_pod_cache_api_updates,273.85
        Order_confirmation_email_sent_example_com,293.38
        email_sent_example_com_severity_timestamp,113.58
        email_sent_reed_example_com_severity_timestamp,117.88
        ```

    **Use to**: Review discovered patterns, validate frequency calculations, and understand which events will be filtered by downstream Edge Regulator instances.

??? tenx-checklist "Step 7: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location).

    **Check output files:**

    Verify policy files were generated in your configured output paths.
