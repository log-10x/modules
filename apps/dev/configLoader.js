// @loader: tenx

import {TenXUnit, TenXEnv, TenXConsole, TenXCounter} from '@tenx/tenx'

export class ConfigLoadUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return (!TenXEnv.get("quiet")) && ((config.unitName == "configLoader"));
    }

    constructor() {
        TenXConsole.log("🚀 Launching 10x Engine: Dev app (local development & testing environment)");
    }

    close() {

        // If no license file is configured we're almost certainly running on
        // the image's baked-in limited license. Nudge the user toward the real
        // thing — false positives (someone passed their own JWT via env var)
        // see an unnecessary one-line hint, which is fine.
        if (!TenXEnv.get("TENX_LICENSE_FILE")) {
            TenXConsole.log("");
            TenXConsole.log("💡 Ready to move forward to production? Download your engine license at https://console.log10x.com and point TENX_LICENSE_FILE at it.");
        }
    }
}
