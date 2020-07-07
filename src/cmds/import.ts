import logger from "../logger";
import { inArray, driveEntryParser, promptAsk } from "../utils";
import { Drive } from "../gg/drive";
import { OAuth2, loadCredentials } from "../gg/auth";
import { config, readImportSettings, readGroupsSettings } from "../dataio";

export default async function execute () : Promise<void> {
    const credentials = loadCredentials(config.get("google:credentials"));
    const { client_id, client_secret, redirect_uris } = credentials.installed;

    const auth = new OAuth2(client_id, client_secret, redirect_uris[0]);
    await auth.authorize(config.get("google:scopes"), config.get("google:token"));

    const drive = new Drive(auth, {
        searchPageSize: config.get("drive:searchPageSize")
    });

    const imptSettings = readImportSettings();
    const groups = readGroupsSettings();

    await process(drive, imptSettings, groups);
}

async function process (drive: Drive, setting: AppSettings$Basic, groups: AppSettings$Group[]) : Promise<void> {
    const entries = (await drive.list({
        parentId: setting.id,
        onlyFolder: true
    })).map(entry =>
        driveEntryCategorySelector(driveEntryParser(
            entry.id || "",
            entry.name || "",
            (entry.parents || [undefined])[0]), groups)
    );

    if (entries.length == 0) {
        logger.info(`Found 0 entries in '${setting.name || "$noname"}'`);
        return;
    }

    const categories: { [cat: string]: DriveEntry[] } = {};
    const uncat: DriveEntry[] = [];

    for (const entry of entries) {
        const category = entry.category;
        if (entry.category) {
            if (Object.prototype.hasOwnProperty.call(categories, category)) {
                categories[category].push(entry);
            } else {
                categories[category] = [entry];
            }
        } else {
            uncat.push(entry);
        }
    }

    // print result to console
    for (const groupName in categories) {
        console.log(`Group ${groupName}:`);
        for (const entry of categories[groupName]) {
            console.log(`++ ${entry.fullname}`);
        }
        console.log();
    }

    if (uncat.length > 0) {
        console.log("No-group:");
        for (const entry of uncat) {
            console.log(`++ ${entry.fullname}`);
        }
        console.log();
    }

    const ans = ((await promptAsk("Process? (Y/n) ")) || "y").toLowerCase();
    if (ans !== "y" && ans !== "yes") return;

    for (const groupName in categories) {
        const foundGroups = groups.filter(g => g.name === groupName);
        if (foundGroups.length > 1) {
            logger.error(`Found 2 more group with name '${groupName}'`);
            continue;
        } else if (foundGroups.length == 0) {
            logger.error(`Found 0 group with name '${groupName}'. Something wrong!`);
            continue;
        }

        const group = foundGroups[0];

        for (const entry of categories[groupName]) {
            logger.verbose(`Moving '${entry.fullname}' to '${groupName}'`);
            try {
                await drive.move({
                    fileId: entry.id,
                    addParents: group.id,
                    removeParents: entry.parent
                });
            } catch (error) {
                logger.error(`Error occurs when moving "${entry.fullname}": ${JSON.stringify(error)}`);
            }
        }
    }
}

function driveEntryCategorySelector (entry: DriveEntry, groups: AppSettings$Group[]) : DriveEntry {
    let categories: string[] = [];
    let maxScore = 0;

    for (const group of groups) {

        let score = group.tags.length * -1;

        for (const tag of entry.tags) {

            if (inArray(group.tags, tag)) {
                score += 1;
            }

            if (inArray(group.noallow || [], tag)) {
                score -= 1;
            }
        }

        if (score > maxScore) {
            maxScore = score;
            categories = [group.name];

        } else if (score == maxScore) {
            categories.push(group.name);
        }
    }

    if (categories.length > 1) {
        logger.error(`Found multiple category for '${entry.fullname}' :: ${categories.join(", ")}`);
    }

    else if (categories.length == 1) {
        entry.category = categories[0];
    }

    else {
        logger.error(`Not found category for '${entry.fullname}'`);
    }

    return entry;
}