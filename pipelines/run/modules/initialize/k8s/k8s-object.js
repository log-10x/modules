// @loader: tenx

import {TenXEnv, TenXUnit, TenXConsole} from '@tenx/tenx'

export class K8sUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return (config.unitName == "transform") && (TenXEnv.get("k8sExtractorName")) && (!TenXEnv.get("quiet"));
    }
    
     constructor() { 
        TenXConsole.log("☸️ Enriching TenXObjects with k8s container context using " + TenXEnv.get("k8sExtractorName"));
     }
}

export class K8sFluentObject extends TenXObject {

    // only load this class if the 'k8sPodNameField' env var is set
    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("k8sExtractorName") == "fluentK8s";
    }

    // This constructor assigns a user service and process names based on the k8s metadata.
    constructor() {

        var namespace_name = this.namespace_name;

        if (namespace_name) {
            this.set(TenXEnv.get("k8sNamespaceNameField"), namespace_name);
        }

        var container_name = this.container_name;
        var pod_name = this.pod_name;

        if (container_name) {
            this.set(TenXEnv.get("k8sContainerNameField"), container_name);
            this.tenx_user_service = container_name;
        }

        if (pod_name) {
            this.set(TenXEnv.get("k8sPodNameField"), pod_name);

            if (container_name) {
                this.tenx_user_process = pod_name + "/" + container_name;
            }
        }
    }
}
