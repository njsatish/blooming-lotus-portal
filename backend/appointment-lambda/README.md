# Blooming Lotus Appointment Lambda

This source mirrors the deployed `bloominglotus-demo-AppointmentFunction-crDFoiEWd8xc` Lambda.

Availability uses both:

- active appointment records, and
- persisted `BloomingLotusSlotReservations` lock records.

This keeps `GET /availability` consistent with the transactional lock conditions used by `POST /appointments`.
