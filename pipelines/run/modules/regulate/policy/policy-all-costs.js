// @loader: tenx

import {TenXInput, TenXObject, TenXString, TenXLog, TenXDate, TenXEnv} from '@tenx/tenx'

export class PolicyAllCostsInput extends TenXInput {

	// https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {

    	return TenXString.endsWith(config.inputName, "PolicyAllCostsInput");
	}

	constructor() {

		if (!TenXEnv.get("TENX_API_KEY")) {
			throw new Error("'TENX_API_KEY' not set");
		}

		var allCostsQuery = TenXString.concat(
			TenXEnv.get("policyPrometheusEndpoint", "prometheus.log10x.com"),
			"/api/v1/",
			"query?query=",
			"round(sum(increase(",
			TenXEnv.get("policyPrometheusSeries", "all_events_summaryBytes_total"),
			"{tenx_app=~\"",
			TenXEnv.get("policyPrometheusApps", "reporter|regulator|optimizer"),
			"\"}[",
			TenXEnv.get("policyPrometheusRangeInterval", "6h"),
			"])))",
			"/ 1073741824 * ",
			TenXEnv.get("policyIngestionCostPerGB", 1),
			"/ ",
			(TenXDate.parseDuration(TenXEnv.get("policyPrometheusRangeInterval", "6h")) / TenXDate.parseDuration("1h")), // Make sure we get an hourly rate
			" OR vector(0)",
			TenXEnv.get("policyPrometheusStart") ? ("&time=" + TenXEnv.get("policyPrometheusStart")) : ""
		);

		TenXLog.info("allCostsQuery: {}", allCostsQuery);

		TenXInput.set("ratePrometheusQuery", allCostsQuery);
	}
}

export class PolicyAllCostsObject extends TenXObject {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXString.endsWith(config.inputName, "PolicyAllCostsInput");
    }

    constructor() {
    	this.labelValue = "global_cost_total";
        this.varValue = TenXString.jsonPath(this.text, "$.value[-1]");
    }
}
