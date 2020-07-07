import minimist from "minimist";

import logger from "../logger";
import { promptAsk, driveEntryParser } from "../utils";
import { Drive } from "../gg/drive";
import { OAuth2, loadCredentials } from "../gg/auth";
import { config, readCleanSettings } from "../dataio";

export default async function execute (params: string[]) : Promise<void> {
    const credentials = loadCredentials(config.get("google:credentials"));
    const { client_id, client_secret, redirect_uris } = credentials.installed;

    const auth = new OAuth2(client_id, client_secret, redirect_uris[0]);
    await auth.authorize(config.get("google:scopes"), config.get("google:token"));

    const drive = new Drive(auth, {
        searchPageSize: config.get("drive:searchPageSize")
    });

    const argv = minimist(params, {
        "string": ["profile", "p", "threshold", "t"],
        "alias": {
            "profile": "p",
            "threshold": "t"
        }
    });

    const profile = argv["profile"] || "default";
    const cleanSettings = readCleanSettings();

    const task = getTask(profile, cleanSettings);
    const threshold = argv["threshold"] || (task["threshold"] || 5);

    await process(drive, task, threshold);
}

interface Group {
    id?: string,
    name: string,
    entries: DriveEntry[]
}

async function process (drive: Drive, task: AppSettings$CleanProfile, threshold: number) : Promise<void> {

    type GroupDict = { [id: string]: Group };

    const oldGroupsDict: GroupDict = (
        await drive.list({
            parentId: task.stash.id,
            onlyFolder: true
        }))
    .reduce((dict, entry) => (dict[entry.name] = { id: entry.id, name: entry.name, entries: [] } as Group, dict), {} as GroupDict);

    logger.info(`Found ${Object.keys(oldGroupsDict).length} group(s).`);

    const targets = task.targets;
    let entries: DriveEntry[] = [];

    for (let i = targets.length; i--; ) {
        logger.verbose(`Getting files from target (${targets.length - i}/${targets.length}).`);

        const newEntries = (await drive.list({
            parentId: targets[i].id,
            onlyFolder: true
        })).map(entry => driveEntryParser(
            entry.id || "",
            entry.name || "",
            (entry.parents || [undefined])[0])
        );

        entries = [...entries, ...newEntries];
    }

    logger.info(`Found ${entries.length} file(s).`);

    const newGroupsDict: GroupDict = {};

    for (const entry of entries) {
        if (entry.groups.length == 1) {
            const group = entry.groups[0];

            if (!group) continue;

            if (Object.prototype.hasOwnProperty.call(oldGroupsDict, group)) {
                // old group
                oldGroupsDict[group].entries.push(entry);

            } else {
                // new group
                if (Object.prototype.hasOwnProperty.call(newGroupsDict, group)) {
                    newGroupsDict[group].entries.push(entry);
                } else {
                    newGroupsDict[group] = {
                        name: group,
                        entries: [entry]
                    };
                }
            }
        }
    }

    const oldGroups = Object.keys(oldGroupsDict).map(g => oldGroupsDict[g])
                        .filter(g => g.entries.length > 0).sort((a, b) => b.entries.length - a.entries.length);
    const nOldGroupFiles = oldGroups.map(g => g.entries.length).reduce((len, total) => len + total, 0);

    const newGroups = Object.keys(newGroupsDict).map(k => newGroupsDict[k])
                        .filter(g => g.entries.length >= threshold).sort((a, b) => b.entries.length - a.entries.length);
    const nNewGroupFiles = newGroups.map(g => g.entries.length).reduce((len, total) => len + total, 0);

    if (nOldGroupFiles > 0) {
        console.log(`\nWe found ${nOldGroupFiles} files for ${oldGroups.length} old groups.`);
        printCleanInfo(oldGroups);
    }

    if (nNewGroupFiles > 0) {
        console.log(`\nWe found ${nNewGroupFiles} files for ${newGroups.length} new groups.`);
        printCleanInfo(newGroups);
    }

    console.log("\nWhatcha you want to do?");
    console.log("1. Process old groups only");
    console.log("2. Process new groups only");
    console.log("3. Process all");

    async function processOldGroups () : Promise<void> {
        logger.info("Working on old groups");

        for (const group of oldGroups) {
            for (const entry of group.entries) {
                logger.verbose(`Moving "${entry.fullname}" to "${group.name}"`);
                try {
                    await drive.move({
                        fileId: entry.id,
                        addParents: group.id,
                        removeParents: entry.parent,
                    });
                } catch (err) {
                    logger.error(`Error occurs when moving "${entry.fullname}": ${JSON.stringify(err)}`);
                }
            }
        }
    }

    async function processNewGroups () : Promise<void> {
        logger.info("Working on new groups");

        for (const group of newGroups) {
            logger.info(`Group: "${group.name}"`);
            try {
                logger.verbose(`Creating folder "${group.name}"`);

                const folder = await drive.createFolder({
                    name: group.name,
                    parentId: task.stash.id,
                    color: "#9fe1e7"
                });

                for (const entry of group.entries) {
                    logger.verbose(`Moving "${entry.fullname}" to "${folder.name}"`);

                    try {
                        await drive.move({
                            fileId: entry.id,
                            addParents: folder.id,
                            removeParents: entry.parent,
                        });
                    } catch (err) {
                        logger.error(`Error occurs when moving "${entry.fullname}": ${JSON.stringify(err)}`);
                    }
                }
            } catch (err) {
                logger.error(`Error occurs when creating folder "${group.name}": ${JSON.stringify(err)}`);
            }
        }
    }

    const ans = ((await promptAsk("Choose 1 2 or [3]: ")) || "3").toLowerCase();
    switch (ans) {
        case "1":
            await processOldGroups();
            break;

        case "2":
            await processNewGroups();
            break;

        case "3":
            if (nOldGroupFiles > 0) await processOldGroups();
            if (nNewGroupFiles > 0) await processNewGroups();
            break;

        default:
            console.log("Wrong answer!");
            break;
    }
}

function getTask (profile: string, setting: AppSettings$CleanTasks) : AppSettings$CleanProfile {
    if (profile == "default") {
        for (const pid in setting) {
            const p = setting[pid];
            if (p["default"]) {
                return p;
            }
        }
    }

    for (const pid in setting) {
        if (pid === profile) {
            return setting[pid];
        }
    }

    throw new Error(`Cannot found profile: ${profile}`);
}

function printCleanInfo (groups: Group[]) {
    for (const group of groups) {
        console.log(`+ ${group.name} (${group.entries.length} entries).`);

        for (const entry of group.entries) {
            console.log(`    ${entry.fullname}`);
        }
    }
}