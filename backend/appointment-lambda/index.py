import json
import html
import os
import time
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import boto3
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError


table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
announcements_table = boto3.resource("dynamodb").Table(os.environ["ANNOUNCEMENTS_TABLE"])
sns = boto3.client("sns")
ses = boto3.client("ses")
notification_topic_arn = os.environ["NOTIFICATION_TOPIC_ARN"]
retention_days = int(os.environ.get("RETENTION_DAYS", "90"))
reservation_table_name = os.environ["RESERVATION_TABLE"]
reservation_table = boto3.resource("dynamodb").Table(reservation_table_name)
therapist_table = boto3.resource("dynamodb").Table(os.environ["THERAPIST_TABLE"])
exception_table = boto3.resource("dynamodb").Table(os.environ["SCHEDULE_EXCEPTION_TABLE"])
dynamodb_client = boto3.client("dynamodb")
serializer = TypeSerializer()
ACTIVE_STATUSES = {"REQUESTED", "CONTACTED", "CONFIRMED", "RESCHEDULE_NEEDED"}

DEFAULT_THERAPISTS = ["Jack", "Rose", "Mike"]
# BEGIN BLOOMING_LOTUS_SES_SANDBOX_V21_16
EMAIL_FROM = os.environ.get('EMAIL_FROM', 'thenuthulapatis@gmail.com')
REPLY_TO = os.environ.get('REPLY_TO', EMAIL_FROM)
BUSINESS_EMAIL = os.environ.get('BUSINESS_EMAIL', 'thenuthulapatis@gmail.com')
DEMO_CUSTOMER_RECIPIENT = os.environ.get('DEMO_CUSTOMER_RECIPIENT', 'thenuthulapatis@gmail.com')
SES_SANDBOX_MODE = os.environ.get('SES_SANDBOX_MODE', 'true').lower() == 'true'
# END BLOOMING_LOTUS_SES_SANDBOX_V21_16


def therapist_records():
    records = scan_all(therapist_table, ConsistentRead=True)
    return [r for r in records if r.get("status", "ACTIVE") == "ACTIVE"]

def therapist_names(service=None):
    names=[]
    for record in therapist_records():
        services=record.get("services") or []
        if service and services and service not in services:
            continue
        names.append(record.get("displayName") or record.get("therapistId"))
    return [n for n in names if n] or DEFAULT_THERAPISTS

def schedule_exceptions(date):
    return [x for x in scan_all(exception_table, ConsistentRead=True) if x.get("status", "ACTIVE") == "ACTIVE" and x.get("startDate", "") <= date <= x.get("endDate", "")]

def exception_overlaps(item, therapist, date, start, end):
    if item.get("therapistId") != therapist or not (item.get("startDate", "") <= date <= item.get("endDate", "")):
        return False
    if item.get("allDay", False):
        return True
    ex_start=time_to_minutes(item.get("startTime"))
    ex_end=time_to_minutes(item.get("endTime"))
    return ex_start is not None and ex_end is not None and ex_start < end and ex_end > start
allowed_services = {
    "Deep Tissue Massage",
    "Hot Stone Massage",
    "Relaxing / Full Body Massage",
    "Couples Massage",
    "Foot Massage / Reflexology",
    "Acupressure / Cupping",
    "Other / Ask front desk",
}


def clean(value, limit=250):
    if value is None:
        return ""
    return str(value).strip()[:limit]


def response(status, payload):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "Access-Control-Allow-Origin": "https://bloominglotus.denduluru.com",
        },
        "body": json.dumps(payload),
    }


def request_method(event):
    return str(
        event.get("requestContext", {}).get("http", {}).get(
            "method", event.get("httpMethod", "")
        )
    ).upper()


def generate_slots():
    slots = []
    hour = 10
    minute = 0
    while hour < 20:
        slots.append(f"{hour:02d}:{minute:02d}")
        minute += 15
        if minute >= 60:
            minute = 0
            hour += 1
    return slots


def scan_all(table_object, **kwargs):
    items = []
    while True:
        page = table_object.scan(**kwargs)
        items.extend(page.get("Items", []))
        last_key = page.get("LastEvaluatedKey")
        if not last_key:
            return items
        kwargs["ExclusiveStartKey"] = last_key


def parse_duration_minutes(value, default=60):
    text = str(value or "").strip().lower()
    digits = "".join(character for character in text if character.isdigit())
    if not digits:
        return default
    minutes = int(digits)
    return minutes if minutes in (15, 30, 45, 60, 75, 90, 105, 120) else default


def time_to_minutes(value):
    try:
        hour_text, minute_text = str(value).split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            return None
        return hour * 60 + minute
    except (TypeError, ValueError):
        return None


def appointment_window(item):
    status = item.get("status")
    if status not in ACTIVE_STATUSES or not item.get("therapist"):
        return None
    if status == "CONFIRMED":
        date = item.get("confirmedDate") or item.get("preferredDate")
        start_value = item.get("confirmedTime") or item.get("preferredTime")
    elif status == "RESCHEDULE_NEEDED":
        date = item.get("proposedDate")
        start_value = item.get("proposedTime")
    else:
        date = item.get("preferredDate") or item.get("confirmedDate")
        start_value = item.get("preferredTime") or item.get("confirmedTime")
    start = time_to_minutes(start_value)
    if not date or start is None:
        return None
    duration = parse_duration_minutes(item.get("durationMinutes") or item.get("sessionLength"), default=60)
    return {"date": date, "therapist": item.get("therapist"), "start": start, "end": start + duration}


def active_appointments(date):
    result = []
    for item in scan_all(table, ConsistentRead=True):
        window = appointment_window(item)
        if window and window["date"] == date:
            result.append(window)
    return result

def reservation_lock_ids_for_date(date):
    """Return every persisted reservation lock for the requested date.

    The appointment POST transaction uses attribute_not_exists(lockId), so any
    persisted lock can reject a request. Availability must use the same source
    of truth or it can advertise a slot that POST will reject.
    """
    locks = set()
    for item in scan_all(reservation_table, ConsistentRead=True):
        lock_id = str(item.get("lockId") or "")
        lock_date = str(item.get("date") or "")
        if lock_date == date or lock_id.startswith(f"{date}#"):
            locks.add(lock_id)
    return locks

def interval_has_reservation_lock(lock_ids, date, therapist, start, end):
    return any(
        f"{date}#{therapist}#{minute:04d}" in lock_ids
        for minute in range(start, end, 15)
    )


def build_availability(date, requested_duration=60, service=None):
    appointments = active_appointments(date)
    reservation_locks = reservation_lock_ids_for_date(date)
    exceptions = schedule_exceptions(date)
    active_names = therapist_names(service)
    slots = []
    closing_minutes = 20 * 60
    for slot in generate_slots():
        requested_start = time_to_minutes(slot)
        requested_end = requested_start + requested_duration
        if requested_end > closing_minutes:
            continue
        busy = {a["therapist"] for a in appointments if a["start"] < requested_end and a["end"] > requested_start}
        available = [
            name for name in active_names
            if name not in busy
            and not interval_has_reservation_lock(
                reservation_locks, date, name, requested_start, requested_end
            )
            and not any(
                exception_overlaps(x, name, date, requested_start, requested_end)
                for x in exceptions
            )
        ]
        slots.append({"time": slot, "durationMinutes": requested_duration, "availableTherapists": len(available), "therapists": available, "fullyBooked": len(available) == 0})
    return slots


def send_ses_with_retry(message_kwargs, label):
    for attempt in range(3):
        try:
            result = ses.send_email(**message_kwargs)
            message_id = result.get("MessageId")
            print(f"{label} email queued successfully: {message_id}")
            return True, message_id
        except Exception as exc:
            code = getattr(exc, "response", {}).get("Error", {}).get("Code", "")
            retryable = code in {"Throttling", "ThrottlingException", "TooManyRequestsException"} or "rate" in str(exc).lower()
            print(f"{label} email attempt {attempt + 1} failed: {repr(exc)}")
            if not retryable or attempt == 2:
                return False, str(exc)
            time.sleep(1.25 * (attempt + 1))
    return False, "Email retry exhausted."

def customer_acknowledgement_subject(appointment_id):
    flower = "\U0001F338"
    return f"{flower} Blooming Lotus — Appointment Request Received — {appointment_id} {flower}"

def customer_acknowledgement_text(item):
    return ("Blooming Lotus appointment request received\n\n"
        + "Thank you, " + str(item.get("customerName") or "") + ".\n\n"
        + "Request number: " + str(item.get("appointmentId") or "") + "\n"
        + "Service: " + str(item.get("service") or "") + "\n"
        + "Date: " + str(item.get("preferredDate") or "") + "\n"
        + "Time: " + str(item.get("preferredTime") or "") + "\n"
        + "Session length: " + str(item.get("sessionLength") or "") + "\n"
        + "Massage Therapist: " + str(item.get("therapist") or "") + "\n\n"
        + "Pending confirmation — this is not yet a confirmed appointment.\n"
        + "The Blooming Lotus front desk will review the request and contact you.\n")

def customer_acknowledgement_html(item):
    esc=lambda value: html.escape(str(value or ""))
    rows=[("Request number",item.get("appointmentId")),("Service",item.get("service")),("Date",item.get("preferredDate")),("Time",item.get("preferredTime")),("Session length",item.get("sessionLength")),("Massage Therapist",item.get("therapist")),("Phone",item.get("phone")),("Email",item.get("email")),("Notes",item.get("notes"))]
    details="".join("<tr><td style='padding:12px;color:#806b75;font-weight:bold'>"+esc(label)+"</td><td style='padding:12px;color:#49333d'>"+esc(value)+"</td></tr>" for label,value in rows if value)
    return ("<!doctype html><html><body style='margin:0;background:#f4eef1;font-family:Arial,sans-serif'>"
      "<div style='max-width:680px;margin:24px auto;background:#fff;border-radius:22px;overflow:hidden'>"
      "<div style='padding:30px;text-align:center;background:#fff1f6'><div style='font-size:42px'>&#127800;</div>"
      "<h1 style='color:#581638;font-family:Georgia,serif'>Blooming Lotus</h1></div><div style='height:7px;background:#bd3c71'></div>"
      "<div style='padding:34px'><h2 style='color:#581638'>Thank you, "+esc(item.get("customerName"))+".</h2>"
      "<p>Blooming Lotus received the appointment request below.</p>"
      "<div style='padding:15px;background:#f1f9eb;color:#3d6830;font-weight:bold'>Pending confirmation — this is not yet a confirmed appointment.</div>"
      "<table style='width:100%;margin-top:20px;border-collapse:collapse'>"+details+"</table>"
      "<p style='padding:17px;border-left:5px solid #bd3c71;background:#fff1f6'><strong>What happens next?</strong><br>The front desk will review availability and contact you to confirm the appointment or suggest another time.</p>"
      "<p>Blooming Lotus Oriental Massage<br>540-725-8888<br><a href='https://bloominglotus.denduluru.com' style='color:#bd3c71'>bloominglotus.denduluru.com</a></p>"
      "</div></div></body></html>")

def send_customer_acknowledgement(item):
    intended_destination = str(item.get('email') or '').strip().lower()
    if not intended_destination:
        return False, 'Customer email was not provided.'
    destination = DEMO_CUSTOMER_RECIPIENT if SES_SANDBOX_MODE else intended_destination
    text_body = customer_acknowledgement_text(item)
    html_body = customer_acknowledgement_html(item)
    if SES_SANDBOX_MODE:
        notice = 'SES sandbox demo: delivered to the verified test inbox. Intended customer email: ' + intended_destination
        text_body = notice + '\n\n' + text_body
        banner = "<div style='padding:14px;background:#fff3cd;color:#6b592f;font-weight:bold'>" + html.escape(notice) + "</div>"
        html_body = html_body.replace("<div style='max-width:680px", banner + "<div style='max-width:680px", 1)
    try:
        return send_ses_with_retry(dict(Source=EMAIL_FROM,Destination={'ToAddresses':[destination]},ReplyToAddresses=[REPLY_TO],Message={'Subject':{'Data':customer_acknowledgement_subject(item['appointmentId']),'Charset':'UTF-8'},'Body':{'Text':{'Data':text_body,'Charset':'UTF-8'},'Html':{'Data':html_body,'Charset':'UTF-8'}}}), 'Customer')
    except Exception as exc:
        print('Customer acknowledgement email failed:',repr(exc)); return False,str(exc)

def business_notification_subject(appointment_id):
    flower = "\U0001F338"
    return f"{flower} Blooming Lotus — New Appointment Request — {appointment_id} {flower}"

def business_notification_text(item):
    return (
        "New Blooming Lotus appointment request\n\n"
        + "Request number: " + str(item.get("appointmentId") or "") + "\n"
        + "Status: Requested / Pending confirmation\n"
        + "Customer: " + str(item.get("customerName") or "") + "\n"
        + "Phone: " + str(item.get("phone") or "") + "\n"
        + "Email: " + str(item.get("email") or "") + "\n"
        + "Service: " + str(item.get("service") or "") + "\n"
        + "Date: " + str(item.get("preferredDate") or "") + "\n"
        + "Time: " + str(item.get("preferredTime") or "") + "\n"
        + "Session length: " + str(item.get("sessionLength") or "") + "\n"
        + "Assigned therapist: " + str(item.get("therapist") or "") + "\n"
        + "Notes: " + str(item.get("notes") or "") + "\n\n"
        + "Action required: review and confirm this request.\n"
    )

def business_notification_html(item):
    esc = lambda value: html.escape(str(value or ""))
    rows = [
        ("Request number", item.get("appointmentId")),
        ("Status", "Requested / Pending confirmation"),
        ("Service", item.get("service")),
        ("Date", item.get("preferredDate")),
        ("Time", item.get("preferredTime")),
        ("Session length", item.get("sessionLength")),
        ("Assigned therapist", item.get("therapist")),
        ("Customer name", item.get("customerName")),
        ("Phone", item.get("phone")),
        ("Email", item.get("email")),
        ("Notes", item.get("notes")),
        ("Submitted", item.get("createdAt")),
    ]
    details = "".join(
        "<tr><td style='padding:12px 16px;color:#806b75;font-weight:bold;border-top:1px solid #efe2e8'>" + esc(label) + "</td>"
        "<td style='padding:12px 16px;color:#49333d;border-top:1px solid #efe2e8'>" + esc(value) + "</td></tr>"
        for label, value in rows if value
    )
    flower = "&#127800;"
    return (
        "<!doctype html><html><body style='margin:0;background:#f3edf0;font-family:Arial,sans-serif;color:#49333d'>"
        "<div style='display:none;max-height:0;overflow:hidden'>New appointment request requiring review and confirmation.</div>"
        "<div style='max-width:720px;margin:24px auto;background:#fff;border:1px solid #e6d4dc;border-radius:22px;overflow:hidden'>"
        "<div style='padding:28px 34px;background:#581638;color:#fff'>"
        "<table role='presentation' style='width:100%'><tr><td style='font-size:40px'>" + flower + "</td>"
        "<td><h1 style='margin:0;font-family:Georgia,serif;font-size:28px'>Blooming Lotus</h1>"
        "<div style='color:#e8cbd8;font-size:12px;letter-spacing:2px'>BUSINESS APPOINTMENT NOTIFICATION</div></td>"
        "<td style='text-align:right'><span style='padding:8px 12px;border-radius:999px;background:#bd3c71;font-size:11px;font-weight:bold'>ACTION REQUIRED</span></td></tr></table></div>"
        "<div style='height:7px;background:#bd3c71'></div>"
        "<div style='padding:34px'><div style='color:#bd3c71;font-weight:bold;font-size:12px;letter-spacing:2px'>NEW APPOINTMENT REQUEST</div>"
        "<h2 style='margin:8px 0 12px;color:#581638;font-family:Georgia,serif;font-size:30px'>Review and confirm this request</h2>"
        "<p style='line-height:1.6'>A customer submitted a new appointment request. The requested therapist and time are being held pending confirmation.</p>"
        "<div style='margin:20px 0;padding:15px;background:#fff1f6;color:#8f2555;font-weight:bold;border:1px solid #eed0dd'>Requested / Pending confirmation</div>"
        "<table role='presentation' style='width:100%;border-collapse:collapse;border:1px solid #ead9e1'>" + details + "</table>"
        "<div style='margin-top:22px;padding:18px;border:1px solid #d8e7c8;background:#f3f9ed;color:#426c35;line-height:1.6'>"
        "<strong>Recommended next steps</strong><ol style='margin-bottom:0'><li>Review the request in the admin dashboard.</li><li>Confirm the therapist and requested time.</li><li>Contact the customer if another time is needed.</li><li>Update the request status.</li></ol></div>"
        "<div style='text-align:center;margin-top:26px'><a href='https://bloominglotus.denduluru.com/admin' style='display:inline-block;padding:14px 24px;border-radius:999px;background:#bd3c71;color:#fff;text-decoration:none;font-weight:bold'>Open Admin Dashboard</a></div>"
        "<div style='margin-top:22px;padding:15px;border-left:5px solid #d2a13b;background:#fff8e8;color:#6b592f'>The customer has received an acknowledgement stating that the appointment is not confirmed yet.</div>"
        "</div><div style='padding:22px;text-align:center;background:#f7f0f3;color:#816e77;font-size:12px'>Blooming Lotus Oriental Massage · Roanoke, Virginia</div>"
        "</div></body></html>"
    )

def send_business_html_notification(item):
    business_email = BUSINESS_EMAIL
    try:
        return send_ses_with_retry(dict(
            Source=EMAIL_FROM,
            Destination={"ToAddresses": [business_email]},
            ReplyToAddresses=[REPLY_TO],
            Message={
                "Subject": {"Data": business_notification_subject(item["appointmentId"]), "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": business_notification_text(item), "Charset": "UTF-8"},
                    "Html": {"Data": business_notification_html(item), "Charset": "UTF-8"},
                },
            },
        ), "Business")
    except Exception as exc:
        print("Business HTML email failed:", repr(exc))
        return False, str(exc)

def serialize_item(item):
    return {key: serializer.serialize(value) for key, value in item.items()}


def reservation_lock_ids(date, therapist, start_minutes, duration):
    return [f"{date}#{therapist}#{minute:04d}" for minute in range(start_minutes, start_minutes + duration, 15)]


def reserve_and_create(item, date, start_time, duration, candidates):
    start_minutes = time_to_minutes(start_time)
    if start_minutes is None or start_minutes % 15 != 0:
        return None, "Appointment time must use a 15-minute interval."
    if start_minutes < 600 or start_minutes + duration > 1200:
        return None, "The selected appointment must fit between 10:00 AM and 8:00 PM."
    for therapist_name in candidates:
        locks = reservation_lock_ids(date, therapist_name, start_minutes, duration)
        transaction=[]
        for lock_id in locks:
            lock={"lockId":lock_id,"appointmentId":item["appointmentId"],"date":date,"therapist":therapist_name,"startTime":start_time,"durationMinutes":duration,"holdType":"REQUESTED","expiresAt":int(time.time())+retention_days*86400}
            transaction.append({"Put":{"TableName":reservation_table_name,"Item":serialize_item(lock),"ConditionExpression":"attribute_not_exists(lockId)"}})
        saved=dict(item);saved.update({"therapist":therapist_name,"durationMinutes":duration,"startTime":start_time})
        transaction.append({"Put":{"TableName":table.name,"Item":serialize_item(saved),"ConditionExpression":"attribute_not_exists(appointmentId)"}})
        try:
            dynamodb_client.transact_write_items(TransactItems=transaction)
            return saved,None
        except ClientError as exc:
            if exc.response.get("Error",{}).get("Code")=="TransactionCanceledException":continue
            raise
    return None,"The selected therapist and time are no longer available. Please choose another option."

def validate_date(date):
    if not date:
        return "date parameter is required"
    try:
        chosen = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return "Appointment date must use YYYY-MM-DD."
    if chosen < datetime.now(ZoneInfo("America/New_York")).date():
        return "Past appointment dates are not allowed. Choose today or a future date."
    if chosen.weekday() == 6:
        return "Blooming Lotus is closed on Sundays. Please choose Monday through Saturday."
    return None


def closure_for_date(date):
    try:
        items = scan_all(announcements_table)
        for item in items:
            if (
                item.get("status") == "PUBLISHED"
                and item.get("blockAppointmentDates") is True
                and item.get("closureStartDate", "") <= date <= item.get("closureEndDate", "")
            ):
                return item
    except Exception as exc:
        print("Closure lookup failed:", repr(exc))
    return None


def handle_availability(event):
    query = event.get("queryStringParameters") or {}
    date = clean(query.get("date"), 20)
    duration = parse_duration_minutes(query.get("duration"), default=60)
    service = clean(query.get("service"), 120)

    date_error = validate_date(date)
    if date_error:
        return response(400, {"message": date_error})

    closure = closure_for_date(date)
    if closure:
        return response(
            200,
            {
                "closed": True,
                "date": date,
                "message": closure.get("message")
                or "Blooming Lotus is closed on the selected date. Please choose another date.",
                "closure": {
                    "title": closure.get("title"),
                    "start": closure.get("closureStartDate"),
                    "end": closure.get("closureEndDate"),
                },
                "therapists": [],
                "slots": [],
            },
        )

    return response(
        200,
        {
            "date": date,
            "businessHours": {"opens": "10:00", "closes": "20:00"},
            "intervalMinutes": 15,
            "requestedDurationMinutes": duration,
            "therapists": therapist_names(service),
            "slots": build_availability(date, duration, service),
        },
    )


def handle_appointment(event):
    try:
        raw=event.get("body") or "{}"; body=json.loads(raw) if isinstance(raw,str) else raw
    except Exception:return response(400,{"message":"Invalid request body."})
    if clean(body.get("website")):return response(400,{"message":"Request rejected."})
    name=clean(body.get("name"),120);phone=clean(body.get("phone"),40);email=clean(body.get("email"),180)
    date=clean(body.get("appointmentDate") or body.get("date") or body.get("preferredDate"),20)
    preferred_time=clean(body.get("time") or body.get("preferredTime"),40);service=clean(body.get("service"),120)
    therapist=clean(body.get("therapist"),80);length=clean(body.get("length") or body.get("sessionLength"),40);notes=clean(body.get("notes"),1000)
    duration=parse_duration_minutes(length,default=60)
    if not all((name,phone,service,therapist,date,preferred_time)):return response(400,{"message":"Name, phone, service, therapist, date, and exact time are required."})
    eligible = therapist_names(service)
    if therapist != "No preference" and therapist not in eligible:return response(400,{"message":"Please select an active therapist who provides this service."})
    if service not in allowed_services:return response(400,{"message":"Please select a valid service."})
    error=validate_date(date)
    if error:return response(400,{"message":error})
    closure=closure_for_date(date)
    if closure:return response(409,{"message":closure.get("message") or "Blooming Lotus is closed on the selected date. Please choose another date."})
    now=datetime.now(timezone.utc);aid="BL-"+now.strftime("%Y%m%d%H%M%S")+"-"+uuid.uuid4().hex[:6].upper()
    item={"appointmentId":aid,"status":"REQUESTED","customerName":name,"phone":phone,"service":service,"therapist":therapist,"createdAt":now.isoformat(),"expiresAt":int(time.time())+retention_days*86400,"source":"bloominglotus.denduluru.com-demo","preferredDate":date,"preferredTime":preferred_time,"sessionLength":length or f"{duration} Minutes"}
    if email:item["email"]=email
    if notes:item["notes"]=notes
    saved,message=reserve_and_create(item,date,preferred_time,duration,eligible if therapist=="No preference" else [therapist])
    if not saved:return response(409,{"message":message,"code":"SLOT_UNAVAILABLE"})
    published=False
    plainBusinessNotificationDisabled=True
    print("Legacy SNS business notification disabled; SES HTML business email remains enabled.")
    business_email_sent,business_email_result=send_business_html_notification(saved)
    time.sleep(1.25)
    customer_email_sent,customer_email_result=send_customer_acknowledgement(saved)
    print("Appointment email results:", {"businessEmailSent": business_email_sent, "businessMessageId": business_email_result, "customerEmailSent": customer_email_sent, "customerMessageId": customer_email_result})
    return response(201,{"plainBusinessNotificationDisabled":plainBusinessNotificationDisabled,"businessEmailSent":business_email_sent,"businessEmailResult":business_email_result,"customerEmailSent":customer_email_sent,"customerEmailResult":customer_email_result,"appointmentId":aid,"status":"REQUESTED","therapist":saved["therapist"],"notificationPublished":published,"message":"Appointment request received and the selected time is being held pending confirmation."})

def handler(event, context):
    method = request_method(event)
    path = str(event.get("rawPath") or event.get("path") or "")

    if method == "GET" and (path in ("", "/availability") or path.endswith("/availability")):
        return handle_availability(event)
    if method == "POST":
        return handle_appointment(event)
    if method == "OPTIONS":
        return response(204, {})
    return response(405, {"message": "Method not allowed."})
