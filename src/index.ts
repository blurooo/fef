import os from 'os';
import fs from 'fs';
import path from 'path';
import { Plugin } from './schema/plugin';
import { parseYaml } from './utils/yaml';
import { UniversalPkg } from './dep/pkg';
import * as core from '@actions/core';

function fileDisplay(filePath: string){
    console.log('打印路径：', filePath)
    //根据文件路径读取文件，返回文件列表
    fs.readdir(filePath,function(err,files){
        console.log('err', err, 'files', files);
        if(err){
            console.warn(err)
        }else{
            //遍历读取到的文件列表
            files.forEach(function(filename){
                //获取当前文件的绝对路径
                var filedir = path.join(filePath,filename);
                //根据文件路径获取文件信息，返回一个fs.Stats对象
                fs.stat(filedir,function(eror,stats){
                    if(eror){
                        console.warn('获取文件stats失败');
                    }else{
                        var isFile = stats.isFile();//是文件
                        var isDir = stats.isDirectory();//是文件夹
                        if(isFile){
                            console.log(filedir);
                        }
                        if(isDir){
                            fileDisplay(filedir);//递归，如果是文件夹，就继续遍历该文件夹下面的文件
                        }
                    }
                })
            });
        }
    });
}

async function run() {
    try {
        console.log('pwd', process.cwd());

        fileDisplay(process.cwd());
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