import config from './config';
import path from 'path';
import * as core from '@actions/core';
import { Git } from './install/git';
import Linker from './linker';
import { PluginInfo } from './install/plugin';
import { setOutput } from './utils/output';
import { escape, split } from './utils/args';
import os from 'os';

function enableCommand() {
  const tmpDir = path.join(os.tmpdir(), config.execName);
  const [nodeCommand, fefEnterFile] = process.argv;
  const curBinPath = path.join(tmpDir, 'bin');
  const libBinPath = path.join(tmpDir, 'lib');
  if (!process.env.PATH?.startsWith(curBinPath)) {
    process.env.PATH = `${curBinPath}${path.delimiter}${process.env.PATH}`;
  }
  const linker = new Linker(nodeCommand);
  return Promise.all([
    linker.register(curBinPath, libBinPath, fefEnterFile, config.execName),
    linker.register(
      curBinPath, libBinPath,
      `${fefEnterFile} ${config.setOutputCommand}`,
      config.setOutputCommand,
    ),
  ]);
}

async function enableEnv(plugin: string, silent: boolean): Promise<PluginInfo> {
  const git = new Git(silent);
  const [pluginInfo] = await Promise.all([
    git.enablePlugin(plugin),
    enableCommand(),
  ]);
  return pluginInfo;
}

async function exec() {
  let fromAction = true;
  let run;
  let paramsStr;
  const argv = process.argv.slice(2);
  if (argv?.length > 0) {
    fromAction = false;
    [run] = argv;
    const params = argv.slice(1)
      .filter(a => !config.filterParams.includes(a));
    paramsStr = params.join(' ');
    if (run === config.setOutputCommand) {
      return handleSetOutput(params);
    }
  } else {
    run = core.getInput('run');
    paramsStr = core.getInput('params');
  }
  const pluginInfo = await enableEnv(run, !fromAction);
  try {
    await execPlugin(pluginInfo, paramsStr);
    fromAction && core.setOutput('code', 0);
  } catch (err) {
    if (!fromAction) {
      throw err;
    }
    core.setOutput('code', err?.status || 1);
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

exec().catch((e) => {
  console.log(`exec failed: ${e}`);
  process.exit(e?.status || 1);
});

function handleSetOutput(params: string[]) {
  for (let i = 0; i < params.length; i++) {
    const [key, value] = params[i].split('=');
    if (!key || !value) {
      continue;
    }
    setOutput(key, value);
  }
}
