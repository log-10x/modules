// @loader: tenx

import {TenXUnit, TenXEnv, TenXConsole} from '@tenx/tenx'

export class ConfigLoadUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return (!TenXEnv.get("quiet")) && ((config.unitName == "configLoader"));
    }

    constructor() {
        TenXConsole.log("🚀 Launching 10x Engine: Dev app (local development & testing environment)");

        TenXConsole.log("💰 Preview savings after processing: python3 " + TenXEnv.get("TENX_MODULES") +
            "/apps/dev/extract_for_web.py " + TenXEnv.get("TENX_CONFIG") + "/data/sample/output --local");
    }

    close() {
        TenXConsole.log("💰 Savings processing complete. View by running: python3 " + TenXEnv.get("TENX_MODULES") +
            "/apps/dev/extract_for_web.py " + TenXEnv.get("TENX_CONFIG") + "/data/sample/output --local");

        if (!TenXEnv.get("TENX_API_KEY")) {
            TenXConsole.log("");
            TenXConsole.log("🔑 Ready to connect to your infrastructure? Get your free API key at https://console.log10x.com");
        }
    }
}
