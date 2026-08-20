# Appointment email delivery retry

The SES sandbox account is limited to one message per second. Business and customer messages are paced by 1.25 seconds and each send has a bounded retry for SES throttling. CloudWatch logs include both SES message IDs and boolean delivery-queue results.
