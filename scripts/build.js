const ChildProcess = require('child_process');

const prodScenario = process.argv.includes('dist') || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development');
const tsConfigPath = prodScenario ? './tsconfig.json' : './tsconfig.dev.json';
try {
    ChildProcess.execSync(`tsc --build ${ tsConfigPath }`);
}
catch (error) {
    throw error.stdout.toString();
}