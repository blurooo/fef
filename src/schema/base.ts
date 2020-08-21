import os from 'os';

const platformMap: {[index:string]: string} = {
  aix: 'linux',
  freebsd: 'linux',
  linux: 'linux',
  openbsd: 'linux',
  sunos: 'linux',
  win32: 'windows',
  darwin: 'macos'
};

const platform = os.platform();
const arch = os.arch();
const platformType = platformMap[platform] ? platformMap[platform] : platform;


export { platformType, arch };
