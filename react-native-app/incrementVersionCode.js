const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, 'android/app/build.gradle');

function incrementVersionCode() {
    try {
        let content = fs.readFileSync(gradlePath, 'utf8');

        const versionCodeRegex = /versionCode\s+(\d+)/;
        const match = content.match(versionCodeRegex);

        if (match) {
            const currentVersionCode = parseInt(match[1], 10);
            const newVersionCode = currentVersionCode + 1;

            const updatedContent = content.replace(
                versionCodeRegex,
                `versionCode ${newVersionCode}`
            );

            fs.writeFileSync(gradlePath, updatedContent, 'utf8');
            console.log(`✅ VersionCode updated from ${currentVersionCode} to ${newVersionCode}`);
        } else {
            console.error("❌ Could not find 'versionCode' in build.gradle");
        }
    } catch (error) {
        console.error("❌ Error updating build.gradle:", error.message);
    }
}

incrementVersionCode();
