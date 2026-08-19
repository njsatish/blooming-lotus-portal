#!/bin/bash
set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
REGION="us-east-1"
EXPECTED_ACCOUNT="460425809139"

BUCKET="bloominglotus-dev-site-sitebucket-ytwbxlfuyqy0"
DISTRIBUTION_ID="E1ACA138BM2AKP"
DEV_URL="https://dev-bloominglotus.denduluru.com"

REPO_DIR="${REPO_DIR:-$HOME/Downloads/blooming-lotus-portal}"
SITE_DIR="$REPO_DIR/public-site"

echo "=== Deploy Blooming Lotus Development Website ==="

ACCOUNT=$(aws sts get-caller-identity \
  --profile "$PROFILE" \
  --query Account \
  --output text)

if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "ERROR: Wrong AWS account."
  echo "Expected: $EXPECTED_ACCOUNT"
  echo "Actual:   $ACCOUNT"
  exit 1
fi

if [ ! -f "$SITE_DIR/index.html" ]; then
  echo "ERROR: Development homepage not found:"
  echo "$SITE_DIR/index.html"
  exit 1
fi

echo "Profile/account verified: $PROFILE / $ACCOUNT"

echo "1/4 Uploading development website..."

aws s3 sync \
  "$SITE_DIR/" \
  "s3://$BUCKET/" \
  --profile "$PROFILE" \
  --region "$REGION" \
  --delete \
  --exclude ".DS_Store" \
  --exclude "index.html.before-*" \
  --exclude "*.backup" \
  --exclude "*.bak" \
  --exclude "*.backup" \
  --exclude "*.bak" \
  --cache-control "no-cache, no-store, must-revalidate"

echo "2/4 Invalidating development CloudFront..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --profile "$PROFILE" \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/" "/index.html" "/*" \
  --query "Invalidation.Id" \
  --output text)

echo "Invalidation: $INVALIDATION_ID"

echo "3/4 Waiting for invalidation..."

aws cloudfront wait invalidation-completed \
  --profile "$PROFILE" \
  --distribution-id "$DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"

echo "4/4 Testing development website..."

HTTP_CODE=$(curl -sS \
  -o /dev/null \
  -w "%{http_code}" \
  "$DEV_URL/?deploy=$(date +%s)")

if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Development website returned HTTP $HTTP_CODE"
  exit 1
fi

echo
echo "Development deployment completed successfully."
echo "URL: $DEV_URL"
echo "HTTP: $HTTP_CODE"
