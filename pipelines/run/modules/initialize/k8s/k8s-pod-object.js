// @loader: tenx

import {TenXEnv, TenXString} from '@tenx/tenx'

// The pod-name enrichment. shouldLoad gates it on k8sPodNameField because the engine
// validates each set() when it loads a script and refuses an empty field name, even
// behind a runtime check. It has its own file because the engine keeps one constructor
// per script file. A field the record lacks counts as true in a condition, so presence
// is tested by length, and the Fluent Bit shaped values are set last so they win.
export class K8sFluentPodObject extends TenXObject {

    static shouldLoad(config) {
        return ((TenXEnv.get("k8sExtractorName") == "fluentK8s") || (TenXEnv.get("k8sExtractorName") == "filebeatK8s") || (TenXEnv.get("k8sExtractorName") == "otelK8s")) && TenXEnv.get("k8sPodNameField");
    }

    constructor() {

        if (TenXString.length(this.otel_pod_name) > 0) {
            this.set(TenXEnv.get("k8sPodNameField"), this.otel_pod_name);
        }
        if ((TenXString.length(this.otel_pod_name) > 0) && (TenXString.length(this.otel_container_name) > 0)) {
            this.tenx_user_process = this.otel_pod_name + "/" + this.otel_container_name;
        }

        if (TenXString.length(this.pod_name) > 0) {
            this.set(TenXEnv.get("k8sPodNameField"), this.pod_name);
        }
        if ((TenXString.length(this.pod_name) > 0) && (TenXString.length(this.container_name) > 0)) {
            this.tenx_user_process = this.pod_name + "/" + this.container_name;
        }
    }
}
