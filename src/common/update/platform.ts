export type LinuxFamily = "arch" | "debian" | "unknown";

export const isAndroidPlatform = () => false; // overridden in RN env
export const isWindowsPlatform = () => process.platform === "win32";
export const isLinuxPlatform = () => process.platform === "linux";
export const isDesktopPlatform = () => true;
export const isMobilePlatform = () => false;

export function getLinuxDistributionFamily(): LinuxFamily {
  try {
    const fs = require("fs");
    const txt = fs.readFileSync("/etc/os-release", "utf8").toLowerCase();
    if (txt.includes("arch")) return "arch";
    if (txt.includes("debian") || txt.includes("ubuntu")) return "debian";
  } catch {}
  return "unknown";
}
