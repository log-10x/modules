// @loader: tenx

import {TenXInput, TenXEnv, TenXConsole} from '@tenx/tenx'

export class ForwardInput extends TenXInput {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return !TenXEnv.get("quiet");
    }

    constructor() {

        if (this.inputName == "forward") {
            var path = TenXEnv.get("forwardInputPath", "");
            if (path) {
                TenXConsole.log("📥 Reading events via Forward protocol on unix://" + path);
            } else {
                TenXConsole.log("📥 Reading events via Forward protocol on tcp://0.0.0.0:" + TenXEnv.get("forwardInputPort"));
            }
        }
    }
}
