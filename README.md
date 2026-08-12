# Blooming Lotus Portal

Private source repository for the Blooming Lotus public website, appointment-request API, front-desk dashboard, and announcement manager.

## Repository structure

- `public-site/` — deployed public website and static assets
- `admin/` — deployed front-desk dashboard assets
- `infrastructure/` — exported CloudFormation templates
- `lambdas/` — deployed Lambda source packages
- `deployment/` — deployment guidance and scripts
- `docs/` — architecture, operations, and security notes

## Important

- Appointment and customer records are not stored in this repository.
- AWS credentials and Lambda environment variable values are not exported.
- The repository is private, but secrets must never be committed.
- The exported source reflects the deployed AWS environment as of 2026-08-12T01:27:59Z.

## AWS environment

- Region: `us-east-1`
- Public-site stack: `bloominglotus-demo`
- Front-desk stack: `bloominglotus-front-desk`
- Announcement stack: `bloominglotus-announcements`

See `docs/operations.md` before making or deploying changes.
