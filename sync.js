// sync-versions.js
import fs from 'fs-extra';
import path from 'path';
import process from 'process';

const appDirName = 'react-native-app';
const rootPackagePath = path.join(process.cwd(), 'package.json');
const rnPackagePath = path.join(process.cwd(), appDirName, 'package.json');
const gradlePath = path.join(process.cwd(), appDirName, 'android/app/build.gradle');

async function syncVersions() {
  try {
    const rootPackage = await fs.readJson(rootPackagePath);
    const rnPackage = await fs.readJson(rnPackagePath);

    if (rootPackage.version !== rnPackage.version) {
      console.log(`Syncing version: ${rootPackage.version}`);
      rnPackage.version = rootPackage.version;
      await fs.writeJson(rnPackagePath, rnPackage, { spaces: 2 });
      console.log(`✅ Version synchronized successfully to ${rootPackage.version}.`);
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
    const packageJson = JSON.parse(fs.readFileSync(rnPackagePath, 'utf8'));
    const newVersionName = packageJson.version;

    if (!newVersionName) {
      throw new Error("No version found in package.json");
    }

    let gradleContent = fs.readFileSync(gradlePath, 'utf8');

    const versionNameRegex = /versionName\s+["']([^"']+)["']/;

    if (versionNameRegex.test(gradleContent)) {
      const updatedContent = gradleContent.replace(
        versionNameRegex,
        `versionName '${newVersionName}'`
      );

      fs.writeFileSync(gradlePath, updatedContent, 'utf8');
      console.log(`✅ build.gradle updated to versionName: "${newVersionName}"`);
    } else {
      console.error("❌ Could not find 'versionName' in build.gradle");
    }
  } catch (error) {
    console.error("❌ Sync Error:", error.message);
  }
}

syncVersions();
syncVersionName();
