# Business appointment notification routing

For each successful appointment request:

- Customer acknowledgement: Amazon SES HTML + plain-text alternative.
- Business notification: Amazon SES HTML + plain-text alternative.
- Legacy SNS business notification: disabled to prevent a duplicate plain email.

The existing SNS topic and subscription are retained for rollback, but the appointment Lambda no longer publishes new appointment messages to it.
