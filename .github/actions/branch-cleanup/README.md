# Branch Cleanup Action

A GitHub Action that automatically deletes branches whose last commit is older than a specified number of days (default: 14 days).

## Features

- 🗑️ **Automatic Branch Cleanup**: Deletes branches with commits older than the specified threshold
- 🛡️ **Protected Branches**: Automatically protects common branches (main, master, develop, etc.)
- 🔍 **Dry Run Mode**: Preview which branches would be deleted without actually deleting them
- 🎯 **Custom Patterns**: Exclude branches matching specific regex patterns
- 📊 **Detailed Output**: Provides comprehensive logging and outputs for deleted/skipped branches
- ⚙️ **Configurable**: Customize the age threshold, protected branches, and exclusion patterns

## Usage

### Basic Usage

```yaml
name: Cleanup Old Branches
on:
  schedule:
    - cron: '0 2 * * 0'  # Run weekly on Sundays at 2 AM
  workflow_dispatch:  # Allow manual triggering

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to delete branches
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all branches
          
      - name: Cleanup old branches
        uses: ./.github/actions/branch-cleanup
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Usage

```yaml
- name: Cleanup old branches
  uses: ./.github/actions/branch-cleanup
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    days-old: 30  # Delete branches older than 30 days
    dry-run: true  # Preview mode
    protected-branches: 'main,master,develop,staging,production,release/*'
    exclude-pattern: '^(feature|hotfix)/.*$'  # Exclude feature and hotfix branches
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token with repository permissions | Yes | `${{ github.token }}` |
| `days-old` | Number of days after which to delete branches | No | `14` |
| `dry-run` | Preview branches that would be deleted without actually deleting them | No | `false` |
| `protected-branches` | Comma-separated list of branch names to protect from deletion | No | `main,master,develop,staging,production` |
| `exclude-pattern` | Regex pattern for branch names to exclude from deletion | No | `''` |

## Outputs

| Output | Description |
|--------|-------------|
| `deleted-branches` | JSON array of deleted branch names |
| `skipped-branches` | JSON array of skipped branch names with reasons |

## Examples

### Weekly Cleanup with Notifications

```yaml
name: Weekly Branch Cleanup
on:
  schedule:
    - cron: '0 2 * * 0'  # Sundays at 2 AM

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Cleanup branches
        id: cleanup
        uses: ./github/actions/branch-cleanup
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          days-old: 21
          
      - name: Comment on cleanup results
        if: steps.cleanup.outputs.deleted-branches != '[]'
        run: |
          echo "Deleted branches: ${{ steps.cleanup.outputs.deleted-branches }}"
          echo "Skipped branches: ${{ steps.cleanup.outputs.skipped-branches }}"
```

### Dry Run Before Actual Cleanup

```yaml
name: Branch Cleanup with Confirmation
on:
  workflow_dispatch:
    inputs:
      execute:
        description: 'Actually delete branches (uncheck for dry run)'
        type: boolean
        default: false

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - name: Branch cleanup
        uses: ./.github/actions/branch-cleanup
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: ${{ !github.event.inputs.execute }}
```

### Protect Release Branches

```yaml
- name: Cleanup branches (protect releases)
  uses: ./.github/actions/branch-cleanup
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    days-old: 14
    protected-branches: 'main,master,develop,staging,production'
    exclude-pattern: '^release/.*$'  # Protect all release branches
```

## How It Works

1. **Fetches all branches** in the repository (except the default branch)
2. **Checks each branch** against protection rules:
   - Skips branches in the protected list
   - Skips branches matching the exclude pattern
3. **Gets the last commit date** for each remaining branch
4. **Compares the commit date** with the threshold (current date - days-old)
5. **Deletes branches** older than the threshold (or shows what would be deleted in dry-run mode)
6. **Outputs results** including lists of deleted and skipped branches

## Permissions Required

The action requires the following permissions:

```yaml
permissions:
  contents: write  # Required to delete branches
```

## Safety Features

- **Default Protection**: Automatically protects common branch names
- **Dry Run Mode**: Test the action without making changes
- **Detailed Logging**: See exactly what branches are being processed and why
- **Custom Exclusions**: Use regex patterns to protect specific branch naming conventions
- **Error Handling**: Gracefully handles API errors and continues processing other branches

## Best Practices

1. **Test First**: Always run with `dry-run: true` initially to see what would be deleted
2. **Schedule Wisely**: Run during low-traffic periods (weekends, off-hours)
3. **Monitor Results**: Check the action outputs and logs regularly
4. **Protect Important Branches**: Add any critical branches to the protected list
5. **Use Appropriate Thresholds**: 14-30 days is usually a good balance

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure the `GITHUB_TOKEN` has `contents: write` permission
2. **Branch Not Found**: The branch may have been deleted by another process
3. **API Rate Limits**: For repositories with many branches, the action may hit rate limits

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository settings.

## License

This action is available under the MIT License.