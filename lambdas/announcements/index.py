import json, os, uuid, boto3
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
ann=boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])
appt=boto3.resource('dynamodb').Table(os.environ['APPOINTMENT_TABLE'])
VALID_TYPES={'CLOSURE','IMPORTANT','INFO'}; VALID_STATUS={'DRAFT','PUBLISHED','ARCHIVED'}
def response(code,body): return {'statusCode':code,'headers':{'content-type':'application/json','cache-control':'no-store'},'body':json.dumps(body,default=str)}
def admin(event):
  claims=event.get('requestContext',{}).get('authorizer',{}).get('jwt',{}).get('claims',{})
  groups=str(claims.get('cognito:groups',''))
  return ('FrontDesk' in groups, claims.get('email') or claims.get('sub','unknown'))
def all_items():
  items=[]; start=None
  while True:
    args={}
    if start: args['ExclusiveStartKey']=start
    page=ann.scan(**args);items.extend(page.get('Items',[]));start=page.get('LastEvaluatedKey')
    if not start:return items
def active():
  now=datetime.now(timezone.utc).isoformat(); today=datetime.now(ZoneInfo('America/New_York')).date().isoformat()
  result=[]
  for x in all_items():
    if x.get('status')!='PUBLISHED':continue
    if x.get('displayFrom') and x['displayFrom']>now:continue
    if x.get('displayUntil') and x['displayUntil']<now:continue
    x['activeClosure']=bool(x.get('blockAppointmentDates') and x.get('closureStartDate','')<=today<=x.get('closureEndDate',''))
    result.append(x)
  return sorted(result,key=lambda x:(x.get('priority')!='IMPORTANT',x.get('displayFrom','')),reverse=False)
def handler(event,context):
  method=event.get('requestContext',{}).get('http',{}).get('method','GET');path=event.get('rawPath','');aid=(event.get('pathParameters')or{}).get('announcementId')
  if method=='GET' and path.endswith('/announcements/active'):return response(200,{'announcements':active()})
  ok,actor=admin(event)
  if not ok:return response(403,{'message':'Front-desk access required'})
  if method=='GET' and path.endswith('/admin/announcements'):return response(200,{'announcements':sorted(all_items(),key=lambda x:x.get('updatedAt',''),reverse=True)})
  if method=='GET' and path.endswith('/affected-appointments') and aid:
    item=ann.get_item(Key={'announcementId':aid}).get('Item')
    if not item:return response(404,{'message':'Announcement not found'})
    start,end=item.get('closureStartDate'),item.get('closureEndDate');matches=[]
    for x in appt.scan(Limit=500).get('Items',[]):
      date=x.get('confirmedDate')or x.get('proposedDate')or x.get('preferredDate')or x.get('date')
      if start and end and date and start<=date<=end and x.get('status','REQUESTED') not in {'CANCELLED','COMPLETED'}:matches.append(x)
    return response(200,{'appointments':matches})
  if method in {'POST','PATCH'}:
    body=json.loads(event.get('body')or'{}'); now=datetime.now(timezone.utc).isoformat()
    if method=='POST':aid='ANN-'+uuid.uuid4().hex[:12].upper();created=now
    else:
      old=ann.get_item(Key={'announcementId':aid}).get('Item')
      if not old:return response(404,{'message':'Announcement not found'})
      created=old.get('createdAt',now)
    item={'announcementId':aid,'title':str(body.get('title','')).strip()[:120],'message':str(body.get('message','')).strip()[:1200],'type':body.get('type','INFO'),'priority':body.get('priority','NORMAL'),'status':body.get('status','DRAFT'),'displayFrom':body.get('displayFrom',''),'displayUntil':body.get('displayUntil',''),'closureStartDate':body.get('closureStartDate',''),'closureEndDate':body.get('closureEndDate',''),'showOnHomePage':bool(body.get('showOnHomePage',True)),'showOnBookingForm':bool(body.get('showOnBookingForm',True)),'showOnAdmin':bool(body.get('showOnAdmin',True)),'blockAppointmentDates':bool(body.get('blockAppointmentDates',False)),'createdAt':created,'createdBy':actor,'updatedAt':now,'updatedBy':actor}
    if not item['title'] or not item['message']:return response(400,{'message':'Title and message are required'})
    if item['type'] not in VALID_TYPES or item['status'] not in VALID_STATUS:return response(400,{'message':'Invalid type or status'})
    if item['blockAppointmentDates'] and (not item['closureStartDate'] or not item['closureEndDate'] or item['closureEndDate']<item['closureStartDate']):return response(400,{'message':'Valid closure start and end dates are required'})
    ann.put_item(Item=item);return response(201 if method=='POST' else 200,{'announcement':item})
  return response(404,{'message':'Route not found'})
