import logger from "../logger";
import { promptAsk } from "../utils";
import { Drive } from "../gg/drive";
import { OAuth2, loadCredentials } from "../gg/auth";
import { config, readAppendSettings } from "../dataio";

export default async function execute () : Promise<void> {
    const credentials = loadCredentials(config.get("google:credentials"));
    const { client_id, client_secret, redirect_uris } = credentials.installed;

    const auth = new OAuth2(client_id, client_secret, redirect_uris[0]);
    await auth.authorize(config.get("google:scopes"), config.get("google:token"));

    const drive = new Drive(auth, {
        searchPageSize: config.get("drive:searchPageSize")
    });

    const appendSettings = readAppendSettings();

    await process(drive, appendSettings);
}

async function process (drive: Drive, setting: AppSettings$Basic) : Promise<void> {
    const rootId = setting.id;

    const entries = (await drive.list({
        parentId: rootId,
        onlyFolder: true
    }));

    logger.info(`Found ${entries.length} entries.`);

    // Array of entries will be needed to move all items within it
    const movEntries: { "origin": Drive$File, "append": Drive$File }[] = [];

    for (const entry of entries) {
        const name = "" + entry.name;

        const origins = [];
        const matchedFiles = await drive.find({
            name: name,
            onlyFolder: true
        });

        for (const f of matchedFiles) {
            if (name === f.name && f.parents.indexOf(rootId) === -1) {
                origins.push(f);
            }
        }

        // check for duplicate
        if (origins.length > 1) {
            logger.error(`Found 2 or more entries for '${name}'. So ignore it.`);

        } else if (origins.length == 1) {
            movEntries.push({
                "origin": origins[0],
                "append": entry
            });

            logger.info(`Found origin of '${name}'`);

        } else {
            logger.error(`Can't process '${name}'`);
        }
    }

    if (entries.length == 0) return;

    const ans = ((await promptAsk("Process? (Y/n) ")) || "y").toLowerCase();
    if (ans !== "y" && ans !== "yes") return;

    logger.info("Moving items to origin folder");

    // Move entries
    for (const entry of movEntries) {
        const origin = entry["origin"];
        const append = entry["origin"];

        const items = await drive.list({
            parentId: append.id,
            onlyFolder: false
        });

        logger.info(`Found ${items.length} items in ${append.name}.`);

        for (const i in items) {
            const item = items[i];
            logger.verbose(`Moving items in '${origin.name}' (${parseInt(i)+1}/${items.length})`);

            await drive.move({
                fileId: item.id,
                addParents: origin.id,
                removeParents: append.id
            });
        }

        logger.verbose(`Removing ${append.name}`);

        await drive.remove({
            fileId: append.id
        });
    }
}