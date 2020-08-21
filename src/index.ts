import config from './config';
import path from 'path';
import * as core from '@actions/core';
import { Git } from './install/git';
import Linker from './linker';
import {PluginInfo} from './install/plugin';

function enableCommand(workDir: string) {
    const nodeCommand = process.argv[0];
    const fefEnterFile = process.argv[1];
    const curBinPath = path.join(workDir, "bin");
    const libBinPath = path.join(workDir, "lib");
    process.env['PATH'] = `${curBinPath}${path.delimiter}${process.env['PATH']}`;
    const linker = new Linker(nodeCommand);
    return linker.register(curBinPath, libBinPath, fefEnterFile, config.execName);
}

async function enableEnv(plugin: string, silent: boolean): Promise<PluginInfo> {
    const git = new Git(silent);
    const [ pluginInfo ] = await Promise.all([
        git.enablePlugin(plugin),
        enableCommand(config.workPath)
    ]);
    return pluginInfo;
}

async function exec() {
    let fromAction = true;
    let run;
    let params;
    let argv = process.argv.slice(2);
    if (argv?.length > 0) {
        fromAction = false;
        run = argv[0];
        params = argv.slice(1).join(' ');
    } else {
        run = core.getInput('run');
        params = core.getInput('params');
    }
    const pluginInfo = await enableEnv(run, !fromAction);
    try {
        await execPlugin(pluginInfo, params);
        fromAction && core.setOutput("code",  0);
    } catch (err) {
        if (!fromAction) {
            throw err
        }
        core.setOutput("code",  err?.status || 1);
        const failedWhenNonZeroExit = core.getInput('failedWhenNonZeroExit');
        if (failedWhenNonZeroExit) {
            core.setFailed(err?.toString());
        }
    }
}

async function execPlugin(pluginInfo: PluginInfo, params: string) {
    const protocol = await pluginInfo.getProtocol();
    protocol.command.run(params);
}

exec().catch(e => {
    process.exit(e?.status || 1);
});