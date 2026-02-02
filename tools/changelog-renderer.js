/**
 * Custom changelog renderer that respects conventional commit scopes when filtering changes.
 *
 * This renderer extends Nx's default behavior to properly handle independent project releases.
 * By default, Nx marks commits that touch non-project files (like `.github/CODEOWNERS`) as
 * affecting ALL projects (`affectedProjects: '*'`). This custom renderer adds additional
 * filtering based on the commit scope to ensure commits with explicit project scopes only
 * appear in the relevant project's changelog.
 *
 * Example:
 * - Commit: `perf(react-icons-font-subsetting-webpack-plugin): improve performance`
 * - Even if this commit touches `.github/CODEOWNERS`, it will ONLY appear in the
 *   `react-icons-font-subsetting-webpack-plugin` changelog, not in `react-icons` changelog.
 */

const DefaultChangelogRenderer =
  require('nx/release/changelog-renderer').default;

class ScopedChangelogRenderer extends DefaultChangelogRenderer {
  /**
   * Override the default filterChanges method to add scope-based filtering.
   *
   * The filtering logic:
   * 1. If no project is specified (workspace changelog), include all changes
   * 2. If affectedProjects is '*' (commit touches non-project files):
   *    - Include if commit has no scope (truly affects all projects)
   *    - Include if commit scope matches the current project
   *    - Include if commit scope contains the current project (comma-separated scopes)
   *    - EXCLUDE if commit scope explicitly targets a different project
   * 3. Otherwise, use default behavior (check if project is in affectedProjects array)
   *
   * @param {Array} changes - Array of changelog changes
   * @param {string|null} project - Project name or null for workspace changelog
   * @returns {Array} Filtered changes
   */
  filterChanges(changes, project) {
    if (project === null) {
      // Workspace changelog - include all changes
      return changes;
    }

    return changes.filter((change) => {
      // If affectedProjects is explicitly listing projects, use that
      if (change.affectedProjects !== '*') {
        return (
          Array.isArray(change.affectedProjects) &&
          change.affectedProjects.includes(project)
        );
      }

      // affectedProjects is '*' - commit touches non-project files
      // Apply scope-based filtering
      const scope = change.scope;

      // No scope means it truly affects all projects
      if (!scope) {
        return true;
      }

      // Check if scope matches or contains this project
      // Support comma-separated scopes like "react-icons,react-native-icons"
      const scopes = scope.split(',').map((s) => s.trim());

      // If the scope explicitly mentions a project name, only include in that project's changelog
      // This handles cases like "perf(react-icons-font-subsetting-webpack-plugin): ..."
      //
      // IMPORTANT: We need to check for EXACT matches to avoid false positives.
      // For example, scope "react-icons-font-subsetting-webpack-plugin" should NOT match
      // project "react-icons" just because "react-icons" is a substring.
      return scopes.some((s) => s === project);
    });
  }
}

module.exports = ScopedChangelogRenderer;
module.exports.default = ScopedChangelogRenderer;
