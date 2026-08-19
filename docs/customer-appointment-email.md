# Customer appointment request acknowledgement

After a slot reservation succeeds, the appointment Lambda sends an HTML and plain-text acknowledgement.

Subject: `🌸 Blooming Lotus — Appointment Request Received — {appointmentId} 🌸`

While Amazon SES remains in sandbox mode, the acknowledgement is sent only when the submitted requestor email is the verified address `njsatish@gmail.com`. The business SNS notification remains separate.
