// @loader: tenx

import {TenXInput, TenXObject, TenXString, TenXLog, TenXDate, TenXEnv} from '@tenx/tenx'

export class PolicyTopCostsInput extends TenXInput {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {

    	return TenXString.endsWith(config.inputName, "PolicyTopCostsInput");
	}

	constructor() {

		if (!TenXEnv.get("TENX_API_KEY")) {
			throw new Error("'TENX_API_KEY' not set");
		}

		var policyPrometheusRangeInterval = TenXEnv.get("policyPrometheusRangeInterval", "6h");

		if (TenXDate.parseDuration(policyPrometheusRangeInterval > TenXDate.parseDuration("48h"))) {
			throw new Error("'policyPrometheusRangeInterval' cannot exceed 48h: " + policyPrometheusRangeInterval);
		}

		var policyPrometheusStepDuration = TenXEnv.get("policyPrometheusStepDuration", "5min");

		if (TenXDate.parseDuration(policyPrometheusStepDuration < TenXDate.parseDuration("5min"))) {
			throw new Error("'policyPrometheusStepDuration' cannot fall below 5min: " + policyPrometheusStepDuration);
		}

		var topCostsQuery = TenXString.concat(
			TenXEnv.get("policyPrometheusEndpoint", "prometheus.log10x.com"),
			"/api/v1/",
			"query?query=topk(",
			TenXEnv.get("policyPrometheusTopEvents", 50),
			",round(avg_over_time((sum by (",
			TenXString.join(",", TenXEnv.get("policyPrometheusLabels", "symbolMessage")),
			") (rate(",
			TenXEnv.get("policyPrometheusSeries", "all_events_summaryBytes_total"),
			"{tenx_app=~\"",
			TenXEnv.get("policyPrometheusApps", "reporter|regulator|optimizer"),
			"\"}[",
			TenXEnv.get("policyPrometheusStepDuration", "5m"),
			"])) * 3600)[",	// Converting rate in seconds to rate in hours
			TenXEnv.get("policyPrometheusRangeInterval", "6h"),
			":",
			TenXEnv.get("policyPrometheusStepDuration", "5m"),
			"])))",
			"/ 1073741824 * ",
			TenXEnv.get("policyIngestionCostPerGB", 1),
			TenXEnv.get("policyPrometheusStart") ? ("&time=" + TenXEnv.get("policyPrometheusStart")) : ""
		);

		TenXLog.info("topCostsQuery: {}", topCostsQuery);

		TenXInput.set("ratePrometheusQuery", topCostsQuery);
	}
}

export class PolicyTopCostsObject extends TenXObject {

    // https://doc.log10x.com/api/js/#TenXEngine.shouldLoad
    static shouldLoad(config) {
        return TenXString.endsWith(config.inputName, "PolicyTopCostsInput");
    }

    constructor() {

        var labels = TenXString.jsonPath(this.text, "$.metric.*");

        var labelsNoBrackets = TenXString.substring(labels, 1, TenXString.length(labels) - 1);
        var labelsNoCommas = TenXString.replace(labelsNoBrackets, ",", "_");
        var labelsNoQuotes = TenXString.replace(labelsNoCommas, "\"", "");

        this.labelValue = labelsNoQuotes;
        this.varValue = TenXString.jsonPath(this.text, "$.value[-1]");
    }
}
