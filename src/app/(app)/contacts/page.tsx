"use client";
import { useMemo, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";

type Contact = { id: string; name: string; email: string; tags: string; groups: { id: string; name: string }[] };
type Group = { id: string; name: string; description: string; contactIds: string[]; memberCount: number };

export default function ContactsPage() {
  const toast = useToast();
  const { data: contacts, reload: reloadC, loading } = useApi<Contact[]>("/api/contacts");
  const { data: groups, reload: reloadG } = useApi<Group[]>("/api/groups");
  const [q, setQ] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [editC, setEditC] = useState<Partial<Contact> & { groupIds?: string[] } | null>(null);
  const [editG, setEditG] = useState<Partial<Group> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const reload = () => { reloadC(); reloadG(); };

  const filtered = useMemo(() => (contacts ?? []).filter((c) =>
    (!q || `${c.name} ${c.email} ${c.tags}`.toLowerCase().includes(q.toLowerCase())) &&
    (!groupFilter || c.groups.some((g) => g.id === groupFilter))), [contacts, q, groupFilter]);

  const delContact = async (c: Contact) => {
    if (!confirm(`Delete ${c.email}?`)) return;
    await api(`/api/contacts/${c.id}`, { method: "DELETE" });
    toast("success", "Contact deleted");
    reload();
  };
  const delGroup = async (g: Group) => {
    if (!confirm(`Delete group "${g.name}"? Contacts are kept.`)) return;
    await api(`/api/groups/${g.id}`, { method: "DELETE" });
    toast("success", "Group deleted");
    if (groupFilter === g.id) setGroupFilter("");
    reload();
  };

  return (
    <>
      <PageHeader
        title="Contacts & Groups"
        subtitle="People you can email from the dashboard or WhatsApp. Use a group name or “all” to send to many at once."
        actions={<>
          <button className="btn" onClick={() => setImportOpen(true)}>⬆ Import CSV</button>
          <button className="btn" onClick={() => setEditG({ name: "", description: "", contactIds: [] })}>+ Group</button>
          <button className="btn btn-primary" onClick={() => setEditC({ name: "", email: "", tags: "", groupIds: groupFilter ? [groupFilter] : [] })}>+ Contact</button>
        </>}
      />
      <div className="grid lg:grid-cols-4 gap-5">
        <div className="panel p-3 h-fit">
          <div className="label px-2 pt-1">Groups</div>
          <button onClick={() => setGroupFilter("")} className={`w-full text-left rounded-lg px-3 py-2 text-sm ${!groupFilter ? "bg-green-50 dark:bg-green-900/30 font-semibold" : ""}`}>All contacts <span className="muted">({contacts?.length ?? 0})</span></button>
          {groups?.map((g) => (
            <div key={g.id} className={`group flex items-center rounded-lg ${groupFilter === g.id ? "bg-green-50 dark:bg-green-900/30" : ""}`}>
              <button onClick={() => setGroupFilter(g.id)} className={`flex-1 text-left px-3 py-2 text-sm ${groupFilter === g.id ? "font-semibold" : ""}`}>{g.name} <span className="muted">({g.memberCount})</span></button>
              <button className="px-1 text-xs muted hover:text-current" title="Edit" onClick={() => setEditG(g)}>✏️</button>
              <button className="px-2 text-xs muted hover:text-red-600" title="Delete" onClick={() => delGroup(g)}>🗑</button>
            </div>
          ))}
          {!groups?.length && <p className="text-xs muted px-3 py-2">No groups yet.</p>}
        </div>
        <div className="lg:col-span-3">
          <input className="input mb-3" placeholder="🔍 Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
          {loading && !contacts ? <Loading /> : !filtered.length ? (
            <Empty icon="👥" title="No contacts" text="Add contacts one by one or import a CSV (name,email per line)." />
          ) : (
            <div className="panel overflow-hidden">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-app last:border-0">
                  <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-bold text-blue-800 dark:text-blue-300 shrink-0">{(c.name || c.email).slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name || "—"}</div>
                    <div className="text-sm muted truncate">{c.email}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{c.groups.map((g) => <Badge key={g.id} color="green">{g.name}</Badge>)}{c.tags && c.tags.split(/[ ,]+/).filter(Boolean).map((t) => <Badge key={t}>{t}</Badge>)}</div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setEditC({ ...c, groupIds: c.groups.map((g) => g.id) })}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => delContact(c)}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {editC && <ContactForm c={editC} groups={groups ?? []} onClose={() => setEditC(null)} onSaved={() => { setEditC(null); reload(); }} />}
      {editG && <GroupForm g={editG} contacts={contacts ?? []} onClose={() => setEditG(null)} onSaved={() => { setEditG(null); reload(); }} />}
      {importOpen && <ImportForm groups={groups ?? []} onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); reload(); }} />}
    </>
  );
}

function ContactForm({ c, groups, onClose, onSaved }: { c: Partial<Contact> & { groupIds?: string[] }; groups: Group[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: c.name ?? "", email: c.email ?? "", tags: c.tags ?? "", groupIds: c.groupIds ?? [] });
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (c.id) await api(`/api/contacts/${c.id}`, { method: "PATCH", body: f });
      else await api("/api/contacts", { body: f });
      toast("success", "Contact saved");
      onSaved();
    } catch (err) {
      toast("error", (err as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={c.id ? "Edit contact" : "New contact"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Tags" hint="Optional, space separated"><input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        {groups.length > 0 && (
          <Field label="Groups">
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = f.groupIds.includes(g.id);
                return <button type="button" key={g.id} className={`btn btn-sm ${on ? "btn-primary" : ""}`} onClick={() => setF({ ...f, groupIds: on ? f.groupIds.filter((x) => x !== g.id) : [...f.groupIds, g.id] })}>{on ? "✓ " : ""}{g.name}</button>;
              })}
            </div>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy && <Spinner />} Save</button></div>
      </form>
    </Modal>
  );
}

function GroupForm({ g, contacts, onClose, onSaved }: { g: Partial<Group>; contacts: Contact[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: g.name ?? "", description: g.description ?? "", contactIds: g.contactIds ?? [] });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (g.id) await api(`/api/groups/${g.id}`, { method: "PATCH", body: f });
      else await api("/api/groups", { body: f });
      toast("success", "Group saved");
      onSaved();
    } catch (err) {
      toast("error", (err as Error).message);
      setBusy(false);
    }
  };
  const list = contacts.filter((c) => !q || `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open onClose={onClose} title={g.id ? "Edit group" : "New group"}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Group name" hint={'Used on WhatsApp too, e.g. "new team | ..."'}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Description"><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label={`Members (${f.contactIds.length})`}>
          <input className="input mb-2" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-60 overflow-y-auto panel">
            {list.map((c) => {
              const on = f.contactIds.includes(c.id);
              return (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-app last:border-0 cursor-pointer">
                  <input type="checkbox" checked={on} onChange={() => setF({ ...f, contactIds: on ? f.contactIds.filter((x) => x !== c.id) : [...f.contactIds, c.id] })} />
                  <span className="truncate">{c.name || c.email} <span className="muted">{c.name && c.email}</span></span>
                </label>
              );
            })}
            {!list.length && <p className="p-3 text-xs muted">No contacts.</p>}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy && <Spinner />} Save</button></div>
      </form>
    </Modal>
  );
}

function ImportForm({ groups, onClose, onDone }: { groups: Group[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [csv, setCsv] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (f?: File) => f && setCsv(await f.text());
  const submit = async () => {
    setBusy(true);
    try {
      const r = await api<{ created: number; updated: number }>("/api/contacts/import", { body: { csv, groupId: groupId || undefined } });
      toast("success", `Imported: ${r.created} new, ${r.updated} updated`);
      onDone();
    } catch (e) {
      toast("error", (e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Import contacts">
      <div className="space-y-3">
        <p className="text-sm muted">Upload a CSV or paste lines like <code>John Smith, john@example.com</code>. Lines without an email are skipped.</p>
        <input type="file" accept=".csv,.txt" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
        <textarea className="input font-mono text-xs" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"name,email\nJohn Smith,john@example.com\nPriya,priya@example.com"} />
        <Field label="Add to group (optional)">
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">— none —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!csv || busy} onClick={submit}>{busy && <Spinner />} Import</button></div>
      </div>
    </Modal>
  );
}
