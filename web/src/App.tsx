import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './lib/api';
import { AuditEvent, CancellationRequest, Role, User } from './lib/types';

const statuses = ['Nouveau', 'En validation', 'Approuvé', 'Refusé', 'Exécuté', 'Archivé'] as const;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [pin, setPin] = useState('1111');
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [selected, setSelected] = useState<CancellationRequest | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [view, setView] = useState<'dashboard'|'create'|'kanban'|'list'|'archives'>('dashboard');
  const [lastSync, setLastSync] = useState('');
  const [pollSeconds, setPollSeconds] = useState(20);

  useEffect(() => { api.me().then(setUser).catch(()=>{}); }, []);

  const refresh = async (incremental = true) => {
    try {
      const res = await api.list(incremental && lastSync ? lastSync : undefined);
      setPollSeconds(res.pollIntervalSeconds);
      setRequests((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        res.items.forEach((r) => map.set(r.id, r));
        return Array.from(map.values()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
      });
      setLastSync(new Date().toISOString());
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => { if (user) refresh(false); }, [user]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => refresh(true), Math.min(30, Math.max(10, pollSeconds))*1000);
    return () => clearInterval(t);
  }, [user, pollSeconds, lastSync]);

  const kpi = useMemo(() => ({
    nouveau: requests.filter(r=>r.status==='Nouveau').length,
    validation: requests.filter(r=>r.status==='En validation').length,
    urgent: requests.filter(r=>r.urgent && r.status!=='Archivé').length,
    today: requests.filter(r=>r.request_date_time.slice(0,10)===new Date().toISOString().slice(0,10)).length
  }), [requests]);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.login(pin);
      api.setToken(res.token);
      setUser(res.user);
      setError('');
    } catch (err) { setError((err as Error).message); }
  };

  if (!user) return <div className='center'><form onSubmit={login} className='card'><h1>Login PIN</h1><input value={pin} onChange={e=>setPin(e.target.value)} /><button>Entrer</button><p>{error}</p></form></div>;

  return <div className='layout'>
    <header><h1>Annulation Commandes – Temps Réel</h1><div>{user.name} ({user.role}) <button onClick={()=>{api.logout();location.reload();}}>Déconnexion</button></div></header>
    <nav>
      {['dashboard','create','kanban','list','archives'].map(v=><button key={v} onClick={()=>setView(v as any)}>{v}</button>)}
      <button onClick={()=>refresh(false)}>Rafraîchir</button>
      <span>Dernière sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : '-'}</span>
    </nav>
    {!import.meta.env.VITE_TEAMS_WEBHOOK_URL && <div className='notice'>Notifications désactivées (config manquante)</div>}
    {view==='dashboard' && <section className='grid4'>
      <Card label='Nouveau' value={kpi.nouveau}/><Card label='En validation' value={kpi.validation}/><Card label='Urgent' value={kpi.urgent}/><Card label='Aujourd’hui' value={kpi.today}/>
    </section>}
    {view==='create' && <CreateForm role={user.role} onCreated={(r)=>{setRequests([r,...requests]); setView('kanban');}} onError={setError} />}
    {view==='kanban' && <Kanban requests={requests} role={user.role} onSelect={async (r)=>{setSelected(r); setAudit((await api.audit(r.id)).items);}} onStatus={async (id,status,note,refusal)=>{await api.patchStatus(id,status,note,refusal); refresh(false);}} />}
    {view==='list' && <ListView requests={requests} onSelect={async (r)=>{setSelected(r); setAudit((await api.audit(r.id)).items);}} />}
    {view==='archives' && <ListView requests={requests.filter(r=>r.status==='Archivé')} onSelect={async (r)=>{setSelected(r); setAudit((await api.audit(r.id)).items);}} />}
    {selected && <Detail request={selected} audit={audit} role={user.role} onClose={()=>setSelected(null)} onRefresh={()=>refresh(false)} />}
    {error && <p className='error'>{error}</p>}
  </div>;
}

function Card({label,value}:{label:string;value:number}){return <div className='card'><h3>{label}</h3><strong>{value}</strong></div>;}

function CreateForm({role,onCreated,onError}:{role:Role;onCreated:(r:CancellationRequest)=>void;onError:(e:string)=>void}){
  const [form, setForm] = useState<any>({ so_number:'', client_name:'', requested_by:'', cancellation_location:'Laval', reason:'Client cancel', reason_details:'', request_date_time:new Date().toISOString().slice(0,16), urgent:false, bill_transport:false, carrier:'', line_items:[{product_sku_or_name:'',qty:1}] });
  if (role==='viewer') return <p>Lecture seule.</p>;
  const submit = async (e:FormEvent)=>{e.preventDefault(); try{ if(!form.line_items[0].product_sku_or_name) throw new Error('Ajouter au moins un item'); const payload={...form, request_date_time:new Date(form.request_date_time).toISOString()}; const created=await api.create(payload); onCreated(created);}catch(err){onError((err as Error).message)}};
  return <form className='card' onSubmit={submit}><h2>Créer demande</h2>
    {['so_number','client_name','requested_by'].map(k=><input key={k} placeholder={k} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})} required />)}
    <select value={form.cancellation_location} onChange={e=>setForm({...form,cancellation_location:e.target.value})}><option>Laval</option><option>Laval2</option><option>Langelier</option><option>Autre</option></select>
    <select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}><option>Client cancel</option><option>Erreur de qty</option><option>Zéro pick</option><option>Client n’est jamais venu chercher</option><option>Service clientèle</option></select>
    <textarea placeholder='Détails optionnels' value={form.reason_details} onChange={e=>setForm({...form,reason_details:e.target.value})}/>
    <label><input type='checkbox' checked={form.urgent} onChange={e=>setForm({...form,urgent:e.target.checked})}/>Urgent</label>
    <label><input type='checkbox' checked={form.bill_transport} onChange={e=>setForm({...form,bill_transport:e.target.checked})}/>Facturer transport</label>
    {form.bill_transport && <input placeholder='carrier' value={form.carrier} onChange={e=>setForm({...form,carrier:e.target.value})} required />}
    <input type='datetime-local' value={form.request_date_time} onChange={e=>setForm({...form,request_date_time:e.target.value})}/>
    {form.line_items.map((li:any,idx:number)=><div key={idx}><input placeholder='Produit' value={li.product_sku_or_name} onChange={e=>{const n=[...form.line_items];n[idx].product_sku_or_name=e.target.value;setForm({...form,line_items:n});}}/><input type='number' min={1} value={li.qty} onChange={e=>{const n=[...form.line_items];n[idx].qty=Number(e.target.value);setForm({...form,line_items:n});}}/></div>)}
    <button type='button' onClick={()=>setForm({...form,line_items:[...form.line_items,{product_sku_or_name:'',qty:1}]})}>Ajouter ligne</button>
    <button type='submit'>Soumettre</button>
  </form>
}

function Kanban({requests,role,onSelect,onStatus}:{requests:CancellationRequest[];role:Role;onSelect:(r:CancellationRequest)=>void;onStatus:(id:string,s:string,n?:string,r?:string)=>void}){
  return <div className='kanban'>{statuses.map(s=><div key={s} className='col'><h3>{s}</h3>{requests.filter(r=>r.status===s).map(r=><div key={r.id} className='card' onClick={()=>onSelect(r)}><b>{r.so_number}</b><div>{r.client_name}</div>{r.urgent&&<span className='urgent'>URGENT</span>}<small>{r.cancellation_location}</small>
    {role==='approver' && <div>{s==='Nouveau'&&<button onClick={e=>{e.stopPropagation();onStatus(r.id,'En validation');}}>Prendre en charge</button>}{s==='En validation'&&<><button onClick={e=>{e.stopPropagation();onStatus(r.id,'Approuvé');}}>Approuver</button><button onClick={e=>{e.stopPropagation();const m=prompt('Motif refus')||'';if(m)onStatus(r.id,'Refusé',undefined,m);}}>Refuser</button></>}{(s==='Approuvé'||s==='Refusé')&&<button onClick={e=>{e.stopPropagation();const n=prompt('Note exécution')||'';onStatus(r.id,'Exécuté',n);}}>Marquer Exécuté</button>}</div>}
  </div>)}</div>)}</div>
}

function ListView({requests,onSelect}:{requests:CancellationRequest[];onSelect:(r:CancellationRequest)=>void}){
  return <table><thead><tr><th>Date</th><th>SO</th><th>Client</th><th>Statut</th><th>Urgent</th><th>Site</th><th>Transport</th><th>Demandeur</th><th>Action</th></tr></thead><tbody>{requests.map(r=><tr key={r.id} onClick={()=>onSelect(r)}><td>{new Date(r.request_date_time).toLocaleString()}</td><td>{r.so_number}</td><td>{r.client_name}</td><td>{r.status}</td><td>{r.urgent?'Oui':'Non'}</td><td>{r.cancellation_location}</td><td>{r.bill_transport?'Oui':'Non'} {r.carrier||''}</td><td>{r.requested_by}</td><td>{r.lastAction}</td></tr>)}</tbody></table>
}

function Detail({request,audit,role,onClose,onRefresh}:{request:CancellationRequest;audit:AuditEvent[];role:Role;onClose:()=>void;onRefresh:()=>void}){
  const [msg,setMsg]=useState('');
  const upload = async (f:File)=>{const b=await f.arrayBuffer(); const base64=btoa(String.fromCharCode(...new Uint8Array(b))); await api.attach(request.id,f.name,f.type,base64); onRefresh();};
  return <aside className='detail'><button onClick={onClose}>Fermer</button><h2>{request.so_number}</h2><p>{request.client_name} - {request.status}</p><p>Articles: {request.line_items.map(i=>`${i.product_sku_or_name} x${i.qty}`).join(', ')}</p>
    <h4>Pièces jointes</h4><ul>{request.attachments.map(a=><li key={a.id}><a href={a.url} target='_blank'>{a.fileName}</a></li>)}</ul>
    {role!=='viewer' && <input type='file' onChange={e=>e.target.files?.[0] && upload(e.target.files[0])} />}
    <h4>Commentaires</h4><ul>{request.comments.map(c=><li key={c.id}>{c.userName}: {c.message}</li>)}</ul>
    {role!=='viewer' && <div><input value={msg} onChange={e=>setMsg(e.target.value)} /><button onClick={async()=>{await api.comment(request.id,msg); setMsg(''); onRefresh();}}>Ajouter</button></div>}
    <button onClick={()=>navigator.clipboard.writeText(`SO ${request.so_number} | ${request.client_name} | ${request.status}`)}>Copier résumé</button>
    <h4>Audit</h4><ul>{audit.map(a=><li key={a.id}>{new Date(a.timestamp).toLocaleString()} - {a.userName} - {a.action} {a.fromStatus||''}→{a.toStatus||''} {a.note||''}</li>)}</ul>
  </aside>
}
