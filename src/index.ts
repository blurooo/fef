import os from 'os';
import path from 'path';
import { Plugin } from './schema/plugin';
import { parseYaml } from './utils/yaml';
import { UniversalPkg } from './dep/pkg';
import core from '@actions/core';
import github from '@actions/github';

try {

    const home = os.homedir();

    const workdir = path.join(home, '.fef');

    const dependency = path.join(workdir, 'universal-package.json');

    const pkgRelation = new UniversalPkg(dependency);

    const run = core.getInput("run");
    const params = core.getInput("params");

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

    plugin.command.run(params);
} catch (e) {
    console.log('执行失败', e);
}