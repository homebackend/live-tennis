import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { cwd, exit } from 'process';

const gradlePath = join(cwd(), 'android/app/build.gradle');

function incrementVersionCode() {
    try {
        let content = readFileSync(gradlePath, 'utf8');

        const versionCodeRegex = /versionCode\s+(\d+)/;
        const match = content.match(versionCodeRegex);

        if (match) {
            const currentVersionCode = parseInt(match[1], 10);
            const newVersionCode = currentVersionCode + 1;

            const updatedContent = content.replace(
                versionCodeRegex,
                `versionCode ${newVersionCode}`
            );

            writeFileSync(gradlePath, updatedContent, 'utf8');
            console.log(`✅ VersionCode updated from ${currentVersionCode} to ${newVersionCode}`);
            exit(2);
        } else {
            console.error("❌ Could not find 'versionCode' in build.gradle");
            exit(1);
        }
    } catch (error) {
        console.error("❌ Error updating build.gradle:", error.message);
        exit(1);
    }
}

incrementVersionCode();
