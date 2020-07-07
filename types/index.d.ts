declare type JsonType = { [id: string]: unknown };

declare interface DriveConfig {
    searchPageSize: number
}

declare interface Google$Credentials {
    installed: {
        client_id: string,
        project_id: string,
        auth_uri: string,
        token_uri: string,
        auth_provider_x509_cert_url: string,
        client_secret: string,
        redirect_uris: string[]
    }
}

declare interface Drive$File {
    id: string,
    name: string,
    parents: string[],
    createdTime: string,
    modifiedTime: string
}

declare interface RequestOptions$Get {
    searchPageSize?: number,
    parentId?: string,
    onlyFolder?: boolean
}

declare interface RequestOptions$Post {
    fileId: string,
    name?: string,
    addParents?: string,
    removeParents?: string
}

declare interface RequestOptions$New {
    name: string,
    parentId?: string,
    color?: string
}

declare interface DriveEntry {
    id: string,
    fullname: string,
    parent?: string,
    groups: string[],
    name: string,
    tags: string[],
    category: string
}

declare type CommandExecutor = (params: string[]) => Promise<void>;

declare interface AppSettings$Basic {
    id: string,
    name?: string
}

declare interface AppSettings$Group extends AppSettings$Basic {
    name: string,
    tags: string[],
    noallow?: string[]
}

declare interface AppSettings$CleanProfile {
    default?: boolean,
    threshold: number,
    stash: AppSettings$Basic,
    targets: AppSettings$Basic[]
}

declare type AppSettings$CleanTasks = { [profile: string]: AppSettings$CleanProfile }