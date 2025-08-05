# Bundle Size Monitoring

This package uses [monosize](https://github.com/microsoft/monosize) to monitor bundle size changes and ensure they stay within acceptable thresholds.

## How it works

### Baseline Generation
- When changes are merged to the `main` branch, the `bundle-size.baseline.yml` workflow runs
- It builds the package, generates a bundle size report, and uploads it as a GitHub Actions artifact named `bundle-size-baseline`
- This artifact serves as the baseline for future comparisons

### PR Validation
- When a PR is opened, the `pr.yml` workflow runs bundle size analysis
- The monosize configuration (`monosize.config.mjs`) automatically downloads the latest baseline artifact using GitHub CLI
- It compares the current bundle size against the baseline and reports any significant changes

### Configuration
- **Threshold**: Currently set to `10kB` - changes above this threshold will cause the build to fail
- **Retention**: Baseline artifacts are kept for 90 days
- **Fallback**: If no baseline artifact is found (e.g., first run), an empty baseline is used

## Local Development

To run bundle size analysis locally:

```bash
npm run build
npm run bundle-size
npx monosize compare-reports
```

Note: Local runs will attempt to download the latest baseline artifact from GitHub Actions. Make sure you have the GitHub CLI installed and authenticated.

## Troubleshooting

If bundle size checks fail:
1. Check if the size increase is justified
2. Consider if the threshold needs adjustment
3. Review if tree-shaking is working properly
4. Look for accidentally included large dependencies

## Migration from Git-based Storage

This system replaces the previous approach that committed baseline files to git. Benefits include:
- No merge conflicts from baseline updates
- Cleaner git history
- Automatic cleanup of old baselines
- Better integration with GitHub Actions workflow
