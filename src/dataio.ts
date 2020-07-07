import nconf from "nconf";

import fs from "fs";
import path from "path";
import logger from "./logger";

export { nconf as config };

const DFCFGLOC = "/etc/gman";

export async function initConfig () : Promise<void> {
    const CFGLOC = path.join(DFCFGLOC, "config.json");
    const defaults = {
        "dataDir": DFCFGLOC,

        "settings": "settings.json",

        "google": {
            "credentials": "credentials.json",
            "scopes": [
                "https://www.googleapis.com/auth/photoslibrary",
                "https://www.googleapis.com/auth/drive.metadata.readonly",
                "https://www.googleapis.com/auth/drive",
                "profile"
            ],
            "token": "token.json"
        },

        "drive": {
            "searchPageSize": 100
        }
    };

    nconf
        .file("config", {
            file: CFGLOC,
            type: "json"
        })
        .defaults(defaults);

    return new Promise(
        (resolve, reject) => {
            if (readFileIfExists(CFGLOC)) {
                nconf.load((error: Error) => {
                    if (error) {
                        logger.error(`${error}`);
                        return reject(error);
                    }

                    return resolve();
                });

            } else {
                fs.writeFile(CFGLOC, JSON.stringify(defaults, null, 4), error => {
                    if (error) {
                        logger.error(`${error}`);
                        return reject(error);
                    }

                    nconf.load((error: Error) => {
                        if (error) {
                            logger.error(`${error}`);
                            return reject(error);
                        }

                        return resolve();
                    });
                });
            }
        }
    );
}

export function readFileIfExists (filepath: string) : Buffer | undefined {
    try {
        return fs.readFileSync(filepath);
    } catch (error) {
        filepath = path.join(nconf.get("dataDir"), filepath);

        try {
            return fs.readFileSync(filepath);
        } catch (error) {
            return undefined;
        }
    }
}

export function readTextIfExists (filepath: string, encoding: BufferEncoding = "utf8") : string | undefined {
    try {
        return fs.readFileSync(filepath, { encoding: encoding });
    } catch (error) {
        filepath = path.join(nconf.get("dataDir"), filepath);

        try {
            return fs.readFileSync(filepath, { encoding: encoding });
        } catch (error) {
            return undefined;
        }
    }
}

export function writeFile (filepath: string, data: string | NodeJS.ArrayBufferView, outsideDataDir = false) : boolean {
    if (!outsideDataDir) {
        filepath = path.join(nconf.get("dataDir"), filepath);
    }

    try {
        fs.writeFileSync(filepath, data);
        return true;
    } catch (error) {
        logger.error(`${error}`);
        return false;
    }
}

let settings: JsonType | null = null;

function readSettings () : JsonType {
    try {
        if (settings == null) {
            settings = JSON.parse(
                readTextIfExists(nconf.get("settings")) || ""
            );
        }

        return settings as JsonType;

    } catch (error) {
        if (error instanceof SyntaxError) {
            logger.error(`Settings (${nconf.get("settings")}) not found or not valid`);

        } else {
            logger.error(`${error}`);
        }

        throw error;
    }
}

export function readImportSettings () : AppSettings$Basic {
    return readSettings()["import"] as AppSettings$Basic;
}

export function readAppendSettings () : AppSettings$Basic {
    return readSettings()["append"] as AppSettings$Basic;
}

export function readCleanSettings () : AppSettings$CleanTasks {
    return readSettings()["clean"] as AppSettings$CleanTasks;
}

export function readGroupsSettings () : AppSettings$Group[] {
    return readSettings()["groups"]as AppSettings$Group[];
}