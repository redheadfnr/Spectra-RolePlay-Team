require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Spectra server starting...');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const SESSION_TTL = Number(process.env.SESSION_TTL_HOURS || 12) * 60 * 60 * 1000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, 'public')));

function loadDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch { return {organizations:[],vehicles:[],users:[],organizationVehicles:[],requests:[],rules:[],adminJailRules:[],audit:[],sessions:[]}; }
}
function saveDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function cleanUser(u){ return u ? {id:u.id,username:u.username,role:u.role,organizationId:u.organizationId,active:u.active} : null; }
function audit(db, actor, action, details=''){
  db.audit.unshift({id:randomUUID(), at:new Date().toISOString(), actor:actor?.username || 'SYSTEM', action, details});
  db.audit = db.audit.slice(0, 1000);
}
function seedUsers(db){
  const seeds = [
    {username:'admin',role:'ADMIN',organizationId:null,password:process.env.ADMIN_PASSWORD},
    {username:'projektleitung',role:'PROJEKTLEITUNG',organizationId:null,password:process.env.PROJEKTLEITUNG_PASSWORD},
    {username:'leader',role:'LEADER',organizationId:(db.organizations.find(o=>o.name===process.env.LEADER_ORG)||db.organizations[0])?.id,password:process.env.LEADER_PASSWORD}
  ];
  let changed=false;
  for(const s of seeds){
    if(!s.password) continue;
    let u=db.users.find(x=>x.username===s.username);
    if(!u){ db.users.push({id:randomUUID(),username:s.username,role:s.role,organizationId:s.organizationId,active:true,passwordHash:bcrypt.hashSync(s.password,12)}); changed=true; }
  }
  if(changed) saveDB(db);
}
let db=loadDB(); seedUsers(db); db=loadDB();

function auth(req,res,next){
  const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  const session=db.sessions.find(s=>s.token===token && new Date(s.expiresAt)>new Date());
  if(!session) return res.status(401).json({error:'Nicht angemeldet'});
  const user=db.users.find(u=>u.id===session.userId && u.active);
  if(!user) return res.status(401).json({error:'Benutzer nicht verfügbar'});
  req.user=user; req.token=token; next();
}
function roles(...allowed){ return (req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({error:'Keine Berechtigung'}); }
function ownOrg(req, orgId){ return req.user.role!=='LEADER' || req.user.organizationId===orgId; }
function vehicleName(id){return db.vehicles.find(v=>v.id===id)?.name || 'Unbekannt';}
function orgName(id){return db.organizations.find(o=>o.id===id)?.name || 'Unbekannt';}

app.post('/api/login', async (req,res)=>{
  const {username,password}=req.body||{};
  if(!username||!password) return res.status(400).json({error:'Benutzername und Passwort erforderlich'});
  const user=db.users.find(u=>u.username.toLowerCase()===String(username).toLowerCase() && u.active);
  if(!user || !(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({error:'Ungültige Zugangsdaten'});
  const token=randomUUID()+randomUUID().replaceAll('-','');
  db.sessions.push({token,userId:user.id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+SESSION_TTL).toISOString()});
  db.sessions=db.sessions.filter(s=>new Date(s.expiresAt)>new Date()); audit(db,user,'LOGIN'); saveDB(db);
  res.json({token,user:cleanUser(user)});
});
app.post('/api/logout',auth,(req,res)=>{ db.sessions=db.sessions.filter(s=>s.token!==req.token); audit(db,req.user,'LOGOUT'); saveDB(db); res.json({ok:true}); });
app.get('/api/me',auth,(req,res)=>res.json({user:cleanUser(req.user)}));

app.get('/api/dashboard',auth,(req,res)=>{
  const visibleRequests=req.user.role==='LEADER'?db.requests.filter(r=>r.organizationId===req.user.organizationId):db.requests;
  const fleet=req.user.role==='LEADER'?db.organizationVehicles.filter(x=>x.organizationId===req.user.organizationId):db.organizationVehicles;
  res.json({stats:{requests:visibleRequests.length,pending:visibleRequests.filter(r=>['BEANTRAGT','IN_PRUEFUNG'].includes(r.status)).length,approved:visibleRequests.filter(r=>r.status==='GENEHMIGT').length,fleet:fleet.length},recent:visibleRequests.slice(0,8)});
});
app.get('/api/organizations',auth,(req,res)=>res.json(db.organizations));
app.get('/api/vehicles',auth,(req,res)=>res.json(db.vehicles));
app.get('/api/fleet',auth,(req,res)=>{
  const rows=db.organizationVehicles.filter(x=>req.user.role!=='LEADER'||x.organizationId===req.user.organizationId).map(x=>({...x,vehicle:db.vehicles.find(v=>v.id===x.vehicleId),organization:db.organizations.find(o=>o.id===x.organizationId)}));
  res.json(rows);
});
app.get('/api/requests',auth,(req,res)=>{
  let rows=db.requests.filter(r=>req.user.role!=='LEADER'||r.organizationId===req.user.organizationId);
  rows=rows.map(r=>({...r,vehicleName:vehicleName(r.vehicleId),organizationName:orgName(r.organizationId)}));
  res.json(rows);
});
app.post('/api/requests',auth,roles('LEADER','ADMIN','PROJEKTLEITUNG'),(req,res)=>{
  const {applicant,organizationId,vehicleId,date,imageUrl,comment}=req.body||{};
  if(!applicant||!organizationId||!vehicleId) return res.status(400).json({error:'Antragsteller, Organisation und Fahrzeug sind erforderlich'});
  if(!ownOrg(req,organizationId)) return res.status(403).json({error:'Nur die eigene Organisation darf beantragt werden'});
  if(!db.organizations.some(o=>o.id===organizationId)||!db.vehicles.some(v=>v.id===vehicleId)) return res.status(400).json({error:'Ungültige Organisation oder Fahrzeug'});
  if(db.organizationVehicles.some(x=>x.organizationId===organizationId&&x.vehicleId===vehicleId)) return res.status(409).json({error:'Dieses Fahrzeug ist bereits in der Flotte'});
  if(db.requests.some(r=>r.organizationId===organizationId&&r.vehicleId===vehicleId&&!['ABGELEHNT'].includes(r.status))) return res.status(409).json({error:'Für dieses Fahrzeug existiert bereits ein offener Antrag'});
  const r={id:randomUUID(),applicant,organizationId,vehicleId,date:date||new Date().toISOString().slice(0,10),status:'BEANTRAGT',imageUrl:imageUrl||'',reviewerId:null,reviewer:null,comment:comment||'',createdAt:new Date().toISOString()};
  db.requests.unshift(r); audit(db,req.user,'REQUEST_CREATED',`${orgName(organizationId)} / ${vehicleName(vehicleId)}`); saveDB(db); res.status(201).json(r);
});
app.patch('/api/requests/:id',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{
  const r=db.requests.find(x=>x.id===req.params.id); if(!r) return res.status(404).json({error:'Antrag nicht gefunden'});
  const {status,comment}=req.body||{};
  const allowed=['BEANTRAGT','IN_PRUEFUNG','GENEHMIGT','ABGELEHNT'];
  if(status&&!allowed.includes(status)) return res.status(400).json({error:'Ungültiger Status'});
  if(status==='GENEHMIGT' && !db.organizationVehicles.some(x=>x.organizationId===r.organizationId&&x.vehicleId===r.vehicleId)){
    db.organizationVehicles.push({id:randomUUID(),organizationId:r.organizationId,vehicleId:r.vehicleId,requestId:r.id,addedAt:new Date().toISOString()});
  }
  if(status) r.status=status; if(comment!==undefined) r.comment=comment; r.reviewerId=req.user.id; r.reviewer=req.user.username; r.reviewedAt=new Date().toISOString();
  audit(db,req.user,'REQUEST_UPDATED',`${r.id} -> ${r.status}`); saveDB(db); res.json(r);
});
app.delete('/api/requests/:id',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{
  const i=db.requests.findIndex(x=>x.id===req.params.id); if(i<0) return res.status(404).json({error:'Antrag nicht gefunden'});
  const [r]=db.requests.splice(i,1); audit(db,req.user,'REQUEST_DELETED',`${r.applicant} / ${vehicleName(r.vehicleId)}`); saveDB(db); res.json({ok:true});
});

app.get('/api/rules',auth,(req,res)=>res.json(db.rules));
app.put('/api/rules',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{ if(!Array.isArray(req.body)) return res.status(400).json({error:'Array erwartet'}); db.rules=req.body; audit(db,req.user,'RULES_UPDATED'); saveDB(db); res.json(db.rules); });
app.get('/api/admin-jail',auth,(req,res)=>res.json(db.adminJailRules));
app.put('/api/admin-jail',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{if(!Array.isArray(req.body))return res.status(400).json({error:'Array erwartet'});db.adminJailRules=req.body;audit(db,req.user,'ADMIN_JAIL_UPDATED');saveDB(db);res.json(db.adminJailRules);});

app.get('/api/users',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>res.json(db.users.map(cleanUser)));
app.post('/api/users',auth,roles('PROJEKTLEITUNG'),async(req,res)=>{
  const {username,password,role,organizationId}=req.body||{};
  if(!username||!password||!['ADMIN','LEADER','PROJEKTLEITUNG'].includes(role)) return res.status(400).json({error:'Ungültige Benutzerdaten'});
  if(db.users.some(u=>u.username.toLowerCase()===username.toLowerCase())) return res.status(409).json({error:'Benutzer existiert bereits'});
  const u={id:randomUUID(),username,role,organizationId:role==='LEADER'?organizationId:null,active:true,passwordHash:await bcrypt.hash(password,12)}; db.users.push(u); audit(db,req.user,'USER_CREATED',username); saveDB(db); res.status(201).json(cleanUser(u));
});
app.patch('/api/users/:id',auth,roles('PROJEKTLEITUNG'),async(req,res)=>{const u=db.users.find(x=>x.id===req.params.id);if(!u)return res.status(404).json({error:'Benutzer nicht gefunden'});const {role,organizationId,active,password}=req.body||{};if(role)u.role=role;if(organizationId!==undefined)u.organizationId=organizationId;if(active!==undefined)u.active=!!active;if(password)u.passwordHash=await bcrypt.hash(password,12);audit(db,req.user,'USER_UPDATED',u.username);saveDB(db);res.json(cleanUser(u));});

app.get('/api/audit',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>res.json(db.audit));
app.post('/api/vehicles',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{const {name,category,image}=req.body||{};if(!name)return res.status(400).json({error:'Name erforderlich'});const v={id:randomUUID(),name,category:category||'Sonstiges',image:image||''};db.vehicles.push(v);audit(db,req.user,'VEHICLE_CREATED',name);saveDB(db);res.status(201).json(v);});
app.delete('/api/vehicles/:id',auth,roles('ADMIN','PROJEKTLEITUNG'),(req,res)=>{if(db.organizationVehicles.some(x=>x.vehicleId===req.params.id)||db.requests.some(x=>x.vehicleId===req.params.id&&!['ABGELEHNT'].includes(x.status)))return res.status(409).json({error:'Fahrzeug wird noch verwendet'});const i=db.vehicles.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Fahrzeug nicht gefunden'});const [v]=db.vehicles.splice(i,1);audit(db,req.user,'VEHICLE_DELETED',v.name);saveDB(db);res.json({ok:true});});
app.post('/api/reset-demo',auth,roles('PROJEKTLEITUNG'),(req,res)=>{db.requests=[];db.organizationVehicles=[];db.audit=[];saveDB(db);res.json({ok:true});});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
