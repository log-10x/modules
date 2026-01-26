// @loader: tenx

import {TenXInput, TenXEnv, TenXConsole} from '@tenx/tenx'

export class LogstashInput extends TenXInput {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return !TenXEnv.get("quiet");
    }

    constructor() { 
        
        if (this.inputName == "logstash") {
            TenXConsole.log("📥 Reading events from Logstash via stdin");
        }
    }
}