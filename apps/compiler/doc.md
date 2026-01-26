---
icon: material/play-circle-outline
hidden: true
---

Generate a [symbol library](https://doc.log10x.com/compile/link/#symbol-library) from source code and binary inputs to enable structured event processing at runtime.

## :material-clipboard-play-outline: Setup Guide

Follow the steps below. Steps that require customization link to the relevant [Config Files](#config-files) section where you can edit on github.dev or locally.

??? tenx-bootstrap "Step 1: Install"

    Install the `Cloud` binary flavor:

    - :simple-linux: [Single line script](https://doc.log10x.com/install/singleline/ "curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash"){data-copy="curl https://raw.githubusercontent.com/log-10x/pipeline-releases/main/install.sh | bash"} | [DEB](https://doc.log10x.com/install/linux/#ubuntu-debian) | [RPM](https://doc.log10x.com/install/linux/#red-hat-centos-7)
    - :simple-macos: [Homebrew](https://doc.log10x.com/install/macos/ "brew install --cask log-10x/tap/log10x"){data-copy="brew install --cask log-10x/tap/log10x"}
    - :material-microsoft-windows: [PowerShell script](https://doc.log10x.com/install/win/)
    - :simple-docker: [Docker image](https://doc.log10x.com/install/docker/)

??? tenx-config "Step 2: Set Environment Variables"

    Set these environment variables before running. See [path configuration](https://doc.log10x.com/install/paths/) for details.

    | Variable | Description |
    |----------|-------------|
    | `TENX_CONFIG` | Path to your [configuration directory](https://doc.log10x.com/install/paths/#config) |
    | `TENX_API_KEY` | Your Log10x API key ([get one](https://doc.log10x.com/run/bootstrap/#apikey)) |
    | `GH_TOKEN` | GitHub personal access token ([create one](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens){target="\_blank"}) (optional) |
    | `DOCKER_USERNAME` | Docker registry username ([Docker Hub](https://docs.docker.com/security/for-developers/access-tokens/){target="\_blank"}) (optional) |
    | `DOCKER_TOKEN` | Docker registry token ([Docker Hub](https://docs.docker.com/security/for-developers/access-tokens/){target="\_blank"}) (optional) |
    | `ARTIFACTORY_TOKEN` | JFrog Artifactory token ([create one](https://jfrog.com/help/r/jfrog-platform-administration-documentation/access-tokens){target="\_blank"}) (optional) |

    ```bash
    export TENX_CONFIG=/path/to/your/config
    export TENX_API_KEY=your-api-key
    export GH_TOKEN=your-github-token
    ```

    See [best practices](https://doc.log10x.com/engine/gitops/#best-practices) for managing secrets in production.

??? tenx-scan "Step 3: Set Up Input Sources"

    Specify source code or binary [inputPaths](#scan) to scan.

    === "Local Sources"

        Clone a repository to the default input path:

        ```bash
        git clone https://github.com/open-telemetry/opentelemetry-demo.git \
          $TENX_CONFIG/data/compile/sources
        ```

    === "GitHub Pull"

        Configure [githubPull](#github_2) to pull repos automatically:

        ```yaml
        githubPull:
          - token: $=TenXEnv.get("GH_TOKEN")
            repos:
              - open-telemetry/opentelemetry-demo
        ```

    === "Helm Charts"

        Configure [helmChartNames](#helm_2) to pull from Helm charts:

        ```yaml
        helm:
          chartNames:
            - open-telemetry/opentelemetry-demo
        ```

        The compiler uses [Docker CLI](https://docs.docker.com/get-started/get-docker/) and [Helm](https://helm.sh/docs/intro/install/). The Docker image includes these; otherwise ensure [helmCommand](https://doc.log10x.com/compile/pull/helm/#helmcommand) and [dockerCommand](https://doc.log10x.com/compile/pull/docker/#dockercommand) are valid.

??? tenx-transform "Step 4: Configure Output"

    1. Set [outputSymbolFolder](#scan) for symbol unit files
    2. Set [outputSymbolLibraryFile](#link) for the final library file

??? tenx-githubsync "Step 5: Push to GitHub (optional)"

    Push outputs to GitHub for [GitOps workflows](https://doc.log10x.com/engine/gitops/), enabling symbol reuse and delivery to edge/cloud apps:

    ```yaml
    githubPush:
      - token: $=TenXEnv.get("GH_TOKEN")
        repo: myUser/myRepo
        folder: symbols
    ```

??? tenx-mainconfig "Step 6: Run"

    === ":material-laptop: Nix/Win/OSX"

        **Best for**: Local development and testing.

        ```bash
        tenx @apps/compiler
        ```

    === ":material-docker: Docker (+ :material-laptop: local config)"

        **Best for**: Isolated environments with local configuration.

        ```bash
        docker run --rm \
          -v $TENX_CONFIG:/etc/tenx/config/ \
          -e TENX_CONFIG=/etc/tenx/config/ \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e GH_TOKEN=${GH_TOKEN} \
          -e DOCKER_USERNAME=${DOCKER_USERNAME} \
          -e DOCKER_TOKEN=${DOCKER_TOKEN} \
          ghcr.io/log-10x/pipeline-10x:latest \
          @apps/compiler
        ```

    === ":material-docker: Docker (+ :material-github: GitOps config)"

        **Best for**: CI/CD pipelines with version-controlled configuration.

        ```bash
        docker run --rm \
          -e TENX_API_KEY=${TENX_API_KEY} \
          -e GH_TOKEN=${GH_TOKEN} \
          -e DOCKER_USERNAME=${DOCKER_USERNAME} \
          -e DOCKER_TOKEN=${DOCKER_TOKEN} \
          ghcr.io/log-10x/pipeline-10x:latest \
          '@github={"token": "${GH_TOKEN}", "repo": "my-user/my-repo"}' \
          @apps/compiler
        ```

??? tenx-checklist "Step 7: Verify"

    Verify no errors appear in the [log file](https://doc.log10x.com/manage/logging/#log-file-location).

    **Check output files:**

    Verify symbol files were generated in your configured [outputSymbolFolder](https://doc.log10x.com/compile/scan/#outputsymbolfolder) and [outputSymbolLibraryFile](https://doc.log10x.com/compile/link/#outputsymbollibraryfile) paths.
