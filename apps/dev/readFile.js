// @loader: tenx

import {TenXUnit, TenXEnv, TenXConsole, TenXCounter} from '@tenx/tenx'

export class ReadFileUnit extends TenXUnit {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return (!TenXEnv.get("quiet")) && ((config.unitName == "readFile"));
    }

    constructor() {

    }

    close() {

        var modulesFolder = TenXEnv.get("TENX_HOME") ? 
            TenXEnv.get("TENX_HOME") + "/modules" : 
            TenXEnv.get("TENX_MODULES");
        
        var configFolder = TenXEnv.get("TENX_HOME") ? 
            TenXEnv.get("TENX_HOME") + "/config" : 
            TenXEnv.get("TENX_CONFIG");
        
        if (TenXCounter.get("fileObjects")) {

            TenXConsole.log("💰 Processing complete. Preview savings by running: python3 " + modulesFolder +
                "/apps/dev/extract_for_web.py " + configFolder + "/data/sample/output --local");
        } else {

            TenXConsole.log("⚠️ No events read from input. Place your log files in: " +
                 configFolder + "/data/sample/input or curl -o " +  
                 configFolder + "/data/sample/input/otel-sample.log https://log10x-public-assets.s3.amazonaws.com/samples/otel-k8s/medium/input/otel-sample.log");
        }
    }
}
