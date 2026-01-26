// @loader: tenx

import {TenXTemplate, TenXEnv} from '@tenx/tenx'
import {GroupTemplate} from '../group/group-template'

export class OriginTemplate extends TenXTemplate {

    // @https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXEnv.get("symbolOriginField");
    }

    constructor() {

        if (GroupTemplate.isStandalone) {

            // use the setStatic reflection function as the target `symbolOriginField` is dynamic
            TenXTemplate.setStatic(
                TenXEnv.get("symbolOriginField"),
                this.symbolOrigin(
                    TenXEnv.get("symbolContexts", "log,exec"),
                    TenXEnv.get("inputField"),
                    TenXEnv.get("symbolMaxLen", 0)
                )
            );
        }
    }
}
