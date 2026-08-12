# Architecture overview

The application uses a private S3 website origin behind CloudFront, API Gateway HTTP APIs, Lambda, DynamoDB, Cognito for front-desk authentication, and an announcements service. The repository contains source and infrastructure definitions only; operational customer data remains in AWS data services.
