import json, os, time, uuid
from datetime import datetime, timezone
import boto3

table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])
sns = boto3.client('sns')
notification_topic_arn = os.environ['NOTIFICATION_TOPIC_ARN']
retention_days = int(os.environ.get('RETENTION_DAYS', '90'))
allowed_therapists = {'Jack', 'Rose', 'Mike', 'No preference'}
allowed_services = {
    'Deep Tissue Massage', 'Hot Stone Massage', 'Relaxing / Full Body Massage',
    'Couples Massage', 'Foot Massage / Reflexology', 'Acupressure / Cupping',
    'Other / Ask front desk'
}

def clean(value, limit=250):
    if value is None:
        return ''
    return str(value).strip()[:limit]

def response(status, payload):
    return {'statusCode': status, 'body': json.dumps(payload)}

def _blooming_original_handler_v22(event, context):
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return response(400, {'message': 'Invalid request body.'})

    if clean(body.get('website')):
        return response(400, {'message': 'Request rejected.'})

    name = clean(body.get('name'), 120)
    phone = clean(body.get('phone'), 40)
    email = clean(body.get('email'), 180)
    date = clean(body.get('date'), 20)
    preferred_time = clean(body.get('time'), 40)
    service = clean(body.get('service'), 120)
    therapist = clean(body.get('therapist'), 80)
    length = clean(body.get('length'), 40)
    notes = clean(body.get('notes'), 1000)

    if not name or not phone or not service or not therapist:
        return response(400, {'message': 'Name, phone, service, and therapist are required.'})
    if therapist not in allowed_therapists:
        return response(400, {'message': 'Please select a valid therapist.'})
    if service not in allowed_services:
        return response(400, {'message': 'Please select a valid service.'})

    now = datetime.now(timezone.utc)
    appointment_id = 'BL-' + now.strftime('%Y%m%d%H%M%S') + '-' + uuid.uuid4().hex[:6].upper()
    item = {
        'appointmentId': appointment_id,
        'status': 'REQUESTED',
        'customerName': name,
        'phone': phone,
        'service': service,
        'therapist': therapist,
        'createdAt': now.isoformat(),
        'expiresAt': int(time.time()) + retention_days * 86400,
        'source': 'bloominglotus.denduluru.com-demo'
    }
    optional = {
        'email': email, 'preferredDate': date, 'preferredTime': preferred_time,
        'sessionLength': length, 'notes': notes
    }
    item.update({k: v for k, v in optional.items() if v})
    table.put_item(Item=item)

    email_lines = [
        'New Blooming Lotus Appointment Request',
        '',
        f'Request #: {appointment_id}',
        'Status: REQUESTED',
        '',
        f'Customer: {name}',
        f'Phone: {phone}',
        f'Email: {email or "Not provided"}',
        f'Service: {service}',
        f'Therapist: {therapist}',
        f'Preferred Date: {date or "Not provided"}',
        f'Preferred Time: {preferred_time or "Not provided"}',
        f'Session Length: {length or "Not provided"}',
        '',
        f'Notes: {notes or "None"}',
        '',
        'This is a request only. The appointment has not been confirmed.'
    ]
    notification_published = True
    try:
        sns.publish(
            TopicArn=notification_topic_arn,
            Subject='Blooming Lotus - New Appointment Request',
            Message='\n'.join(email_lines)
        )
    except Exception as exc:
        print('SNS publish failed:', repr(exc))
        notification_published = False

    return response(201, {
        'appointmentId': appointment_id,
        'status': 'REQUESTED',
        'notificationPublished': notification_published,
        'message': 'Appointment request received. Blooming Lotus must confirm it.'
    })


# BEGIN BLOOMING_PAST_DATE_GUARD_V22
def _before_closure_v29(event, context):
 import json as _json
 from datetime import datetime as _dt
 from zoneinfo import ZoneInfo as _ZI
 try:
  _method=str(event.get('requestContext',{}).get('http',{}).get('method',event.get('httpMethod',''))).upper()
  if _method=='POST':
   _raw=event.get('body') or '{}';_body=_json.loads(_raw) if isinstance(_raw,str) else (_raw or {})
   _value=_body.get('appointmentDate') or _body.get('date') or _body.get('preferredDate')
   if _value:
    try:_chosen=_dt.strptime(str(_value),'%Y-%m-%d').date()
    except ValueError:return {'statusCode':400,'headers':{'content-type':'application/json'},'body':_json.dumps({'message':'Appointment date must use YYYY-MM-DD.'})}
    if _chosen<_dt.now(_ZI('America/New_York')).date():return {'statusCode':400,'headers':{'content-type':'application/json'},'body':_json.dumps({'message':'Past appointment dates are not allowed. Choose today or a future date.'})}
 except Exception as _e:
  print('V22 date guard',repr(_e));return {'statusCode':400,'headers':{'content-type':'application/json'},'body':_json.dumps({'message':'Unable to validate appointment date.'})}
 return _blooming_original_handler_v22(event,context)
# END BLOOMING_PAST_DATE_GUARD_V22


# BEGIN BLOOMING_CLOSURE_GUARD_V29
def handler(event,context):
 import json as _json,os as _os,boto3 as _boto3
 try:
  method=str(event.get('requestContext',{}).get('http',{}).get('method',event.get('httpMethod',''))).upper()
  if method=='POST':
   raw=event.get('body')or'{}';body=_json.loads(raw) if isinstance(raw,str) else(raw or{});date=body.get('appointmentDate')or body.get('date')or body.get('preferredDate')
   if date:
    items=_boto3.resource('dynamodb').Table(_os.environ['ANNOUNCEMENTS_TABLE']).scan(FilterExpression='#s=:p AND blockAppointmentDates=:t',ExpressionAttributeNames={'#s':'status'},ExpressionAttributeValues={':p':'PUBLISHED',':t':True}).get('Items',[])
    for x in items:
     if x.get('closureStartDate','')<=date<=x.get('closureEndDate',''):
      return {'statusCode':409,'headers':{'content-type':'application/json'},'body':_json.dumps({'message':x.get('message')or'Blooming Lotus is closed on the selected date. Please choose another date.','closure':{'title':x.get('title'),'start':x.get('closureStartDate'),'end':x.get('closureEndDate')}})}
 except Exception as e:print('Closure guard',repr(e))
 return _before_closure_v29(event,context)
# END BLOOMING_CLOSURE_GUARD_V29

