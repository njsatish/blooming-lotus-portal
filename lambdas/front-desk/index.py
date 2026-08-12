import json, os, boto3, uuid
from datetime import datetime, timezone
from decimal import Decimal

ddb=boto3.resource('dynamodb').Table(os.environ['TABLE_NAME']); ses=boto3.client('sesv2')
EMAIL_FROM=os.environ.get('EMAIL_FROM',''); REPLY_TO=os.environ.get('REPLY_TO',''); SES_ENABLED=os.environ.get('SES_ENABLED','false').lower()=='true'
STATUSES={'REQUESTED','CONTACTED','CONFIRMED','RESCHEDULE_NEEDED','CANCELLED','COMPLETED','NO_SHOW'}
TRANSITIONS={'REQUESTED':{'CONTACTED','CONFIRMED','RESCHEDULE_NEEDED','CANCELLED'},'CONTACTED':{'CONTACTED','CONFIRMED','RESCHEDULE_NEEDED','CANCELLED'},'RESCHEDULE_NEEDED':{'CONTACTED','CONFIRMED','RESCHEDULE_NEEDED','CANCELLED'},'CONFIRMED':{'CONFIRMED','RESCHEDULE_NEEDED','CANCELLED','COMPLETED','NO_SHOW'},'CANCELLED':set(),'COMPLETED':set(),'NO_SHOW':set()}
def enc(v):
 if isinstance(v,Decimal): return int(v) if v%1==0 else float(v)
 raise TypeError
def reply(c,b): return {'statusCode':c,'headers':{'content-type':'application/json'},'body':json.dumps(b,default=enc)}
def clean(v,n=500): return str(v or '').strip()[:n]
def groups(c):
 g=c.get('cognito:groups',[])
 if isinstance(g,str): return {x.strip(' []"') for x in g.replace(',',' ').split()}
 return set(g or [])
def notify(item,status,message):
 email=clean(item.get('email'),180)
 if not (SES_ENABLED and EMAIL_FROM and email): return {'sent':False,'reason':'EMAIL_NOT_AVAILABLE'}
 subject={'CONFIRMED':'Blooming Lotus appointment confirmed','RESCHEDULE_NEEDED':'Blooming Lotus scheduling update','CANCELLED':'Blooming Lotus appointment cancelled','PHONE_BOOKING':'Blooming Lotus appointment details'}.get(status)
 if not subject:return {'sent':False,'reason':'STATUS_DOES_NOT_NOTIFY'}
 name=clean(item.get('customerName') or item.get('name'),120) or 'Customer'; text=message or 'Your Blooming Lotus appointment information has been updated.'
 html=f'<html><body style="font-family:Arial;color:#372820"><h2>Blooming Lotus</h2><p>Hello {name},</p><p>{text}</p><p><b>Date:</b> {clean(item.get("confirmedDate") or item.get("preferredDate"))}</p><p><b>Time:</b> {clean(item.get("confirmedTime") or item.get("preferredTime"))}</p><p><b>Service:</b> {clean(item.get("service"))}</p><p>Questions? Reply to this email.</p></body></html>'
 try:
  r=ses.send_email(FromEmailAddress=f'Blooming Lotus <{EMAIL_FROM}>',Destination={'ToAddresses':[email]},ReplyToAddresses=[REPLY_TO] if REPLY_TO else [],Content={'Simple':{'Subject':{'Data':subject},'Body':{'Html':{'Data':html},'Text':{'Data':text}}}}); return {'sent':True,'messageId':r.get('MessageId')}
 except Exception as e: print('email failed',repr(e)); return {'sent':False,'reason':type(e).__name__}
def _blooming_original_handler_v22(event,ctx):
 claims=event.get('requestContext',{}).get('authorizer',{}).get('jwt',{}).get('claims',{})
 if 'FrontDesk' not in groups(claims): return reply(403,{'message':'Front-desk access required'})
 method=event.get('requestContext',{}).get('http',{}).get('method','GET'); path=event.get('rawPath',''); actor=claims.get('email') or claims.get('sub','unknown')
 if method=='GET' and path.endswith('/appointments'):
  data=ddb.scan(Limit=250); return reply(200,{'appointments':sorted(data.get('Items',[]),key=lambda x:x.get('createdAt',''),reverse=True)})
 if method=='POST' and path.endswith('/appointments'):
  b=json.loads(event.get('body') or '{}'); name=clean(b.get('customerName'),120); phone=clean(b.get('phone'),40); email=clean(b.get('email'),180); service=clean(b.get('service'),120); therapist=clean(b.get('therapist'),80); date=clean(b.get('appointmentDate'),20); time=clean(b.get('appointmentTime'),20); length=clean(b.get('sessionLength'),40); source=clean(b.get('bookingSource'),20).upper(); status=clean(b.get('status'),30).upper(); notes=clean(b.get('notes'),1000); private=clean(b.get('frontDeskNotes'),2000)
  if source not in {'PHONE','WALK_IN','EMAIL'}: return reply(400,{'message':'Invalid booking source'})
  if status not in {'REQUESTED','CONFIRMED'}: return reply(400,{'message':'Initial status must be REQUESTED or CONFIRMED'})
  if not name or not phone or not service or not date or not time: return reply(400,{'message':'Name, phone, service, date, and time are required'})
  scan=ddb.scan(FilterExpression='#p=:p AND (preferredDate=:d OR confirmedDate=:d) AND (preferredTime=:t OR confirmedTime=:t)',ExpressionAttributeNames={'#p':'phone'},ExpressionAttributeValues={':p':phone,':d':date,':t':time},Limit=20)
  duplicates=scan.get('Items',[])
  if duplicates and not b.get('forceCreate'): return reply(409,{'message':'Possible duplicate appointment found','possibleDuplicates':duplicates})
  now=datetime.now(timezone.utc); iso=now.isoformat(); aid=f'BL-{source}-{now.strftime("%Y%m%d%H%M%S")}-{uuid.uuid4().hex[:6].upper()}'
  item={'appointmentId':aid,'bookingSource':source,'status':status,'customerName':name,'phone':phone,'email':email,'service':service,'therapist':therapist,'sessionLength':length,'notes':notes,'frontDeskNotes':private,'createdAt':iso,'createdBy':actor,'updatedAt':iso,'updatedBy':actor,'activityHistory':[{'eventType':f'{source}_BOOKING_CREATED','status':status,'at':iso,'by':actor}]}
  if status=='CONFIRMED': item.update({'confirmedDate':date,'confirmedTime':time})
  else:item.update({'preferredDate':date,'preferredTime':time})
  ddb.put_item(Item=item,ConditionExpression='attribute_not_exists(appointmentId)')
  notification=notify(item,'PHONE_BOOKING',clean(b.get('customerMessage'),1000)) if b.get('notifyCustomer') else {'sent':False,'reason':'NOT_REQUESTED'}
  return reply(201,{'appointment':item,'notification':notification})
 aid=(event.get('pathParameters') or {}).get('appointmentId')
 if method=='PATCH' and aid:
  current=ddb.get_item(Key={'appointmentId':aid}).get('Item')
  if not current:return reply(404,{'message':'Appointment not found'})
  b=json.loads(event.get('body') or '{}'); old=current.get('status','REQUESTED'); status=b.get('status',old)
  if status not in STATUSES:return reply(400,{'message':'Invalid status'})
  if status!=old and status not in TRANSITIONS.get(old,set()):return reply(409,{'message':f'Cannot change {old} to {status}'})
  notes=clean(b.get('frontDeskNotes',current.get('frontDeskNotes','')),2000); now=datetime.now(timezone.utc).isoformat(); ev={'status':status,'at':now,'by':actor}
  vals={':s':status,':n':notes,':u':now,':b':actor,':e':[ev],':z':[]}; names={'#s':'status','#h':'activityHistory'}; expr='SET #s=:s, frontDeskNotes=:n, updatedAt=:u, updatedBy=:b, #h=list_append(if_not_exists(#h,:z),:e)'
  for i,k in enumerate(('confirmedDate','confirmedTime','proposedDate','proposedTime','contactMethod','statusReason')):
   v=clean(b.get(k));
   if v:names[f'#x{i}']=k;vals[f':x{i}']=v;expr+=f', #x{i}=:x{i}'
  r=ddb.update_item(Key={'appointmentId':aid},UpdateExpression=expr,ExpressionAttributeNames=names,ExpressionAttributeValues=vals,ReturnValues='ALL_NEW'); n=notify(r['Attributes'],status,clean(b.get('customerMessage'),1000)) if b.get('notifyCustomer') else {'sent':False,'reason':'NOT_REQUESTED'}; return reply(200,{'appointment':r['Attributes'],'notification':n})
 return reply(404,{'message':'Route not found'})


# BEGIN BLOOMING_PAST_DATE_GUARD_V22
def _blooming_before_demo_email_v23(event, context):
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


# BEGIN BLOOMING_DEMO_CONFIRMATION_EMAIL_V23
def _send_demo_confirmation_v23(item, intended_email, confirmed_date, confirmed_time):
    import boto3, html, os
    ses = boto3.client('sesv2')
    demo_to = os.environ['DEMO_CONFIRMATION_RECIPIENT']
    sender = os.environ['DEMO_CONFIRMATION_FROM']
    name = str(item.get('customerName') or item.get('name') or 'Customer')
    service = str(item.get('service') or 'Not specified')
    therapist = str(item.get('therapist') or 'No preference')
    length = str(item.get('sessionLength') or item.get('length') or 'Not specified')
    subject = f'[DEMO] Blooming Lotus appointment confirmed - {name}'
    text = f'''DEMO EMAIL - NOT DELIVERED TO CUSTOMER

Intended customer: {name}
Intended customer email: {intended_email or 'Not provided'}

Your Blooming Lotus appointment has been confirmed.
Date: {confirmed_date}
Time: {confirmed_time}
Service: {service}
Therapist: {therapist}
Session length: {length}

This message was sent only to the controlled demo inbox.'''
    body = f'''<!doctype html><html><body style="margin:0;background:#f7f2f5;font-family:Arial;color:#372820"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px"><table width="600" style="max-width:100%;background:white;border-radius:16px;overflow:hidden"><tr><td style="background:#5b163f;color:white;padding:24px;text-align:center"><h1 style="margin:0">Blooming Lotus</h1><p style="margin:8px 0 0">Appointment Confirmation Demo</p></td></tr><tr><td style="padding:26px"><p style="padding:12px;background:#fff3cd;border-radius:8px"><strong>Demo only:</strong> This email was not delivered to the customer.</p><p><strong>Intended customer:</strong> {html.escape(name)}<br><strong>Intended email:</strong> {html.escape(intended_email or 'Not provided')}</p><h2>Appointment confirmed</h2><p><strong>Date:</strong> {html.escape(confirmed_date)}<br><strong>Time:</strong> {html.escape(confirmed_time)}<br><strong>Service:</strong> {html.escape(service)}<br><strong>Therapist:</strong> {html.escape(therapist)}<br><strong>Session length:</strong> {html.escape(length)}</p><p>If this project is approved, the production version will send branded confirmations from the business's verified domain.</p></td></tr></table></td></tr></table></body></html>'''
    result = ses.send_email(FromEmailAddress=sender, Destination={'ToAddresses':[demo_to]}, ReplyToAddresses=[sender], Content={'Simple':{'Subject':{'Data':subject},'Body':{'Text':{'Data':text},'Html':{'Data':body}}}})
    return result.get('MessageId')

def _before_closure_v29(event, context):
    import json as _json
    response = _blooming_before_demo_email_v23(event, context)
    try:
        method = str(event.get('requestContext',{}).get('http',{}).get('method','')).upper()
        appointment_id = (event.get('pathParameters') or {}).get('appointmentId')
        body = _json.loads(event.get('body') or '{}')
        if method == 'PATCH' and appointment_id and body.get('status') == 'CONFIRMED':
            payload = _json.loads(response.get('body') or '{}')
            item = payload.get('appointment') or {}
            confirmed_date = str(body.get('confirmedDate') or item.get('confirmedDate') or '')
            confirmed_time = str(body.get('confirmedTime') or item.get('confirmedTime') or '')
            if response.get('statusCode',500) < 300 and confirmed_date and confirmed_time:
                message_id = _send_demo_confirmation_v23(item, str(item.get('email') or ''), confirmed_date, confirmed_time)
                payload['notification'] = {'sent': True, 'demo': True, 'messageId': message_id, 'recipient': 'controlled-demo-inbox'}
                response['body'] = _json.dumps(payload, default=str)
    except Exception as error:
        print('Demo confirmation email failed', repr(error))
        try:
            payload = _json.loads(response.get('body') or '{}')
            payload['notification'] = {'sent': False, 'demo': True, 'error': type(error).__name__}
            response['body'] = _json.dumps(payload, default=str)
        except Exception:
            pass
    return response
# END BLOOMING_DEMO_CONFIRMATION_EMAIL_V23


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

