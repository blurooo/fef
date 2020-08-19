import os from 'os';
import path from 'path';
import { Plugin } from './schema/plugin';
import { parseYaml } from './utils/yaml';
import * as core from '@actions/core';
import { Git } from './install/git';
import Linker from "./linker";

const ymlFile = 'plugin.yml';
const server = 'http://gui.oa.com/';
const execName = 'ff';

async function run(pluginPath: string) {
    let fromAction = true;
    try {
        let git = new Git(pluginPath, ymlFile, server, execName);

        let argv = process.argv.slice(2);

        const startCommand = process.argv[0];
        const command = process.argv[1];

        const curBinPath = path.join(pluginPath, "bin")
        new Linker(startCommand).register(curBinPath, path.join(pluginPath, "lib"), command, execName);

        process.env['PATH'] = `${curBinPath}${path.delimiter}${process.env['PATH']}`;

        let run = '';
        let params = '';

        if (argv?.length > 0) {
            fromAction = false;
            run = argv[0];
            params = argv.slice(1).join(' ');
        } else {
            run = core.getInput('run');
            params = core.getInput('params');
        }

        const failedWhenNonZeroExit = core.getInput('failedWhenNonZeroExit');

        const pkgInfo = await git.download(run);

        const pkgPath = path.join(pluginPath, `${pkgInfo.pkg}@${pkgInfo.ver}`);

        const config = await parseYaml(path.join(pkgPath, 'plugin.yml'));

        const plugin = new Plugin({}, pkgPath, config);

        try {
            plugin.command.run(params);
        } catch (err) {
            if (fromAction && err?.status) {
                core.setOutput("code",  err.status);
                if (failedWhenNonZeroExit) {
                    core.setFailed(err.toString());
                }
                return;
            }
        }
        fromAction && core.setOutput("code",  0);
    } catch (e) {
        if (fromAction) {
            core.setFailed(e?.toString());
            console.error(e);
        } else {
            throw e;
        }
    }
}

run(path.join(os.homedir(), 'fef'));