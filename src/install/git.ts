import spawn from 'cross-spawn';

export class Git {

    private pkgDir: string;

    private url: string;

    private gitAccount: any;

    private isSSH: boolean = false;

    constructor(url: string, pkgDir: string) {
        this.pkgDir = pkgDir;
        this.url = url;
    }

    install(url: string, ver: string) {

    }

    async getTag(
        repoUrl: string,
        version?: string
    ): Promise<string | undefined> {
        const url = await this.transformUrl(repoUrl);
        const { stdout } = spawn.sync('git', [
            'ls-remote',
            '--tags',
            '--refs',
            url
        ]);

        const tagListStr = stdout?.trim();
        if (!tagListStr) {
            return;
        }

        const tagList = tagListStr.split('\n');
        let satisfiedMaxVersion: string | undefined;
        for (const tagStr of tagList) {
            const [, tagReference] = tagStr.split('\t');
            const tag = tagReference?.substring('refs/tags/'.length);
            if (!versionImpl.check(tag)) {
                continue;
            }
            if (tag === version) {
                return tag;
            }
            if (version && !versionImpl.satisfies(tag, version)) {
                continue;
            }
            if (!satisfiedMaxVersion || versionImpl.gt(tag, satisfiedMaxVersion)) {
                satisfiedMaxVersion = tag;
            }
        }
        return satisfiedMaxVersion;
    }

    async transformUrl(url: string, account?: any): Promise<any> {
        const hostname = this.getHostname(url);
        const isSSH = await this.isSupportSSH(`git@${hostname}`);
        if (isSSH) {
            if (/https?/.test(url)) {
                return url.replace(/https?:\/\//, 'git@').replace(/\//, ':');
            } else {
                return url;
            }
        } else {
            let transformedUrl;
            if (/https?/.test(url)) {
                transformedUrl = url;
            } else {
                transformedUrl = url.replace(`git@${ hostname }:`, `http://${ hostname }/`);
            }
            if (account) {
                this.gitAccount = account;
            }
            if (this.gitAccount) {
                const { username, password } = this.gitAccount;
                return transformedUrl.replace(/http:\/\//, `http://${username}:${password}@`);
            }
            return transformedUrl;
        }
    }

    getHostname(url: string): string {
        if (/https?/.test(url)) {
            const match: any = url.match(/^http(s)?:\/\/(.*?)\//);
            return match[2];
        } else {
            const match: any = url.match(/@(.*):/);
            return match[1];
        }
    }

    async isSupportSSH(url: string): Promise<any> {
        if (this.isSSH) {
            return this.isSSH;
        }
        try {
            const res: any = await Promise.race([
                spawn.sync('ssh', ['-vT', url]),
                new Promise((resolve: any, reject: any) => {
                    setTimeout(() => {
                        reject(new Error('SSH check timeout'));
                    }, 1000);
                })
            ]);

            const stderr = res?.stderr?.toString();
            if (/Authentication succeeded/.test(stderr)) {
                this.isSSH = true;
            } else {
                this.isSSH = false;
            }
            return this.isSSH;
        } catch (err) {
            this.isSSH = false;
            return this.isSSH;
        }
    }

}