import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import rp from 'request-promise';
import VersionStyle from '../dep/version';
import { parseYaml } from '../utils/yaml';
import { Plugin } from '../schema/plugin';
import Linker from "../linker";

const symlink = util.promisify(fs.symlink);
const unlink = util.promisify(fs.unlink);
const execAsync = util.promisify(exec);
const stat = util.promisify(fs.stat);

class PkgInfo {

    pkg: string;
    checkoutTag: string;
    ver: string;

    constructor(pkg: string, ver: string, checkoutTag: string) {
        this.pkg = pkg;
        this.ver = ver;
        this.checkoutTag = checkoutTag;
    }

}

export class Git {

    private readonly pkgRootDir: string;

    private readonly ymlFile: string;

    private readonly server: string;

    private readonly execName: string;

    private gitAccount: any;

    private isSSH: boolean = false;

    constructor(pkgRootDir: string, ymlFile: string, server: string, execName: string) {
        this.pkgRootDir = pkgRootDir;
        this.ymlFile = ymlFile;
        this.server = server;
        this.execName = execName;
    }

    async download(pkgVer: string): Promise<PkgInfo> {
        let [ pkg, ver ] = pkgVer.split('@');
        let pkgFullName = pkg;
        if (!pkg.startsWith('feflow-plugin-')) {
            pkgFullName = 'feflow-plugin-' + pkg;
        } else {
            pkg = pkg.substring('feflow-plugin-'.length);
        }
        if (!ver) {
            ver = 'latest';
        }
        let linkPath = path.join(this.pkgRootDir, `${pkg}@${ver}`);
        try {
            fs.accessSync(linkPath, fs.constants.F_OK);
            return new PkgInfo(pkg, ver, '');;
        } catch (e) {}
        let url = await this.getRepoInfo(pkgFullName);
        if (!url) {
            return Promise.reject(`unknown pkg: ${pkgFullName}`)
        }
        let checkTag: string = '';
        if (ver === 'latest') {
            let latestTag = await this.getTag(url);
            if (!latestTag) {
                return Promise.reject('no any version');
            }
            checkTag = latestTag;
            ver = 'latest';
        } else {
            let invalidVer = await this.getTag(url, ver)
            if (!invalidVer) {
                return Promise.reject('unknown version:' + url + '@' + ver);
            } else {
                ver = invalidVer;
                checkTag = ver;
            }
        }
        const pkgPath = path.join(this.pkgRootDir, `${pkg}@${checkTag}`);
        if (!fs.existsSync(pkgPath)) {
            try {
                console.log(`download ${pkg}@${ver} from ${url}`);
                await this.clone(url, checkTag, pkgPath);
            } catch(e) {
                return Promise.reject(e);
            }
        }
        if (ver === 'latest') {
            await this.link(pkgPath, linkPath);
        }
        await this.downloadDep(pkgPath);
        return new PkgInfo(pkg, ver, checkTag);
    }

    async link(source: string, target: string) {
        try {
            await unlink(target);
        } catch (e) {}
        return symlink(source, target);
    }

    async downloadDep(pkgPath: string) {
        const config = await parseYaml(path.join(pkgPath, this.ymlFile));
        const plugin = new Plugin({}, pkgPath, config);
        const binPath = path.join(pkgPath, '.bin');
        const libPath = path.join(pkgPath, '.lib');
        return Promise.all(plugin.dep.plugin.map(pkg => {
            return this.download(pkg).then(pkgInfo => {
                new Linker(this.execName).register(binPath, libPath, `${pkgInfo.pkg}@${pkgInfo.ver}`, pkgInfo.pkg);
            })
        }));
    }

    async getRepoInfo(packageName: string): Promise<string> {
        const options = {
            url: `${this.server}apply/getlist?name=${packageName}`,
            method: 'GET'
        };
        return rp(options).then((response: any) => {
            const data = JSON.parse(response);
            !this.gitAccount && (this.gitAccount = data?.account);
            return data?.data?.[0]?.repo;
        })
    }

    async getTag(
        repoUrl: string,
        version?: string
    ) {
        const { stdout } = await execAsync(`git ls-remote --tags --refs ${repoUrl}`, {
            timeout: 2000,
            windowsHide: true
        });

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

    async clone(url: string, tag: string, pkgPath: string) {
        return execAsync(`git clone -b ${tag} --depth 1 ${url} ${pkgPath}`, {
            windowsHide: true
        });
    }

    async transformUrl(url: string, account?: any) {
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

    async isSupportSSH(url: string) {
        if (this.isSSH) {
            return this.isSSH;
        }
        try {
            const res: any = await execAsync(`ssh -vT ${url}`, { timeout: 1000, windowsHide: true })
            const stderr = res?.stderr?.toString();
            this.isSSH = /Authentication succeeded/.test(stderr);
            return this.isSSH;
        } catch (err) {
            this.isSSH = false;
            return this.isSSH;
        }
    }

}