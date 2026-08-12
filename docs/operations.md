# Operations

## Data handling

Never commit DynamoDB exports, customer contact information, appointment notes, AWS credentials, session tokens, or production backups.

## Change process

1. Create a feature branch.
2. Make and review source changes.
3. Test locally in a non-production environment.
4. Review infrastructure changes with a CloudFormation change set.
5. Back up the deployed public and admin files.
6. Deploy through a reviewed script or CI/CD pipeline.
7. Verify public booking, front-desk authentication, announcements, and printing.
8. Merge only after verification.

## Rollback

Retain an immutable copy of the last approved release and use versioned release tags. Avoid applying sequential production-only patch scripts without updating the canonical source in this repository.
