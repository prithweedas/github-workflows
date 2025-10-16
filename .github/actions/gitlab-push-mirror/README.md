# GitLab Push Mirror Action

A reusable GitHub Action that mirrors your GitHub repository to a GitLab repository. This action pushes all branches and tags to the specified GitLab repository.

## Features

- 🔄 Mirrors all branches from GitHub to GitLab
- 🏷️ Mirrors all tags from GitHub to GitLab
- 🌐 Supports custom GitLab instances (not just gitlab.com)
- 🔒 Secure token-based authentication
- 📦 Lightweight composite action

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `gitlab-org` | GitLab organization or username | ✅ Yes | - |
| `gitlab-repo` | GitLab repository name | ✅ Yes | - |
| `gitlab-token` | GitLab personal access token with repository permissions | ✅ Yes | - |
| `gitlab-url` | GitLab instance URL | ❌ No | `https://gitlab.com` |
| `github-token` | GitHub token for accessing private repositories | ❌ No | `${{ github.token }}` |

## Prerequisites

### GitLab Personal Access Token

You need a GitLab Personal Access Token with the following scopes:
- `write_repository` - To push code to the repository
- `read_repository` - To read repository information

To create a token:
1. Go to GitLab → Settings → Access Tokens
2. Create a new token with `write_repository` and `read_repository` scopes
3. Store it as a GitHub secret (e.g., `GITLAB_TOKEN`)

### GitHub Token (for Private Repositories)

For private repositories, the action uses `${{ github.token }}` by default, which provides read access to the current repository. This is automatically available in GitHub Actions and doesn't require additional setup.

For public repositories, the GitHub token is optional but recommended for consistency.

### GitLab Repository

The target GitLab repository should exist before running this action. You can create it manually or use GitLab's API.

## Usage

### Basic Usage (GitLab.com)

```yaml
name: Mirror to GitLab

on:
  push:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - name: Mirror to GitLab
        uses: ./.github/actions/gitlab-push-mirror
        with:
          gitlab-org: 'my-gitlab-org'
          gitlab-repo: 'my-repo'
          gitlab-token: ${{ secrets.GITLAB_TOKEN }}
          # github-token is automatically set to ${{ github.token }}
```

### Private Repository

For private repositories, the action automatically uses `${{ github.token }}` which has read access to the current repository:

```yaml
- name: Mirror private repo to GitLab
  uses: ./.github/actions/gitlab-push-mirror
  with:
    gitlab-org: 'my-gitlab-org'
    gitlab-repo: 'my-private-repo'
    gitlab-token: ${{ secrets.GITLAB_TOKEN }}
    # No need to specify github-token, it's automatic
```

### Custom GitLab Instance

```yaml
- name: Mirror to self-hosted GitLab
  uses: ./.github/actions/gitlab-push-mirror
  with:
    gitlab-org: 'my-org'
    gitlab-repo: 'my-repo'
    gitlab-token: ${{ secrets.GITLAB_TOKEN }}
    gitlab-url: 'https://gitlab.mycompany.com'
```

### Complete Workflow Example

```yaml
name: GitLab Mirror

on:
  push:
  pull_request:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  mirror-to-gitlab:
    name: Mirror Repository to GitLab
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Mirror to GitLab
        uses: ./.github/actions/gitlab-push-mirror
        with:
          gitlab-org: ${{ vars.GITLAB_ORG }}
          gitlab-repo: ${{ github.event.repository.name }}
          gitlab-token: ${{ secrets.GITLAB_TOKEN }}
```

## Workflow Triggers

### Recommended Triggers

1. **On Push** - Mirror immediately when changes are pushed
2. **Scheduled** - Regular synchronization (e.g., daily)
3. **Manual** - Allow manual triggering via workflow_dispatch

```yaml
on:
  push:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:
```

## Security Considerations

1. **Token Storage**: Always store GitLab tokens as GitHub secrets, never in code
2. **Token Permissions**: Use tokens with minimal required permissions
3. **Repository Access**: Ensure the token has access only to the intended repositories

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify the GitLab token has correct permissions
   - Check if the token is expired
   - Ensure the token has access to the target repository

2. **Repository Not Found**
   - Verify the GitLab organization and repository name are correct
   - Ensure the repository exists on GitLab
   - Check if the token has access to the repository

3. **Push Rejected**
   - The GitLab repository might have protected branches
   - Check GitLab's push rules and branch protection settings

### Debug Mode

To enable debug logging, add this to your workflow:

```yaml
env:
  ACTIONS_STEP_DEBUG: true
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This action is available under the MIT License.