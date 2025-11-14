const core = require('@actions/core');
const github = require('@actions/github');

class BranchCleanup {
  constructor() {
    this.token = core.getInput('github-token', { required: true });
    this.daysOld = parseInt(core.getInput('days-old') || '14');
    this.dryRun = core.getInput('dry-run') === 'true';
    this.protectedBranches = this.parseProtectedBranches(core.getInput('protected-branches') || 'main,master,develop,staging,production');
    this.excludePattern = core.getInput('exclude-pattern') || '';
    
    this.octokit = github.getOctokit(this.token);
    this.context = github.context;
    
    this.deletedBranches = [];
    this.skippedBranches = [];
  }

  parseProtectedBranches(input) {
    return input.split(',').map(branch => branch.trim()).filter(Boolean);
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[34m',    // Blue
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    
    const icons = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
  }

  isProtected(branchName) {
    return this.protectedBranches.includes(branchName);
  }

  matchesExcludePattern(branchName) {
    if (!this.excludePattern) return false;
    try {
      const regex = new RegExp(this.excludePattern);
      return regex.test(branchName);
    } catch (error) {
      this.log(`Invalid exclude pattern: ${this.excludePattern}`, 'error');
      return false;
    }
  }

  addSkippedBranch(branchName, reason) {
    this.skippedBranches.push({ branch: branchName, reason });
  }

  async getDefaultBranch() {
    try {
      const { data: repo } = await this.octokit.rest.repos.get({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo
      });
      return repo.default_branch;
    } catch (error) {
      throw new Error(`Failed to get default branch: ${error.message}`);
    }
  }

  async getAllBranches() {
    try {
      const branches = [];
      let page = 1;
      const perPage = 100;
      
      while (true) {
        const { data } = await this.octokit.rest.repos.listBranches({
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          per_page: perPage,
          page: page
        });
        
        if (data.length === 0) break;
        
        branches.push(...data);
        
        if (data.length < perPage) break;
        page++;
      }
      
      return branches;
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  async getBranchLastCommitDate(branchName) {
    try {
      const { data: branch } = await this.octokit.rest.repos.getBranch({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        branch: branchName
      });
      
      return new Date(branch.commit.commit.author.date);
    } catch (error) {
      throw new Error(`Failed to get last commit date for branch ${branchName}: ${error.message}`);
    }
  }

  async deleteBranch(branchName) {
    try {
      await this.octokit.rest.git.deleteRef({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        ref: `heads/${branchName}`
      });
      return true;
    } catch (error) {
      this.log(`Failed to delete branch ${branchName}: ${error.message}`, 'error');
      return false;
    }
  }

  getDaysAgo(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  formatDate(date) {
    return date.toISOString().split('T')[0] + ' ' + date.toTimeString().split(' ')[0];
  }

  async run() {
    try {
      this.log('🧹 Starting branch cleanup...', 'info');
      this.log(`Repository: ${this.context.repo.owner}/${this.context.repo.repo}`, 'info');
      this.log(`Days threshold: ${this.daysOld}`, 'info');
      this.log(`Dry run: ${this.dryRun}`, 'info');
      this.log(`Protected branches: ${this.protectedBranches.join(', ')}`, 'info');
      
      if (this.excludePattern) {
        this.log(`Exclude pattern: ${this.excludePattern}`, 'info');
      }
      
      // Get default branch
      const defaultBranch = await this.getDefaultBranch();
      this.log(`Default branch: ${defaultBranch}`, 'info');
      
      // Add default branch to protected list if not already there
      if (!this.protectedBranches.includes(defaultBranch)) {
        this.protectedBranches.push(defaultBranch);
      }
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.daysOld);
      this.log(`Cutoff date: ${this.formatDate(cutoffDate)}`, 'info');
      
      // Get all branches
      const allBranches = await this.getAllBranches();
      const branchesToProcess = allBranches.filter(branch => branch.name !== defaultBranch);
      
      if (branchesToProcess.length === 0) {
        this.log('No branches found (other than default branch)', 'warning');
        return;
      }
      
      this.log(`Found ${branchesToProcess.length} branches to analyze`, 'info');
      console.log('');
      
      // Process each branch
      for (const branch of branchesToProcess) {
        const branchName = branch.name;
        this.log(`Analyzing branch: ${branchName}`, 'info');
        
        // Check if branch is protected
        if (this.isProtected(branchName)) {
          this.log(`  ⏭️  Skipping protected branch`, 'warning');
          this.addSkippedBranch(branchName, 'protected');
          console.log('');
          continue;
        }
        
        // Check if branch matches exclude pattern
        if (this.matchesExcludePattern(branchName)) {
          this.log(`  ⏭️  Skipping branch (matches exclude pattern)`, 'warning');
          this.addSkippedBranch(branchName, 'matches_exclude_pattern');
          console.log('');
          continue;
        }
        
        try {
          // Get last commit date
          const lastCommitDate = await this.getBranchLastCommitDate(branchName);
          const daysOld = this.getDaysAgo(lastCommitDate);
          
          this.log(`  Last commit: ${this.formatDate(lastCommitDate)}`, 'info');
          
          // Check if branch is older than threshold
          if (lastCommitDate < cutoffDate) {
            this.log(`  🗑️  Branch is ${daysOld} days old (> ${this.daysOld} days)`, 'error');
            
            if (this.dryRun) {
              this.log(`  🔍 DRY RUN: Would delete branch`, 'warning');
              this.deletedBranches.push(branchName);
            } else {
              this.log(`  🗑️  Deleting branch...`, 'error');
              const deleted = await this.deleteBranch(branchName);
              
              if (deleted) {
                this.log(`  ✅ Successfully deleted branch`, 'success');
                this.deletedBranches.push(branchName);
              } else {
                this.addSkippedBranch(branchName, 'deletion_failed');
              }
            }
          } else {
            this.log(`  ✅ Branch is ${daysOld} days old (< ${this.daysOld} days) - keeping`, 'success');
            this.addSkippedBranch(branchName, 'too_recent');
          }
        } catch (error) {
          this.log(`  ❌ Error processing branch: ${error.message}`, 'error');
          this.addSkippedBranch(branchName, 'error_processing');
        }
        
        console.log('');
      }
      
      // Output summary
      this.log('📊 Summary:', 'info');
      console.log(`Deleted branches: ${this.deletedBranches.length}`);
      console.log(`Skipped branches: ${this.skippedBranches.length}`);
      
      if (this.deletedBranches.length > 0) {
        console.log('');
        this.log('🗑️  Deleted branches:', 'error');
        this.deletedBranches.forEach(branch => {
          console.log(`  - ${branch}`);
        });
      }
      
      if (this.skippedBranches.length > 0) {
        console.log('');
        this.log('⏭️  Skipped branches:', 'warning');
        this.skippedBranches.forEach(item => {
          console.log(`  - ${item.branch} (${item.reason})`);
        });
      }
      
      // Set GitHub Actions outputs
      core.setOutput('deleted-branches', JSON.stringify(this.deletedBranches));
      core.setOutput('skipped-branches', JSON.stringify(this.skippedBranches));
      
      console.log('');
      if (this.dryRun) {
        this.log('🔍 Dry run completed. No branches were actually deleted.', 'warning');
      } else {
        this.log('🧹 Branch cleanup completed successfully!', 'success');
      }
      
    } catch (error) {
      core.setFailed(`Branch cleanup failed: ${error.message}`);
    }
  }
}

// Run the action
const cleanup = new BranchCleanup();
cleanup.run();