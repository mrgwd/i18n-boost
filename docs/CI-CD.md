# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the i18n-boost VS Code extension.

## Overview

The CI/CD pipeline is built using GitHub Actions and provides:

- **Automated Testing**: Runs tests on multiple Node.js versions
- **Automated Building**: Compiles TypeScript and packages the extension
- **Automated Publishing**: Publishes to VS Code Marketplace on releases
- **Security Auditing**: Checks for vulnerabilities in dependencies
- **Code Quality**: Linting and code quality checks

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

- **Test**: Runs tests on Node.js 18.x and 20.x
- **Build**: Compiles and packages the extension
- **Security**: Runs security audit on dependencies

### 2. Release Workflow (`.github/workflows/release.yml`)

**Triggers:**

- Push of version tags (e.g., `v1.0.0`)
- Manual workflow dispatch

**Jobs:**

- **Release**: Creates GitHub release with VSIX package
- **Publish Marketplace**: Publishes to VS Code Marketplace (on tag push)

### 3. Pull Request Workflow (`.github/workflows/pr.yml`)

**Triggers:**

- Pull request events (opened, synchronized, reopened)

**Features:**

- Code quality checks
- Build verification
- Automatic PR comments with build status

## Setup Instructions

### 1. GitHub Secrets

Configure the following secrets in your GitHub repository:

```bash
# VS Code Marketplace Personal Access Token
VSCE_PAT=your_vsce_personal_access_token
```

**To get VSCE_PAT:**

1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with your Microsoft account
3. Go to User Settings → Personal Access Tokens
4. Create a new token with "Marketplace" scope
5. Copy the token and add it as `VSCE_PAT` secret

### 2. Dependabot Configuration

Dependabot is configured to automatically update dependencies:

- **npm packages**: Weekly on Mondays
- **GitHub Actions**: Weekly on Mondays

### 3. Issue Templates

The repository includes templates for:

- Bug reports
- Feature requests
- Pull requests

## Usage

### Creating a Release

#### Option 1: Using Git Tags (Recommended)

```bash
# Update version in package.json
npm version patch  # or minor, major

# Push the tag
git push --follow-tags
```

#### Option 2: Manual Workflow Dispatch

1. Go to Actions tab in GitHub
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter version number (e.g., "1.0.0")
5. Click "Run workflow"

### Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Run tests with coverage
npm run test:coverage

# Package extension
npm run package
```

### Publishing Commands

```bash
# Patch version (1.0.0 -> 1.0.1)
npm run publish:patch

# Minor version (1.0.0 -> 1.1.0)
npm run publish:minor

# Major version (1.0.0 -> 2.0.0)
npm run publish:major
```

## Pipeline Stages

### 1. Code Quality Checks

- ESLint linting
- TypeScript compilation
- Security audit
- TODO/FIXME detection
- Console.log detection

### 2. Testing

- Unit tests on Node.js 18.x and 20.x
- Test coverage reporting
- Code coverage upload to Codecov

### 3. Building

- TypeScript compilation
- Extension packaging
- Artifact upload

### 4. Publishing

- GitHub release creation
- VSIX file upload
- VS Code Marketplace publishing

## Monitoring

### Build Status

- Check the Actions tab in GitHub for build status
- Green checkmarks indicate successful builds
- Red X marks indicate failed builds

### Release Status

- Monitor the Releases page for new releases
- Check VS Code Marketplace for published versions

### Security

- Dependabot will create PRs for dependency updates
- Security audit runs on every CI build
- Vulnerabilities are reported in the Actions logs

## Troubleshooting

### Common Issues

#### Build Failures

1. Check the Actions logs for specific error messages
2. Ensure all tests pass locally
3. Verify TypeScript compilation works

#### Publishing Failures

1. Verify `VSCE_PAT` secret is correctly set
2. Check if the version already exists in the marketplace
3. Ensure the extension is properly packaged

#### Test Failures

1. Run tests locally to reproduce issues
2. Check for environment-specific problems
3. Verify test dependencies are up to date

### Getting Help

1. Check the GitHub Issues for known problems
2. Review the Actions logs for detailed error information
3. Create a new issue if the problem persists

## Best Practices

### Code Quality

- Write tests for new features
- Follow the existing code style
- Remove console.log statements before committing
- Address TODO/FIXME comments

### Releases

- Use semantic versioning
- Update CHANGELOG.md for each release
- Test releases in a development environment first
- Use conventional commit messages

### Security

- Keep dependencies up to date
- Review security audit results
- Use Dependabot PRs to update dependencies
- Report security vulnerabilities responsibly
