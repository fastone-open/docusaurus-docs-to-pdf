const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    const buildTime = new Date().toISOString();
    const packageJson = require('../package.json');
    const version = packageJson.version;

    const content = `
export const buildInfo = {
    version: '${version}',
    commitHash: '${commitHash}',
    buildTime: '${buildTime}'
};
`;

    const outputPath = path.resolve(__dirname, '../src/buildInfo.ts');
    fs.writeFileSync(outputPath, content);
    console.log(`Build info generated at ${outputPath}`);
} catch (error) {
    console.error('Error generating build info:', error);
    // Fallback if git is not available (e.g. inside a tarball without .git)
    const content = `
export const buildInfo = {
    version: 'unknown',
    commitHash: 'unknown',
    buildTime: new Date().toISOString()
};
`;
    const outputPath = path.resolve(__dirname, '../src/buildInfo.ts');
    fs.writeFileSync(outputPath, content);
}
