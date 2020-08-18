import spawn from 'cross-spawn';
import path from 'path';
import fs from 'fs';
import VersionStyle from '../dep/version';

export class Git {

    private pkgRootDir: string;

    private url: string;

    private gitAccount: any;

    private isSSH: boolean = false;

    constructor(url: string, pkgRootDir: string) {
        this.pkgRootDir = pkgRootDir;
        this.url = url;
    }

    async install(pkg: string, ver: string): Promise<any> {
        let url = await this.transformUrl(this.url);
        let checkTag: string = ver;
        if (!ver || ver === 'latest') {
            let latestTag = await this.getTag(url);
            if (!latestTag) {
                return Promise.reject('no any version');
            }
            checkTag = latestTag;
            ver = 'latest';
        } else {
            if (!await this.getTag(url, ver)) {
                return Promise.reject('unknown version');
            }
        }
        const pkgPath = path.join(this.pkgRootDir, `${pkg}@${checkTag}`);
        if (fs.existsSync(pkgPath)) {
            return;
        }
        try {
            await this.clone(url, checkTag, pkgPath);
        } catch(e) {
            return Promise.reject(e);
        }
        if (ver === 'latest') {
            let linkPath = path.join(this.pkgRootDir, `${pkg}@${ver}`);
            fs.symlinkSync(pkgPath, linkPath);
        }
    }

    async getTag(
        repoUrl: string,
        version?: string
    ): Promise<string | undefined> {
        const { stdout } = spawn.sync('git', [
            'ls-remote',
            '--tags',
            '--refs',
            repoUrl
        ]);

        const tagListStr = stdout?.toString()?.trim();
        if (!tagListStr) {
            return;
        }

        const tagList = tagListStr.split('\n');
        let satisfiedMaxVersion: string | undefined;
        for (const tagStr of tagList) {
            const [, tagReference] = tagStr.split('\t');
            const tag = tagReference?.substring('refs/tags/'.length);
            if (!VersionStyle.check(tag)) {
                continue;
            }
            if (tag === version) {
                return tag;
            }
            if (version && !VersionStyle.satisfies(tag, version)) {
                continue;
            }
            if (!satisfiedMaxVersion || VersionStyle.gt(tag, satisfiedMaxVersion)) {
                satisfiedMaxVersion = tag;
            }
        }
        return satisfiedMaxVersion;
    }

    async clone(url: string, tag: string, pkgPath: string): Promise<any> {
        const { error } = spawn.sync('git', ['clone', '-b', tag, '--depth', '1', url, pkgPath]);
        if (error) {
            return Promise.reject(error);
        }
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