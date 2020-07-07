import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";

import { promptAsk as ask } from "../utils";
import { readTextIfExists, writeFile } from "../dataio";

export function loadCredentials (credentialsPath: string) : Google$Credentials {
    const text = readTextIfExists(credentialsPath);

    if (text) {
        return JSON.parse(text);
    }

    throw new Error("credentials.json not found");
}

export class OAuth2 {
    private oAuth2Client: OAuth2Client;

    constructor (clientId: string, clientSecret: string, redirectUri: string) {
        this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    }

    getClient = (): OAuth2Client => this.oAuth2Client

    getAuthUrl (scopes: string[]) : string {
        return this.oAuth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes
        });
    }

    getAccessToken (code: string, tokenPath?: string) : Promise<void> {
        return new Promise(
            (resolve, reject) => {
                this.oAuth2Client.getToken(code, (error, token) => {
                    if (error) return reject(error);
                    if (token) {
                        if (tokenPath) writeFile(tokenPath, JSON.stringify(token));
                        this.oAuth2Client.setCredentials(token);
                        return resolve();
                    }
                });
            }
        );
    }

    async authorize (scopes: string[], tokenPath: string) : Promise<void> {
        try {
            const token: Credentials = JSON.parse("" + readTextIfExists(tokenPath));
            this.oAuth2Client.setCredentials(token);

        } catch (error) {
            const authUrl = this.getAuthUrl(scopes);
            console.log(`Authorize this app by visiting this url: ${authUrl}`);

            const code = await ask("Enter the code from that page here: ");
            await this.getAccessToken(code, tokenPath);
        }
    }
}
