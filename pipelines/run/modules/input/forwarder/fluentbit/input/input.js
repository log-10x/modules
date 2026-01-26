// @loader: tenx

import {TenXInput, TenXEnv, TenXConsole} from '@tenx/tenx'

export class FluentBitInput extends TenXInput {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
       return !TenXEnv.get("quiet");
    }

    constructor() { 
        
        if (this.inputName == "lua") {
            TenXConsole.log("📥 Reading events from Fluent Bit via stdin");
        }
    }
}