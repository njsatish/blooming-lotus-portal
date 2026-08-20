# Closure availability response

Availability requests for a published closure return HTTP 200 with `closed: true`, an empty slot list, and the closure message/range. Appointment POST conflicts remain HTTP 409. This avoids expected closure selections appearing as browser console errors while preserving explicit closure handling.
