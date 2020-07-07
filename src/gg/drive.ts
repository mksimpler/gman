import { drive_v3 } from "googleapis";
import type { OAuth2 } from "./auth";

const TYPE_FOLDER = "application/vnd.google-apps.folder";

interface ResultObject {
    files: drive_v3.Schema$File[],
    nextPageToken?: string
}

export class Drive {
    private driveInstance: drive_v3.Drive;
    private config: DriveConfig;

    constructor (auth: OAuth2, config: DriveConfig) {
        this.driveInstance = new drive_v3.Drive({
            auth: auth.getClient()
        });

        this.config = config;
    }

    private prepareParams (options: RequestOptions$Get): drive_v3.Params$Resource$Files$List {
        const parameters: drive_v3.Params$Resource$Files$List = {
            pageSize: options.searchPageSize || this.config.searchPageSize,
            pageToken: undefined,
            spaces: "drive",
            fields: "nextPageToken, files(id, name, parents, createdTime, modifiedTime)",
            q: "trashed = false"
        };

        if (options.parentId) {
            parameters.q += ` and '${options.parentId}' in parents`;
        }

        if (options.onlyFolder) {
            parameters.q += ` and mimeType = '${TYPE_FOLDER}'`;
        }

        return parameters;
    }

    private async drive_list (parameters: drive_v3.Params$Resource$Files$List) : Promise<ResultObject | null> {
        return new Promise(
            (resolve, reject) => {
                this.driveInstance.files.list(parameters, (error, response) => {
                    if (error) return reject(error);
                    if (response) {
                        const files = response.data.files || [];
                        const nextPageToken = response.data.nextPageToken || undefined;
                        return resolve({ files, nextPageToken });
                    }
                    return resolve(null);
                });
            }
        );
    }

    private async drive_update (parameters: drive_v3.Params$Resource$Files$Update) : Promise<void> {
        return new Promise(
            (resolve, reject) => {
                this.driveInstance.files.update(parameters, error => {
                    if (error) return reject(error);
                    resolve();
                });
            }
        );
    }

    async list (options: RequestOptions$Get): Promise<Drive$File[]> {
        const parameters = this.prepareParams(options);

        const files: Drive$File[] = [];

        do {
            const result = await this.drive_list(parameters);

            if (result !== null) {
                for (const file of result.files) {
                    files.push(file as Drive$File);
                }

                parameters.pageToken = result.nextPageToken;
            }
        } while (parameters.pageToken !== undefined);

        return files;
    }

    async find (options: RequestOptions$Get & {
        name: string
    }): Promise<Drive$File[]> {
        const parameters = this.prepareParams(options);
        parameters.q += ` and name = ${options.name}`;

        const files: Drive$File[] = [];

        do {
            const result = await this.drive_list(parameters);

            if (result !== null) {
                for (const file of result.files) {
                    files.push(file as Drive$File);
                }

                parameters.pageToken = result.nextPageToken;
            }
        } while (parameters.pageToken !== undefined);

        return files;
    }

    async move (options: RequestOptions$Post) : Promise<void> {
        const parameters: drive_v3.Params$Resource$Files$Update = {
            fileId: options.fileId,
            addParents: options.addParents,
            removeParents: options.removeParents
        };

        await this.drive_update(parameters);
    }

    async remove (options: RequestOptions$Post) : Promise<void> {
        const parameters: drive_v3.Params$Resource$Files$Update = {
            fileId: options.fileId,
            requestBody: {
                trashed: true
            }
        };

        await this.drive_update(parameters);
    }

    async rename (options: RequestOptions$Post) : Promise<void> {
        const parameters: drive_v3.Params$Resource$Files$Update = {
            fileId: options.fileId,
            requestBody: {
                name: options.name
            }
        };

        await this.drive_update(parameters);
    }

    async createFolder (options: RequestOptions$New) : Promise<Drive$File> {
        const metadata: drive_v3.Schema$File = {
            name: options.name,
            mimeType: TYPE_FOLDER
        };

        if (options.parentId) {
            metadata.parents = [options.parentId];
        }

        if (options.color) {
            metadata.folderColorRgb = options.color;
        }

        const parameters: drive_v3.Params$Resource$Files$Create = {
            fields: "id, name, mimeType, parents",
            requestBody: metadata
        };

        return new Promise(
            (resolve, reject) => {
                this.driveInstance.files.create(parameters, (error, response) => {
                    if (error) return reject(error);
                    if (response) {
                        resolve(response.data as Drive$File);
                    }
                });
            }
        );
    }
}
