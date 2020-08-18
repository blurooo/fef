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

function toArray(v: any, defaultV?: string[]): string[] {
  if (v && !Array.isArray(v)) {
    if (typeof v === 'string') {
      return [v];
    }
    throw `field must provide either a string or an array of strings`;
  }
  return v || defaultV || [];
}

export { platformType, arch, toArray };
