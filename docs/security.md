# Security notes

- The public website must not expose AWS credentials or private API tokens.
- Front-desk routes require Cognito authentication and authorization.
- Customer data must remain in approved AWS data stores, not Git.
- Use individual staff accounts rather than shared passwords in production.
- Review IAM permissions for least privilege.
- Keep email and SMS consent, opt-out, and delivery records outside this repository.
- Enable branch protection and secret scanning where available.
