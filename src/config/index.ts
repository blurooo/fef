import os from 'os';
import path from 'path';

const home = os.homedir();

export default {
  // 工作目录
  workPath: path.join(home, '.fef'),
  // 包下载目录
  pluginRootDir: path.join(home, '.fef', 'universal_modules'),
  // 协议文件名
  protocolFileName: 'plugin.yml',
  // 商店
  storeUrl: 'http://gui.oa.com/',
  // 调用依赖的指令 {cmd} {dep}@{ver} $@
  execName: 'fef',
  // 插件前缀
  pluginPrefix: 'feflow-plugin-',
  // 安装成功标志
  fefDoneFile: '.fef.done',
  // 过滤参数
  filterParams: ['--disable-check'],
};
