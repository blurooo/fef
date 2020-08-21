import path from 'path';
import fs from '../fs';
import rp from 'request-promise';
import VersionStyle from '../dep/version';
import Linker from "../linker";
import util from "util";
import { exec } from 'child_process';
import { PluginInfo } from "./plugin";
import config from '../config';

const execAsync = util.promisify(exec);

export class Git {

    private gitAccount: any;

    private isSSH: boolean = false;

    private readonly silent: boolean;

    constructor(silent: boolean) {
        this.silent = silent;
    }

    async enablePlugin(pluginVer: string): Promise<PluginInfo> {
        let [ plugin, ver ] = pluginVer.split('@');
        let pluginFullName = plugin;
        if (!plugin.startsWith(config.pluginPrefix)) {
            pluginFullName = config.pluginPrefix + plugin;
        } else {
            plugin = plugin.substring(config.pluginPrefix.length);
        }
        if (!ver || ver === 'latest') {
            ver = 'latest';
        }
        ver = VersionStyle.toFull(ver);
        if (!VersionStyle.check(ver)) {
            return Promise.reject(`invalid version: ${pluginVer}`);
        }
        const pluginInfo = new PluginInfo(config.pluginRootDir, plugin, ver, config.protocolFileName);
        try {
            // 完成标志存在则不需要下载
            const doneFile = path.join(pluginInfo.pluginPath, config.fefDoneFile);
            await fs.access(doneFile, fs.constants.F_OK);
            return pluginInfo;
        } catch (e) {}
        let url = await this.getRepoInfo(pluginFullName);
        if (!url) {
            return Promise.reject(`unknown pkg: ${pluginFullName}`)
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
        pluginInfo.checkoutTag = checkTag;
        const pluginRealPath = pluginInfo.getPluginRealPath();
        try {
            await fs.access(pluginRealPath);
        } catch (e) {
            try {
                this.silent || console.log(`download ${plugin}@${ver} from ${url}`);
                await this.clone(url, checkTag, pluginRealPath);
            } catch(e) {
                return Promise.reject(e);
            }
        }
        if (ver === 'latest') {
            await fs.link(pluginRealPath, pluginInfo.pluginPath);
        }
        await this.enableDeps(pluginInfo);
        return pluginInfo;
    }

    async enableDeps(pluginInfo: PluginInfo) {
        const pluginPath = pluginInfo.getPluginRealPath();
        const binPath = path.join(pluginPath, '.bin');
        const libPath = path.join(pluginPath, '.lib');
        const protocol = await pluginInfo.getProtocol();
        const tasks = protocol.dep.plugin.map(plugin => {
            return this.enablePlugin(plugin).then(depPluginInfo => {
                const linker = new Linker(config.execName);
                const command = `${depPluginInfo.pluginName}@${depPluginInfo.ver}`;
                return linker.register(binPath, libPath, command, depPluginInfo.pluginName);
            });
        });
        // 写入安装完成标志
        return Promise.all(tasks).then(() => {
            const doneFile = path.join(pluginPath, config.fefDoneFile);
            return fs.writeFile(doneFile, '', {
                flag: 'w',
                encoding: 'utf8'
            });
        });
    }

    async getRepoInfo(packageName: string): Promise<string> {
        const options = {
            url: `${config.storeUrl}apply/getlist?name=${packageName}`,
            method: 'GET'
        };
        return rp(options).then((response: any) => {
            const data = JSON.parse(response);
            !this.gitAccount && (this.gitAccount = data?.account);
            return data?.data?.[0]?.repo;
        })
    }

    async getTag(repoUrl: string, version?: string) {
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