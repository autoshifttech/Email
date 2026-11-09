"use client";
import { useState } from "react";
import { api, useApi, timeAgo } from "@/lib/client";
import { AI_PRESETS } from "@/lib/ai-presets";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { PublicProvider } from "@/lib/serialize";

type Resp = { providers: PublicProvider[]; envFallback: boolean; envModel: string | null };
type Test = { ok: boolean; message: string; ms: number };

export default function AiPage() {
  const toast = useToast();
  const { data, loading, reload } = useApi<Resp>("/api/ai-providers");
  const [editing, setEditing] = useState<Partial<PublicProvider> | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (p: PublicProvider) => {
    setTesting(p.id);
    try {
      const r = await api<Test>(`/api/ai-providers/${p.id}/test`, { method: "POST" });
      toast(r.ok ? "success" : "error", r.ok ? `✅ Works (${r.ms} ms)` : `❌ ${r.message}`);
      reload();
    } finally {
      setTesting(null);
    }
  };
  const activate = async (p: PublicProvider) => {
    await api(`/api/ai-providers/${p.id}/activate`, { method: "POST" });
    toast("success", `${p.name} is now active`);
    reload();
  };
  const remove = async (p: PublicProvider) => {
    if (!confirm(`Delete "${p.name}" and its API key?`)) return;
    await api(`/api/ai-providers/${p.id}`, { method: "DELETE" });
    toast("success", "Deleted");
    reload();
  };

  return (
    <>
      <PageHeader
        title="AI Keys"
        subtitle="Manage the AI that summarizes emails and writes replies. Keys are encrypted and never shown again after saving."
        actions={<button className="btn btn-primary" onClick={() => setEditing({ preset: "groq" })}>+ Add AI key</button>}
      />
      <div className="panel p-4 mb-5 text-sm">
        <div className="font-semibold mb-1">🆓 Free options</div>
        <ul className="list-disc pl-5 space-y-0.5 muted">
          <li><b>Groq</b>: fast Llama models, free tier. Get a key at <a className="text-green-700 dark:text-green-400" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a></li>
          <li><b>Google Gemini</b>: generous free tier. Get a key at <a className="text-green-700 dark:text-green-400" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a></li>
          <li><b>OpenRouter</b>: free <code>:free</code> models. <b>Ollama</b>: run models on your own machine.</li>
        </ul>
        <p className="mt-2 muted">Add more than one and switch with a single click if one hits its rate limit.</p>
      </div>

      {loading && !data ? <Loading /> : !data?.providers.length ? (
        <Empty icon="🤖" title="No AI key yet" text={data?.envFallback ? `Using the key from the server's .env file (${data.envModel}). Add one here to manage it from the dashboard.` : "Without an AI key, emails are forwarded with a plain preview instead of a summary, and AI replies are disabled."} action={<button className="btn btn-primary" onClick={() => setEditing({ preset: "groq" })}>+ Add a free Groq key</button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.providers.map((p) => (
            <div key={p.id} className={`panel p-4 ${p.isActive ? "ring-2 ring-green-600" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                {p.isActive && <Badge color="green">● Active</Badge>}
                {p.lastTestOk === true && <Badge color="green">Tested OK</Badge>}
                {p.lastTestOk === false && <Badge color="red">Test failed</Badge>}
              </div>
              <div className="text-sm mt-2 space-y-0.5">
                <div><span className="muted">Model:</span> <code>{p.model}</code></div>
                <div className="truncate"><span className="muted">Endpoint:</span> <code className="text-xs">{p.baseUrl}</code></div>
                <div><span className="muted">API key:</span> {p.hasKey ? <code>{p.keyHint}</code> : <span className="muted">none</span>}</div>
                {p.lastTestedAt && <div className="text-xs muted">Last tested {timeAgo(p.lastTestedAt)}</div>}
                {p.lastError && p.lastTestOk === false && <div className="text-xs text-red-600 break-words">{p.lastError}</div>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-app">
                {!p.isActive && <button className="btn btn-sm btn-primary" onClick={() => activate(p)}>Use this</button>}
                <button className="btn btn-sm" disabled={testing === p.id} onClick={() => test(p)}>{testing === p.id && <Spinner />} Test</button>
                <button className="btn btn-sm" onClick={() => setEditing(p)}>✏️ Edit / change key</button>
                <button className="btn btn-sm btn-danger ml-auto" onClick={() => remove(p)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <ProviderForm p={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function ProviderForm({ p, onClose, onSaved }: { p: Partial<PublicProvider>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const initialPreset = AI_PRESETS.find((x) => x.id === p.preset) ?? AI_PRESETS[0];
  const [f, setF] = useState({
    preset: initialPreset.id,
    name: p.name ?? initialPreset.name,
    baseUrl: p.baseUrl ?? initialPreset.baseUrl,
    model: p.model ?? initialPreset.model,
    apiKey: "",
    isActive: false,
  });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<Test | null>(null);
  const preset = AI_PRESETS.find((x) => x.id === f.preset)!;

  const choose = (id: string) => {
    const pr = AI_PRESETS.find((x) => x.id === id)!;
    setF((x) => ({ ...x, preset: id, name: pr.name, baseUrl: pr.baseUrl, model: pr.model }));
    setTest(null);
  };
  const runTest = async () => {
    setTesting(true);
    try {
      setTest(await api<Test>("/api/ai-providers/test", { body: { id: p.id, baseUrl: f.baseUrl, model: f.model, apiKey: f.apiKey } }));
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setTesting(false);
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (p.id) await api(`/api/ai-providers/${p.id}`, { method: "PATCH", body: { name: f.name, preset: f.preset, baseUrl: f.baseUrl, model: f.model, apiKey: f.apiKey || undefined } });
      else await api("/api/ai-providers", { body: f });
      toast("success", "AI key saved");
      onSaved();
    } catch (err) {
      toast("error", (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={p.id ? "Edit AI provider" : "Add AI key"} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Provider">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {AI_PRESETS.map((x) => (
              <button type="button" key={x.id} onClick={() => choose(x.id)} className={`btn btn-sm justify-start ${f.preset === x.id ? "ring-2 ring-green-600" : ""}`}>
                {x.name} {x.free && <Badge color="green">free</Badge>}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs muted">{preset.note} {preset.keyUrl && <>Get a key: <a className="text-green-700 dark:text-green-400" href={preset.keyUrl} target="_blank" rel="noreferrer">{preset.keyUrl}</a></>}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Display name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Model">
            <input className="input" required list="models" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
            <datalist id="models">{preset.models.map((m) => <option key={m} value={m} />)}</datalist>
          </Field>
          <div className="sm:col-span-2">
            <Field label="API endpoint (OpenAI-compatible base URL)"><input className="input" required type="url" value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} /></Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={p.id ? `API key (leave blank to keep ${p.keyHint || "current"})` : "API key"}>
              <input className="input font-mono" type="password" autoComplete="off" required={!p.id && f.preset !== "ollama"} value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} placeholder="paste your key" />
            </Field>
          </div>
        </div>
        {!p.id && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> Make this the active AI</label>
        )}
        {test && <div className={`text-sm ${test.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>{test.ok ? "✅" : "❌"} {test.message} ({test.ms} ms)</div>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={runTest} disabled={testing}>{testing && <Spinner />} Test</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />} Save</button>
        </div>
      </form>
    </Modal>
  );
}
