// @loader: tenx

import {TenXOutput, TenXEnv, TenXConsole, TenXArray} from '@tenx/tenx'

export class OtlpOutput extends TenXOutput {

    static shouldLoad(config) {
       return !TenXEnv.get("quiet");
    }

    constructor() {

        var fieldStr = "";

        var fieldSize = TenXArray.length(this.outputOtlpFields);

        if (fieldSize > 1) {
            fieldStr = "TenXObject fields: '" + this.outputOtlpFields + "'";
        } else if (fieldSize == 1) {
            fieldStr = "TenXObject field: '" + this.outputOtlpFields + "'";
        } else if (this.outputOtlpWriteTemplates) {
            fieldStr = "TenXTemplates";
        }

        var host = this.outputOtlpHost || "127.0.0.1";
        var port = this.outputOtlpPort || 4317;

        TenXConsole.log("📝 Writing " + fieldStr + " → OTLP/gRPC: " + host + ":" + port);
    }
}
