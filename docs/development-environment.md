# Blooming Lotus Development Environment

## Development website

https://dev-bloominglotus.denduluru.com

## AWS resources

- AWS application account: `460425809139`
- CloudFormation stack: `bloominglotus-dev-site`
- S3 bucket: `bloominglotus-dev-site-sitebucket-ytwbxlfuyqy0`
- CloudFront distribution: `E1ACA138BM2AKP`
- CloudFront domain: `dml2ubu35k3jr.cloudfront.net`
- Route 53 hosted zone: `Z21S238SFANDPM`

## Deploy to development

```bash
cd ~/Downloads/blooming-lotus-portal

./scripts/deploy-dev-site.sh
```

The deployment script uploads the files under `public-site/` to the development S3 bucket, invalidates the development CloudFront distribution, waits for completion, and verifies the development website.

## Branch model

- `main` represents production-approved code.
- `develop` represents the development website.
- `feature/*` branches contain individual changes being tested.
- `backup/*` branches are recovery snapshots.
- `fix/*` branches contain infrastructure or defect corrections.

## Safe development workflow

1. Switch to the `develop` branch.
2. Pull the latest changes from `origin/develop`.
3. Create a feature branch.
4. Modify the required files under `public-site/`.
5. Deploy using `scripts/deploy-dev-site.sh`.
6. Test at the development URL.
7. Use only synthetic customer information.
8. Commit and push after successful testing.
9. Merge the tested feature into `develop`.
10. Promote the tested revision to `main` only after approval.

## Current limitation

The development frontend currently uses the API URLs embedded in the website source.

The APIs permit the development origin through CORS, but test appointment requests may still reach shared backend resources.

Use only synthetic customer information until separate development API Gateway, Lambda, DynamoDB, Cognito, and notification resources are created.
