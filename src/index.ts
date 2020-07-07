import { initConfig } from "./dataio";

import { default as impt } from "./cmds/import";
import { default as append } from "./cmds/append";
import { default as clean } from "./cmds/clean";

const COMMANDS: {[id: string]: CommandExecutor} = {
    "import": impt,
    "append": append,
    "clean": clean
};

const argv = process.argv.slice(2);
const cmd = argv[0];
const params = argv.slice(1);

initConfig()
    .then(async () => {
        const c = COMMANDS[cmd];

        if (c) {
            await c(params);
        }
    })
    .catch((error: Error) => {
        console.error(error);
    });