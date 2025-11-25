# AWS Glue Crawler

A GitHub Action to run AWS Glue crawlers. Automatically discover and catalog data in your S3 data lake.

## Features

- **Run crawlers** - Trigger AWS Glue crawlers from your GitHub workflows
- **Wait for completion** - Optionally wait for crawler to finish and report results
- **Timeout control** - Configure maximum wait time for long-running crawlers
- **Cross-account support** - Works with cross-account Glue catalogs
- **Detailed metrics** - Reports tables created, updated, and deleted

## Prerequisites

Configure AWS credentials before using this action. We recommend `aws-actions/configure-aws-credentials@v4`:

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/my-github-actions-role
    aws-region: us-east-1
```

## Usage

### Run Crawler and Wait

Run a crawler and wait for it to complete:

```yaml
- name: Run Glue crawler
  id: crawler
  uses: predictr-io/aws-glue-crawler@v0
  with:
    crawler-name: 'my-data-crawler'
    wait-for-completion: 'true'
    timeout-minutes: 60

- name: Check results
  run: |
    echo "Crawler state: ${{ steps.crawler.outputs.state }}"
    echo "Tables created: ${{ steps.crawler.outputs.tables-created }}"
    echo "Tables updated: ${{ steps.crawler.outputs.tables-updated }}"
```

### Run Crawler Without Waiting

Start a crawler and continue immediately:

```yaml
- name: Start Glue crawler
  uses: predictr-io/aws-glue-crawler@v0
  with:
    crawler-name: 'my-data-crawler'
    wait-for-completion: 'false'
```

### Complete Pipeline Example

Ingest data to S3, then run crawler to update catalog:

```yaml
name: Daily Data Pipeline

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1

      - name: Download data to S3
        uses: predictr-io/url-to-s3@v1
        with:
          url: 'https://api.example.com/daily-export'
          s3-bucket: 'data-lake'
          s3-key: 'raw/events/${{ env.DATE }}/data.json'

      - name: Run crawler to discover new data
        id: crawler
        uses: predictr-io/aws-glue-crawler@v1
        with:
          crawler-name: 'events-crawler'
          wait-for-completion: 'true'
          timeout-minutes: 30

      - name: Verify catalog updates
        run: |
          echo "Crawler completed: ${{ steps.crawler.outputs.success }}"
          echo "Tables updated: ${{ steps.crawler.outputs.tables-updated }}"
```

## Inputs

### Required Inputs

| Input | Description |
|-------|-------------|
| `crawler-name` | Name of the AWS Glue crawler to run |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `wait-for-completion` | Wait for crawler to complete before finishing action | `true` |
| `timeout-minutes` | Maximum time to wait for crawler completion (minutes) | `60` |
| `catalog-id` | AWS account ID for cross-account catalog access | Current account |

## Outputs

| Output | Description |
|--------|-------------|
| `state` | Final state of the crawler (e.g., `READY`, `RUNNING`, `STOPPING`) |
| `tables-created` | Number of tables created by the crawler run |
| `tables-updated` | Number of tables updated by the crawler run |
| `tables-deleted` | Number of tables deleted by the crawler run |

**Note**: The action fails the step if the crawler cannot be started or encounters an error. Check the step status instead of using a success output.

## Cross-Account Access

Run crawlers in different AWS accounts:

```yaml
- name: Run cross-account crawler
  uses: predictr-io/aws-glue-crawler@v0
  with:
    crawler-name: 'shared-data-crawler'
    catalog-id: '987654321098'
```

Ensure your IAM role has the necessary cross-account permissions.

## Error Handling

The action handles common scenarios gracefully:

- **Crawler already running**: Waits for current run to complete
- **Crawler timeout**: Fails with timeout error after specified minutes
- **Crawler not found**: Fails with clear error message
- **AWS permission errors**: Fails with AWS SDK error message

## Development

### Setup

Clone and install dependencies:

```bash
git clone https://github.com/predictr-io/aws-glue-crawler.git
cd aws-glue-crawler
npm install
```

### Development Scripts

```bash
# Build the action (compile TypeScript + bundle with dependencies)
npm run build

# Run TypeScript type checking
npm run type-check

# Run ESLint
npm run lint

# Run all checks (type-check + lint)
npm run check
```

### Build Process

The build process uses `@vercel/ncc` to compile TypeScript and bundle all dependencies into a single `dist/index.js` file:

```bash
npm run build
```

**Output:**
- `dist/index.js` - Bundled action (includes AWS SDK)
- `dist/index.js.map` - Source map for debugging
- `dist/licenses.txt` - License information for bundled dependencies

**Important:** The `dist/` directory **must be committed** to git. GitHub Actions runs the compiled code directly from the repository.

### Making Changes

1. **Edit source files** in `src/`
2. **Run checks** to validate:
   ```bash
   npm run check
   ```
3. **Build** to update `dist/`:
   ```bash
   npm run build
   ```
4. **Test locally** (optional) - Use [act](https://github.com/nektos/act) or create a test workflow
5. **Commit everything** including `dist/`:
   ```bash
   git add src/ dist/
   git commit -m "Description of changes"
   ```

### Release Process

Follow these steps to create a new release:

#### 1. Make and Test Changes

```bash
# Make your changes to src/
# Run checks
npm run check

# Build
npm run build

# Commit source and dist/
git add .
git commit -m "Add new feature"
git push origin main
```

#### 2. Create Version Tag

```bash
# Create annotated tag (use semantic versioning)
git tag -a v0.2.0 -m "Release v0.2.0: Description of changes"

# Push tag to trigger release workflow
git push origin v0.2.0
```

#### 3. Automated Release

GitHub Actions automatically:
- ✓ Verifies `dist/` is committed
- ✓ Verifies `dist/` is up-to-date with source
- ✓ Creates GitHub Release with auto-generated notes
- ✓ Updates major version tag (e.g., `v0` → `v0.2.0`)

#### 4. Version References

Users can reference the action:
- **Recommended:** `predictr-io/aws-glue-crawler@v0` (floating major version, gets updates)
- **Pinned:** `predictr-io/aws-glue-crawler@v0.2.0` (specific version, never changes)

### Troubleshooting

**Release workflow fails with "dist/ is out of date":**
```bash
npm run build
git add dist/
git commit -m "Update dist/ for release"
git tag -f v0.2.0  # Re-tag
git push -f origin v0.2.0
```

**ESLint errors:**
```bash
npm run lint  # See errors
# Fix issues, then:
npm run check  # Verify all checks pass
```

**TypeScript errors:**
```bash
npm run type-check  # See type errors
```

## License

MIT

## Contributing

Contributions welcome! Please submit a Pull Request.
