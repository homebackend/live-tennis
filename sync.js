// sync-versions.js
import fs from 'fs-extra';
import path from 'path';
import process from 'process';

const appDirName = 'react-native-app';
const rootPackagePath = path.join(process.cwd(), 'package.json');
const rnPackagePath = path.join(process.cwd(), appDirName, 'package.json');
const gradlePath = path.join(process.cwd(), appDirName, 'android/app/build.gradle');
const rootPackage = await fs.readJson(rootPackagePath);
let modified = false;

async function syncVersions() {
  try {
    const rnPackage = await fs.readJson(rnPackagePath);

    if (rootPackage.version !== rnPackage.version) {
      console.log(`Syncing version: ${rootPackage.version}`);
      rnPackage.version = rootPackage.version;
      await fs.writeJson(rnPackagePath, rnPackage, { spaces: 2 });
      console.log(`✅ Version synchronized successfully to ${rootPackage.version}.`);
      modified = true;
    } else {
      console.log('✅ Versions are already in sync.');
    }
  } catch (error) {
    console.error('❌ Error synchronizing versions:', error);
    process.exit(1);
  }
}

function syncVersionName() {
  try {
    let gradleContent = fs.readFileSync(gradlePath, 'utf8');

    const versionNameRegex = /versionName\s+["']([^"']+)["']/;
    const rootVersionNameRegex = `versionName\\s+["']${rootPackage.version}["']`;
    const matchVersionNameRegex = new RegExp(rootVersionNameRegex);

    if (!versionNameRegex.test(gradleContent)) {
      console.error("❌ Could not find 'versionName' in build.gradle");
      process.exit(1);
    }

    if (matchVersionNameRegex.test(gradleContent)) {
      console.log('✅ Version names are already in sync.');
    } else {
      const updatedContent = gradleContent.replace(
        versionNameRegex,
        `versionName '${rootPackage.version}'`
      );

      fs.writeFileSync(gradlePath, updatedContent, 'utf8');
      console.log(`✅ build.gradle updated to versionName: "${rootPackage.version}"`);
      modified = true;
    }
  } catch (error) {
    console.error("❌ Sync Error:", error.message);
    process.exit(1);
  }
}

syncVersions();
syncVersionName();

if (modified) {
  process.exit(2);
}
