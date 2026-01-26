// 🔟❎ OpenTelemetry Collector input initialization script

// This script runs when the OTel Collector input stream is initialized.
// It can be used to set up any necessary configurations or logging.

const logger = TenXLogger.getLogger("otelCollector.input");

if (logger.isInfoEnabled()) {
    logger.info("Initializing OpenTelemetry Collector TCP JSON input stream");
}

