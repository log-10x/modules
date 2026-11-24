// @loader: tenx

import {TenXEnv} from '@tenx/tenx'

// The pod-name enrichment, gated on k8sPodNameField being truthy via `shouldLoad`.
// The class only loads when the operator has opted in, and the constructor (and its
// `set(TenXEnv.get("k8sPodNameField"), ...)` call) is only parsed when the field name
// is non-empty.
//
// Why a separate class: the engine parse-validates `set()` at init regardless of
// runtime guards. If we inline `if (TenXEnv.get("k8sPodNameField")) { set(..., ...) }`
// in K8sFluentObject's constructor, the engine still validates set()'s shape
// against an empty field name when k8sPodNameField="" and refuses to load.
// shouldLoad is plain JS, runs at class-load time before the constructor body
// gets transpiled to DSL, so gating there avoids the parse pass entirely.
//
// Why a separate file: the engine keeps one constructor per script file, so in
// k8s-object.js this one would replace K8sFluentObject's.
export class K8sFluentPodObject extends TenXObject {

    static shouldLoad(config) {
        return ((TenXEnv.get("k8sExtractorName") == "fluentK8s") || (TenXEnv.get("k8sExtractorName") == "filebeatK8s") || (TenXEnv.get("k8sExtractorName") == "otelK8s")) && TenXEnv.get("k8sPodNameField");
    }

    constructor() {

        if (this.pod_name) {
            this.set(TenXEnv.get("k8sPodNameField"), this.pod_name);
        }
        if (this.pod_name && this.container_name) {
            this.tenx_user_process = this.pod_name + "/" + this.container_name;
        }

        if (!this.pod_name && this.otel_pod_name) {
            this.set(TenXEnv.get("k8sPodNameField"), this.otel_pod_name);
        }
        if (!this.pod_name && this.otel_pod_name && this.otel_container_name) {
            this.tenx_user_process = this.otel_pod_name + "/" + this.otel_container_name;
        }
    }
}
