const ROOT_NAME = 'SimpleAgentWorks - Client Onboarding';
const TO = 'info@simpleagentworks.com';
const MAX_FILE = 8 * 1024 * 1024;
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Client onboarding | SimpleAgentWorks.com').addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function safe(s, n) { return String(s || '').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, n || 200); }
function folderName(s) { return safe(s, 90).replace(/[\\/:*?"|]/g, '-'); }
function root() { var it = DriveApp.getFoldersByName(ROOT_NAME); return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT_NAME); }
function authorize(id, token) {
  if (!/^[\w-]{15,}$/.test(String(id)) || !token || PropertiesService.getScriptProperties().getProperty('session_' + id) !== token) throw Error('This upload session expired. Please start again.');
  return DriveApp.getFolderById(id);
}
function beginSubmission(p) {
  if (!p || p.website) throw Error('Unable to start this submission.');
  if (!/^(intranet|website|both)$/.test(p.projectType)) throw Error('Choose a project type.');
  var company = safe(p.company, 100), contact = safe(p.contact, 100), email = safe(p.email, 160);
  if (!company || !contact || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Error('Company, contact name, and a valid email are required.');
  if (!Array.isArray(p.departments) || p.departments.length < (p.projectType === 'website' ? 1 : 4) || p.departments.length > 20) throw Error('Please include 4 to 20 departments.');
  var depts = p.departments.map(function(d) {
    return {name:folderName(d.name),head:safe(d.head, 100),headEmail:safe(d.headEmail, 160),purpose:safe(d.purpose, 2000),tools:safe(d.tools, 2000),links:safe(d.links, 2000),include:safe(d.include, 2000)};
  });
  if (depts.some(function(d) {return !d.name || !d.head || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.headEmail);})) throw Error('Every department needs its name, head, and head email.');
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmmss');
  var parent = root().createFolder(folderName(company) + ' - ' + now + ' - ' + Utilities.getUuid().slice(0,8));
  var token = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('session_' + parent.getId(), token);
  var ratings = Array.isArray(p.ratings) ? p.ratings.filter(function(r){return r && /^[a-z-]{3,40}$/.test(r.module) && /^(love|must|dislike)$/.test(r.rating);}).slice(0,30) : [];
  var aiChoices = ['customer_appointments','estimator_appointments','team_jobs','quotes_estimates','photo_estimates','schedule_updates'];
  var selected = p.aiServices && Array.isArray(p.aiServices.selected) ? p.aiServices.selected.filter(function(key) {return aiChoices.indexOf(key) !== -1;}) : [];
  var aiServices = {selected:aiChoices.filter(function(key) {return selected.indexOf(key) !== -1;}),other:safe(p.aiServices && p.aiServices.other,1000),details:{}};
  aiServices.selected.forEach(function(key){var obj=p.aiServices && p.aiServices.details && p.aiServices.details[key] || {}; aiServices.details[key]={}; Object.keys(obj).slice(0,12).forEach(function(field){if(/^[a-zA-Z]{2,40}$/.test(field))aiServices.details[key][field]=safe(obj[field],2000);});});
  var data = {projectType:p.projectType,ratings:ratings,aiServices:aiServices,company:company,industry:safe(p.industry,100),contact:contact,email:email,phone:safe(p.phone,80),departments:depts,submittedAt:new Date().toISOString()};
  parent.createFile('Intake answers.json', JSON.stringify(data,null,2), MimeType.PLAIN_TEXT);
  try { supaRequest('post','/rest/v1/client_intakes', {id:parent.getId(), answers:data, status:'uploading', drive_url:parent.getUrl()}); } catch(e) { parent.setTrashed(true); PropertiesService.getScriptProperties().deleteProperty('session_' + parent.getId()); throw Error('Secure intake storage is unavailable. Nothing was submitted. '+e.message); }
  depts.forEach(function(d,i) { parent.createFolder(String(i+1).padStart(2,'0') + ' - ' + d.name); });
  return {id:parent.getId(),token:token};
}
function uploadFile(id,token,index,category,name,mime,base64) {
  var parent = authorize(id,token);
  if (!/^(hero|team|documents)$/.test(category) || !Number.isInteger(index) || index < 0 || index > 19) throw Error('Invalid upload destination.');
  if (!/^(image\/(jpeg|png|gif|webp|heic|heif)|application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel))$/.test(mime)) throw Error('Unsupported file type.');
  if (!base64 || base64.length > Math.ceil(MAX_FILE*4/3)+16) throw Error('File is too large (8 MB maximum).');
  var bytes = Utilities.base64Decode(base64);
  if (bytes.length > MAX_FILE) throw Error('File is too large (8 MB maximum).');
  var folders = parent.getFolders(), target, prefix=String(index+1).padStart(2,'0')+' - ';
  while(folders.hasNext()) {var f=folders.next(); if(f.getName().indexOf(prefix)===0) {target=f;break;}}
  if (!target) throw Error('Department folder was not found.');
  var cat=target.getFoldersByName(category); var dest=cat.hasNext()?cat.next():target.createFolder(category);
  var filename=folderName(name)||'upload';
  var path=encodeURIComponent(id)+'/'+encodeURIComponent(folderName(target.getName()))+'/'+encodeURIComponent(category)+'/'+encodeURIComponent(filename);
  supaRequest('post','/storage/v1/object/client-intake-uploads/'+path,Utilities.newBlob(bytes,mime,filename),{'Content-Type':mime,'x-upsert':'true'});
  if (!dest.getFilesByName(filename).hasNext()) dest.createFile(Utilities.newBlob(bytes,mime,filename));
  return true;
}
function finishSubmission(id,token) {
  var parent=authorize(id,token), file=parent.getFilesByName('Intake answers.json');
  if (!file.hasNext()) throw Error('Answers were not found.');
  var p=JSON.parse(file.next().getBlob().getDataAsString());
  var updated = JSON.parse(supaRequest('patch','/rest/v1/client_intakes?id=eq.'+encodeURIComponent(id),{status:'complete',completed_at:new Date().toISOString()},{Prefer:'return=representation'}));
  if (!Array.isArray(updated) || updated.length !== 1 || updated[0].id !== id) throw Error('Secure intake record was not finalized.');
  MailApp.sendEmail({to:TO,subject:'New client intake: '+p.company,body:'New customer onboarding submission from '+p.contact+' ('+p.email+').\nCompany: '+p.company+'\nIndustry: '+p.industry+'\nPhone: '+p.phone+'\nProject type: '+p.projectType+'\nDesign preferences: '+p.ratings.length+' rated modules\nAI services (MCP): '+(p.aiServices && p.aiServices.selected && p.aiServices.selected.length ? p.aiServices.selected.map(function(key){return ({customer_appointments:'Book appointments in my calendar',estimator_appointments:'Book appointments in my estimator\'s calendar',quotes_estimates:'Provide quotes/estimates',team_jobs:'Book jobs in my services/team calendar',photo_estimates:'Photo-based estimates and booking',schedule_updates:'Scheduling updates'})[key] || key;}).join(', ') : 'None selected')+'\nOther AI services: '+(p.aiServices && p.aiServices.other || 'None')+'\nAI service details: '+JSON.stringify(p.aiServices && p.aiServices.details || {})+'\nDepartments: '+p.departments.map(function(d){return d.name;}).join(', ')+'\n\nAnswers and uploaded files: '+parent.getUrl()});
  PropertiesService.getScriptProperties().deleteProperty('session_' + id);
  return {ok:true};
}

// Server-only settings: SUPABASE_URL, SUPABASE_SECRET_KEY, REVIEW_BOOKING_URL.
// Never expose a secret key via doGet or client-side templates.
function supaRequest(method,path,body,extra) {
  var props=PropertiesService.getScriptProperties();
  var origin=props.getProperty('SUPABASE_URL'), key=props.getProperty('SUPABASE_SECRET_KEY');
  if(!origin || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin) || !key) throw Error('Secure storage is not configured.');
  var opts={method:method, muteHttpExceptions:true,headers:Object.assign({'apikey':key},extra||{})};
  if(body && typeof body==='object' && typeof body.getBytes==='function')opts.payload=body.getBytes();
  else if(body){opts.contentType='application/json';opts.payload=JSON.stringify(body);}
  var response=UrlFetchApp.fetch(origin+path,opts), code=response.getResponseCode();
  if(code<200||code>=300)throw Error('Secure storage returned '+code+'.');
  return response.getContentText();
}
function clientConfig(){
  var url=PropertiesService.getScriptProperties().getProperty('REVIEW_BOOKING_URL')||'';
  return {reviewBookingUrl:/^https:\/\//.test(url)?url:'',helpEmail:TO};
}

function verifyStorageAuthorization() { return supaRequest('get','/rest/v1/client_intakes?select=id&limit=1',null); }
