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

    static shouldLoad(config) {
        return (TenXEnv.get("k8sExtractorName") == "fluentK8s") || (TenXEnv.get("k8sExtractorName") == "filebeatK8s") || (TenXEnv.get("k8sExtractorName") == "otelK8s");
    }

    // Assigns namespace + container + user-service enrichments, and the team when
    // k8sTeamLabel names a label. Always runs when the fluentK8s, filebeatK8s or
    // otelK8s extractor is enabled. A value the Fluent Bit or Filebeat shape does
    // not carry comes from the otelK8s capture of its k8s.* attribute.
    constructor() {

        var namespace_name = this.namespace_name;
        if (namespace_name) {
            this.set(TenXEnv.get("k8sNamespaceNameField"), namespace_name);
        }
        if (!namespace_name && this.otel_namespace_name) {
            this.set(TenXEnv.get("k8sNamespaceNameField"), this.otel_namespace_name);
        }

        var container_name = this.container_name;
        if (container_name) {
            this.set(TenXEnv.get("k8sContainerNameField"), container_name);
            this.tenx_user_service = container_name;
        }
        if (!container_name && this.otel_container_name) {
            this.set(TenXEnv.get("k8sContainerNameField"), this.otel_container_name);
            this.tenx_user_service = this.otel_container_name;
        }

        // The team that owns the container, read from the k8sTeamLabel pod label.
        var team_label = this.team_label;
        if (team_label && TenXEnv.get("k8sTeamLabel")) {
            this.set(TenXEnv.get("k8sTeamField", "tenx_team"), team_label);
        }
        if (!team_label && this.otel_team_label && TenXEnv.get("k8sTeamLabel")) {
            this.set(TenXEnv.get("k8sTeamField", "tenx_team"), this.otel_team_label);
        }
    }
}
