import * as readline from "readline";

export function promptAsk (text: string) : Promise<string> {
    const rl = readline.createInterface({
        "input": process.stdin,
        "output": process.stdout,
    });

    return new Promise(
        resolve => {
            rl.question(text, answer => {
                rl.close();
                return resolve(answer);
            });
        }
    );
}

export function driveEntryParser (id: string, fullname: string, parent?: string) : DriveEntry {

    const parts: DriveEntry = {
        id: id,
        fullname: fullname,
        parent: parent,
        groups: [],
        name: "",
        tags: [],
        category: ""
    };

    let matches = /((.+) @ )?(.+) \[(.+)\]/g.exec(fullname) || [];

    if (matches.length > 0) {
        parts.groups.push(matches[2]);
        parts.name = matches[3];
        parts.tags = [...matches[4].split(";").map(x => x.trim())];

    } else {
        matches = /(.+) @ (.+)/g.exec(fullname) || [];

        if (matches.length > 0) {
            parts.groups.push(matches[1]);
            parts.name = matches[2];

        }
    }

    const group = parts.groups[0] || "";
    if (group.indexOf(";") > -1) {
        parts.groups = [ ...parts.groups, ...group.split(";").map(s => s.trim()) ];
    }

    return parts;
}

export function inArray<T> (array: T[], el: T) : boolean {
    for ( let i = array.length; i--; ) {
        if ( array[i] === el ) return true;
    }
    return false;
}