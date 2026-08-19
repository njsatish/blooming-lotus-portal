# Business appointment notification email

After a reservation succeeds, the appointment Lambda sends an HTML business notification to `njsatish@gmail.com` while preserving the existing SNS notification.

Subject:

`🌸 Blooming Lotus — New Appointment Request — {appointmentId} 🌸`

The message contains appointment details, customer contact details, notes, status, and recommended confirmation steps.
