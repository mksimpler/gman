import * as winston from "winston";

const logger: winston.Logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.timestamp(),
        winston.format.printf(info => {
            return `${info.timestamp}||${info.level}: ${info.message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            level: "verbose"
        })
    ]
});

export default logger;