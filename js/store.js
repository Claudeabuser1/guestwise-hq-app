// The one place that talks to the data. Two backends with the same shape:
// Supabase (shared, with Google login) and demo (this device only, used until config.js is filled in).
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

const FIELDS = 'id, owner, area_id, parent_id, title, why, quick_start, steps, priority, done, done_at, done_by, source, created_by, created_at';

function supabaseStore(sb) {
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
  let me = null;
  return {
    demo: false,
    async session() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      me = u ? { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.email } : null;
      return me;
    },
    signIn: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } }),
    signOut: () => sb.auth.signOut(),
    async isMember() { return ok(await sb.rpc('is_member')) === true; },
    async load() {
      const [settings, areas, tasks, runs, members] = await Promise.all([
        sb.from('settings').select('focus_phase, brief').single(),
        sb.from('areas').select('id, owner, name, phase, position').order('position'),
        sb.from('tasks').select(FIELDS),
        sb.from('planner_runs').select('id, ran_at, trigger, ok, summary, changes, error').order('ran_at', { ascending: false }).limit(30),
        sb.from('members').select('email, name'),
      ]);
      return { settings: ok(settings), areas: ok(areas), tasks: ok(tasks), runs: ok(runs), members: ok(members) };
    },
    addTask: async (t) => ok(await sb.from('tasks').insert({ ...t, source: 'human' }).select(FIELDS).single()),
    updateTask: async (id, patch) => ok(await sb.from('tasks').update(patch).eq('id', id).select(FIELDS).single()),
    deleteTask: async (id) => ok(await sb.from('tasks').delete().eq('id', id)),
    addArea: async (a) => ok(await sb.from('areas').insert(a).select().single()),
    deleteArea: async (id) => ok(await sb.from('areas').delete().eq('id', id)),
    updateSettings: async (patch) => ok(await sb.from('settings').update(patch).eq('id', 1)),
    async planNow() {
      const { data, error } = await sb.functions.invoke('plan', { body: {} });
      if (error) {
        let msg = error.message;
        try { msg = (await error.context.json()).error || msg; } catch { /* keep the generic message */ }
        throw new Error(msg);
      }
      return data;
    },
    me: () => me,
  };
}

// ---------- demo: the starting plan, saved in this browser ----------
const KEY = 'gw-hq-demo-v1';
const ME = { id: 'demo-user', email: 'demo@guestwise.eu', name: 'Demo' };

function freshDemo({ AREAS, BRIEF, TASKS }) {
  const now = new Date();
  const ids = new Map(TASKS.map((t) => [t.key, crypto.randomUUID()]));
  const tasks = [];
  TASKS.forEach((t, i) => {
    const id = ids.get(t.key);
    const created = new Date(now.getTime() - (TASKS.length - i) * 36e5).toISOString();
    tasks.push({ id, owner: null, area_id: t.area, parent_id: null, title: t.title, why: t.why, quick_start: t.quick, steps: t.steps, priority: t.rank * 10, done: !!t.done, done_at: t.done ? created : null, done_by: t.done ? 'Demo' : null, source: 'human', created_by: 'Demo', created_at: created });
    (t.subs ?? []).forEach((s, j) => tasks.push({ id: crypto.randomUUID(), owner: null, area_id: t.area, parent_id: id, title: s.title, why: '', quick_start: s.quick ?? '', steps: [], priority: j + 1, done: false, done_at: null, done_by: null, source: 'human', created_by: 'Demo', created_at: created }));
  });
  return {
    settings: { focus_phase: 'launch', brief: BRIEF },
    areas: AREAS.map((a) => ({ ...a, owner: null })),
    tasks,
    runs: [{ id: crypto.randomUUID(), ran_at: now.toISOString(), trigger: 'manual', ok: true, summary: 'Demoläge: planeraren körs på riktigt när appen är kopplad till Supabase. Här ser du startplanen.', changes: { added: [] }, error: null }],
    members: [ME],
  };
}

function demoStore(seed) {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  db ??= freshDemo(seed);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage blocked: keep working in memory */ } };
  save();
  const find = (id) => db.tasks.find((t) => t.id === id);
  return {
    demo: true,
    session: async () => ME,
    signIn: async () => {}, signOut: async () => { localStorage.removeItem(KEY); location.reload(); },
    isMember: async () => true,
    load: async () => structuredClone(db),
    async addTask(t) {
      const parent = t.parent_id ? find(t.parent_id) : null;
      const row = { id: crypto.randomUUID(), why: '', quick_start: '', steps: [], priority: 1000, done: false, done_at: null, done_by: null, created_at: new Date().toISOString(), ...t,
        owner: parent ? parent.owner : (t.owner ?? null), area_id: parent ? parent.area_id : (t.area_id ?? null), source: 'human', created_by: ME.name };
      db.tasks.push(row); save(); return row;
    },
    async updateTask(id, patch) {
      const t = find(id);
      if ('done' in patch && patch.done !== t.done) Object.assign(t, patch.done ? { done_at: new Date().toISOString(), done_by: ME.name } : { done_at: null, done_by: null });
      Object.assign(t, patch); save(); return t;
    },
    async deleteTask(id) {
      const gone = new Set([id, ...db.tasks.filter((t) => t.parent_id === id).map((t) => t.id)]);
      db.tasks = db.tasks.filter((t) => !gone.has(t.id)); save();
    },
    async addArea(a) { const row = { id: crypto.randomUUID(), position: 100, phase: 'launch', ...a }; db.areas.push(row); save(); return row; },
    async deleteArea(id) { db.areas = db.areas.filter((a) => a.id !== id); db.tasks.forEach((t) => { if (t.area_id === id) t.area_id = null; }); save(); },
    async updateSettings(patch) { Object.assign(db.settings, patch); save(); },
    async planNow() { throw new Error('I demoläget finns ingen planerare. Koppla appen till Supabase (se SETUP.md).'); },
    me: () => ME,
  };
}

export async function createStore() {
  // the demo plan is only loaded in demo mode; the published app does not ship it
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return demoStore(await import('../seed-data.js').catch(() => ({ AREAS: [], BRIEF: '', TASKS: [] })));
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm');
  return supabaseStore(createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
}
