export type LinuxFamily = 'arch' | 'debian' | 'unknown';

export function getLinuxDistributionFamily(): LinuxFamily {
  try {
    const fs = require('fs');
    const txt = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
    if (txt.includes('arch')) return 'arch';
    if (txt.includes('debian') || txt.includes('ubuntu')) return 'debian';
  } catch {}
  return 'unknown';
}
