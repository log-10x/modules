// @loader: tenx

import {TenXInput, TenXEnv, TenXConsole} from '@tenx/tenx'

export class OtelCollectorSyslogInput extends TenXInput {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return !TenXEnv.get("quiet");
    }

    constructor() {

        if (this.inputName == "syslog") {
            if (TenXEnv.get("otelCollectorInputPath")) {
                TenXConsole.log("📥 Reading events from OpenTelemetry Collector via syslog exporter on unix://" + TenXEnv.get("otelCollectorInputPath"));
            } else {
                TenXConsole.log("📥 Reading events from OpenTelemetry Collector via syslog exporter on tcp://0.0.0.0:" + TenXEnv.get("otelCollectorInputPort"));
            }
        }
    }
}
