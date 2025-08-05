// @ts-check
import {join} from 'node:path'
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs'
import {execSync} from 'node:child_process'
import webpackBundler from 'monosize-bundler-webpack';

/** @type {import('monosize').MonoSizeConfig} */
const config = {
  repository: 'https://github.com/microsoft/fluentui-system-icons',
  storage: createArtifactStorage(),
  bundler: webpackBundler(config => {
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];

    // Add loader for font files
    config.module.rules.push({
        test: /\.(ttf|woff2?|woff)$/,
        type: 'asset/resource',
    });

    return config;
  }),
  threshold: '10kB'
};

export default config;


/**
  * Creates an artifact storage adapter for Monosize.
  * This adapter fetches bundle size baselines from GitHub Actions artifacts
  * using the GitHub CLI and uploads new baselines as artifacts.
 * @returns {import('monosize').StorageAdapter}
 */
function createArtifactStorage(){
  const tempDir = join(import.meta.dirname, '.temp');
  const baselineArtifactName = 'bundle-size-baseline';

/**
 *
 * @param {string} reportPath
 * @returns {import('monosize').BundleSizeReport}
 */
  function getReport(reportPath){
    return JSON.parse(readFileSync(reportPath, 'utf-8'))
  }

  /**
   * Downloads the latest baseline artifact from GitHub Actions
   * @returns {Promise<string>} Path to the downloaded baseline file
   */
  async function downloadBaselineArtifact() {
    // Ensure temp directory exists
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    try {
      // First, try to find the latest successful workflow run on main branch
      console.log('Looking for latest baseline artifact...');

      // Get the latest successful workflow run for the baseline job
      const listRunsCmd = `gh run list --repo microsoft/fluentui-system-icons --workflow=bundle-size.baseline.yml --branch=main --status=success --limit=1 --json databaseId`;
      const runsOutput = execSync(listRunsCmd, { encoding: 'utf-8' });
      /** @type {Array<{databaseId:string}>} */
      const runs = JSON.parse(runsOutput);

      if (runs.length === 0) {
        throw new Error('No successful baseline workflow runs found');
      }

      const latestRunId = runs[0].databaseId;

      // Download the artifact from the latest successful run
      const downloadCmd = `gh run download ${latestRunId} --repo microsoft/fluentui-system-icons --name ${baselineArtifactName} --dir ${tempDir}`;
      console.log(`Downloading baseline artifact from run ${latestRunId}...`);
      execSync(downloadCmd, { stdio: 'inherit' });

      const baselinePath = join(tempDir, 'monosize.json');
      if (!existsSync(baselinePath)) {
        throw new Error('Downloaded artifact does not contain monosize.json');
      }

      console.log('Successfully downloaded baseline artifact');
      return baselinePath;
    } catch (error) {
      console.warn('Failed to download baseline artifact:', error.message);
      console.log('Using empty baseline for comparison');

      // Return a fallback empty baseline
      const fallbackPath = join(tempDir, 'fallback-baseline.json');
      writeFileSync(fallbackPath, JSON.stringify([], null, 2), 'utf-8');
      return fallbackPath;
    }
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRemoteReport: async (_branch) => {
      const baselinePath = await downloadBaselineArtifact();
      const report = getReport(baselinePath);
      return {
        commitSHA: 'artifact',
        remoteReport: report
      }
    },
    uploadReportToRemote: async () => {
      try {
        const reportPath = join(import.meta.dirname, 'dist/bundle-size/monosize.json');

        if (!existsSync(reportPath)) {
          throw new Error('Bundle size report not found at ' + reportPath);
        }

        const packageJsonPath = join(import.meta.dirname, 'package.json');
        /** @type {{name:string}} */
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        const report = getReport(reportPath);
        const updatedReport = report.map(entry=>{
          entry.packageName = packageJson.name;
          return entry
        });

        writeFileSync(reportPath,JSON.stringify(updatedReport),'utf-8')

        console.log('Bundle size report ready for artifact upload at:', reportPath);
        console.log('Note: Actual artifact upload is handled by GitHub Actions workflow');

        // The workflow will use actions/upload-artifact to upload this file
        // We just need to ensure the report is generated and ready
      } catch (error) {
        console.error('Failed to prepare bundle size report:', error.message);
        throw error;
      }
    },
  }
}