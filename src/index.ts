import os from 'os';
import fs from 'fs';
import path from 'path';
import { Plugin } from './schema/plugin';
import { parseYaml } from './utils/yaml';
import { UniversalPkg } from './dep/pkg';
import * as core from '@actions/core';

async function run(pluginPath: string) {
    try {
        console.log('pwd', process.cwd());

        console.log('env', process.env)

        const home = os.homedir();

        const workdir = path.join(home, '.fef');

        const dependency = path.join(workdir, 'universal-package.json');

        const pkgRelation = new UniversalPkg(dependency);

        const run = core.getInput('run');
        const params = core.getInput('params');
        const failedWhenNonZeroExit = core.getInput('failedWhenNonZeroExit');

        const runSplit = run.split('@');
        let pkg = runSplit[0];

        if (!pkg) {
            throw '请传递运行的插件';
        }

        if (!pkg.startsWith('feflow-plugin-')) {
            pkg = `feflow-plugin-${pkg}`;
        }

        let version: string | undefined = runSplit[1];
        if (!version) {
            version = pkgRelation.getInstalled().get(pkg);
        }
        if (!version) {
            version = 'latest';
        }

        const pkgPath = path.join(workdir, 'universal_modules', `${pkg}@${version}`);

        const config = parseYaml(path.join(pkgPath, 'plugin.yml'));

        const plugin = new Plugin({}, pkgPath, config);

        let execResult = await plugin.command.runPipe(params);

        if (execResult.err?.code) {
            core.setOutput("code",  execResult.err.code);
        } else {
            core.setOutput("code",  0);
        }
        core.setOutput("stdout", execResult.stdout?.toString().trim());
        core.setOutput("stderr", execResult.stderr?.toString().trim());
        if (execResult.err && failedWhenNonZeroExit) {
            core.setFailed(execResult.err.message);
        }
    } catch (e) {
        console.log('执行失败', e);
    }
}

run();