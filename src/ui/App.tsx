import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { currentSnapshot } from "../core/model";
import type { Commit, DataRecord, Document, Snapshot } from "../core/model";
import {
  applyPlan,
  createWorkspace,
  deleteRecord,
  forkBranch,
  previewPlan,
  restoreCommit,
  saveRecord,
  switchBranch,
} from "../core/engine";
import type { FeaturePlan } from "../core/engine";
import { evaluate } from "../core/formula";
import { basePlan, propose, template } from "../planner/parse";
import {
  exportBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  Repository,
} from "../storage/repository";
import { Dialog } from "./Dialog";
import { ArrowIcon } from "./ArrowIcon";
import { FieldForm, NameForm, RecordForm } from "./forms";
import { Diff, MonthlyChart, PlanSamples } from "./previews";
import { compareSnapshots, recordTitle, valueText } from "./presentation";

type Modal =
  | "workspace"
  | "collection"
  | "field"
  | "record"
  | "branch"
  | "history"
  | "backup"
  | null;
const explain = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "The operation failed. Your previous data has been preserved.";
const totalRecords = (d: Document) =>
  d.workspaces.reduce(
    (n, w) =>
      n +
      currentSnapshot(w).collections.reduce((s, c) => s + c.records.length, 0),
    0,
  );
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="error">
      {error}
    </div>
  ) : null;
}
function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-detail">{children}</div>;
}
export function App() {
  const [repo, setRepo] = useState<Repository>();
  const [doc, setDoc] = useState<Document>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<DataRecord>();
  const [plan, setPlan] = useState<FeaturePlan>();
  const [request, setRequest] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("");
  const [notice, setNotice] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [stale, setStale] = useState(false);
  const [pendingImport, setPendingImport] = useState<Document>();
  const [compareId, setCompareId] = useState("");
  const w =
    doc?.workspaces.find((w) => w.id === workspaceId) ?? doc?.workspaces[0];
  const snapshot = w ? currentSnapshot(w) : { collections: [] };
  const c =
    snapshot.collections.find((c) => c.id === collectionId) ??
    snapshot.collections[0];
  const activeBranch = w?.branches.find((b) => b.id === w.activeBranchId);
  const latestRevision = useRef(doc?.revision);
  latestRevision.current = doc?.revision;

  useEffect(() => {
    let disposed = false;
    let opened: Repository | undefined;
    (async () => {
      try {
        opened = await Repository.open();
        if (disposed) {
          opened.close();
          return;
        }
        setRepo(opened);
        setDoc(await opened.load());
      } catch (e) {
        if (!disposed) setError(explain(e));
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
      opened?.close();
    };
  }, []);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    const check = () => {
      repo
        .load()
        .then((d) => {
          if (
            alive &&
            latestRevision.current &&
            d.revision !== latestRevision.current
          )
            setStale(true);
        })
        .catch((e) => {
          if (alive) setError(explain(e));
        });
    };
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("morph-changes")
        : undefined;
    if (channel) channel.onmessage = check;
    window.addEventListener("focus", check);
    return () => {
      alive = false;
      channel?.close();
      window.removeEventListener("focus", check);
    };
  }, [repo]);
  function openModal(value: Modal) {
    setError("");
    setModal(value);
    setNavOpen(false);
  }
  function closeModal() {
    if (!busy) {
      setModal(null);
      setPendingImport(undefined);
      setError("");
    }
  }
  async function persist(
    next: Document,
    message: string,
    preserve = false,
  ): Promise<boolean> {
    if (!repo || !doc || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await repo.save(next, doc.revision, preserve);
      setDoc(saved);
      setPlan(undefined);
      setStale(false);
      setNotice(message);
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("morph-changes");
        channel.postMessage("updated");
        channel.close();
      }
      return true;
    } catch (e) {
      setError(explain(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function refresh() {
    if (!repo) return;
    try {
      setDoc(await repo.load());
      setStale(false);
      setError("");
      setPlan(undefined);
      setNotice("Loaded the latest saved revision.");
    } catch (e) {
      setError(explain(e));
    }
  }
  function attemptPlan(factory: () => FeaturePlan) {
    try {
      setError("");
      setPlan(factory());
      setNotice("");
      setModal(null);
    } catch (e) {
      setError(explain(e));
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES)
        throw new Error("Backup exceeds the 5 MB limit.");
      setPendingImport(parseBackup(await file.text()));
      setError("");
    } catch (e) {
      setError(explain(e));
      setPendingImport(undefined);
    }
  }
  if (loading)
    return (
      <main className="boot">
        <span className="brand-mark">∞</span>
        <h1>Opening your workbench…</h1>
        <p>Reading local storage.</p>
      </main>
    );
  if (!doc)
    return (
      <main className="boot recovery">
        <span className="eyebrow">STORAGE RECOVERY</span>
        <h1>Your data comes first.</h1>
        <ErrorBox error={error} />
        <p>
          We couldn’t open a valid workspace. No existing data has been reset.
        </p>
        {repo && (
          <>
            <button
              onClick={async () => {
                try {
                  download(
                    await repo.rawRecovery(),
                    "morph-damaged-recovery.json",
                  );
                } catch (e) {
                  setError(explain(e));
                }
              }}
            >
              Download raw recovery copy
            </button>
            <label className="file-label">
              Choose a known-good native backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
            </label>
            {pendingImport && (
              <div className="import-preview">
                <p>
                  Restore {pendingImport.workspaces.length} workspaces and{" "}
                  {totalRecords(pendingImport)} records? The damaged state will
                  also be retained locally.
                </p>
                <button
                  onClick={async () => {
                    try {
                      setDoc(await repo.replaceDamagedData(pendingImport));
                      setError("");
                      setPendingImport(undefined);
                    } catch (e) {
                      setError(explain(e));
                    }
                  }}
                >
                  Restore this backup
                </button>
              </div>
            )}
          </>
        )}
        <button className="secondary" onClick={() => location.reload()}>
          Retry opening storage
        </button>
      </main>
    );

  const records = c
    ? c.records.filter((r) =>
        c.fields.some((f) =>
          valueText(f, c, r, snapshot)
            .text.toLowerCase()
            .includes(search.toLowerCase()),
        ),
      )
    : [];
  const sortField = c?.fields.find((f) => f.id === sort);
  if (c && sortField)
    records.sort((a, b) => {
      const rawA =
        sortField.type === "computed"
          ? evaluate(sortField.formula, c, a).value
          : a.values[sortField.id];
      const rawB =
        sortField.type === "computed"
          ? evaluate(sortField.formula, c, b).value
          : b.values[sortField.id];
      if (rawA == null) return rawB == null ? 0 : 1;
      if (rawB == null) return -1;
      return typeof rawA === "number" && typeof rawB === "number"
        ? rawA - rawB
        : String(rawA).localeCompare(String(rawB));
    });
  let preview: Snapshot | undefined;
  if (plan) {
    try {
      preview = previewPlan(doc, plan);
    } catch {
      /* Approval reruns validation and explains stale plans. */
    }
  }
  const selectedCommit = w?.commits.find((commit) => commit.id === compareId);
  function changes(target: Snapshot) {
    return compareSnapshots(snapshot, target);
  }
  function tryAction(action: () => Document, message: string) {
    try {
      return persist(action(), message);
    } catch (e) {
      setError(explain(e));
      return Promise.resolve(false);
    }
  }
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${navOpen ? "is-open" : ""}`}
        aria-label="Workspace explorer"
      >
        <a className="brand" href="#main" onClick={() => setNavOpen(false)}>
          <span className="brand-mark">∞</span>
          <span>
            Morph<span className="brand-sub">INFINITY 2.0</span>
          </span>
        </a>
        <div className="workspace-picker">
          <label htmlFor="workspace-select">WORKSPACE</label>
          <select
            id="workspace-select"
            value={w?.id ?? ""}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setCollectionId("");
              setPlan(undefined);
              setSearch("");
              setSort("");
            }}
          >
            {!w && <option value="">No workspace yet</option>}
            {doc.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="nav-button muted"
          onClick={() => openModal("workspace")}
        >
          ＋ New workspace
        </button>
        <div className="nav-heading">
          YOUR COLLECTIONS{" "}
          <button
            className="icon-button"
            aria-label="New collection"
            disabled={!w}
            onClick={() => openModal("collection")}
          >
            ＋
          </button>
        </div>
        <nav>
          {snapshot.collections.map((item) => (
            <button
              key={item.id}
              className={`nav-button ${item.id === c?.id ? "selected" : ""}`}
              onClick={() => {
                setCollectionId(item.id);
                setSearch("");
                setSort("");
                setPlan(undefined);
                setNavOpen(false);
              }}
            >
              ▤ <span>{item.name}</span>
              <span className="count">{item.records.length}</span>
            </button>
          ))}
        </nav>
        {!snapshot.collections.length && (
          <p className="sidebar-hint">A space for your next useful idea.</p>
        )}
        <div className="sidebar-bottom">
          <button className="nav-button" onClick={() => openModal("backup")}>
            <ArrowIcon /> Backups & recovery
          </button>
          <button
            className="nav-button"
            disabled={!w}
            onClick={() => {
              setCompareId("");
              openModal("history");
            }}
          >
            ◷ History & restore
          </button>
          <div className="local-badge">
            <span className="status-dot" /> On this device{" "}
            <small>No account. No cloud sync.</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button menu-toggle"
              aria-label="Toggle workspace explorer"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(!navOpen)}
            >
              ☰
            </button>
            <span>{w?.name ?? "Your workbench"}</span>
            <span className="crumb-slash">/</span>
            <strong>{c?.name ?? "Overview"}</strong>
          </div>
          <div className="topbar-actions">
            {w && (
              <>
                <label className="sr-only" htmlFor="branch-select">
                  Active branch
                </label>
                <select
                  className="branch-select"
                  id="branch-select"
                  value={w.activeBranchId}
                  disabled={busy}
                  onChange={(e) =>
                    void tryAction(
                      () => switchBranch(doc, w.id, e.target.value),
                      "Switched branch.",
                    )
                  }
                >
                  {w.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      ⑂ {b.name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary compact"
                  onClick={() => openModal("branch")}
                >
                  Fork branch
                </button>
              </>
            )}
            <span className="saved-state">
              <span className="status-dot" />
              {busy ? "Saving…" : "Saved locally"}
            </span>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">YOUR SOFTWARE, EVOLVING</span>
              <h1>
                {c?.name ?? "A little more possible."}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {c
                  ? "Make it yours. One useful change at a time."
                  : "Turn an idea into a tool you can keep shaping."}
              </p>
            </div>
            <span className="version-tag">EARLY BUILD · 0.1</span>
          </div>
          <ErrorBox error={modal ? "" : error} />
          {stale && (
            <div role="status" className="warning">
              Another tab has a newer revision.{" "}
              <button className="link-button" onClick={() => void refresh()}>
                Reload latest
              </button>
            </div>
          )}
          <div className="sr-only" role="status">
            {notice}
          </div>
          {notice && <div className="notice">✓ {notice}</div>}
          <section className="composer" aria-labelledby="composer-title">
            <div className="composer-top">
              <h2 id="composer-title">
                <span className="spark">✳</span> What would you like to make
                possible?
              </h2>
              <span className="quiet-tag">DETERMINISTIC PLANNER</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (w) attemptPlan(() => propose(doc, w, c?.id, request));
              }}
            >
              <label htmlFor="request" className="sr-only">
                Describe a change
              </label>
              <input
                id="request"
                value={request}
                maxLength={600}
                disabled={!w}
                onChange={(e) => setRequest(e.target.value)}
                placeholder={
                  w
                    ? c
                      ? "Try “Reading Speed = Pages Read / Minutes Read”"
                      : "Try “Build me a reading tracker”"
                    : "Create a workspace to get started"
                }
              />
              <button disabled={!w || busy || !request.trim()} type="submit">
                Preview change <ArrowIcon />
              </button>
            </form>
            <p>
              Every supported change starts with a preview. You decide what gets
              applied.
            </p>
            {w && (
              <div className="suggestions">
                {(c?.fields.some((f) => f.name === "Income")
                  ? ["Balance = Income - Expenses"]
                  : c?.fields.some((f) => f.name === "Pages Read")
                    ? [
                        "Calculate reading speed using pages read and minutes read",
                        "When I mark a book abandoned, record today's date",
                      ]
                    : ["Build me a reading tracker", "Create a budget"]
                ).map((text) => (
                  <button
                    key={text}
                    className="chip"
                    onClick={() => setRequest(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}
          </section>
          {!w ? (
            <section className="welcome">
              <div className="orb">∞</div>
              <span className="eyebrow">A WORKBENCH THAT GROWS WITH YOU</span>
              <h2>Start with something useful.</h2>
              <p>
                A reading list. A personal budget. A place to organize a small
                corner of life. Your data stays in your browser.
              </p>
              <button onClick={() => openModal("workspace")}>
                Create your first workspace <span>＋</span>
              </button>
              <div className="welcome-foot">
                <span>◉ Local-first</span>
                <span>⑂ Branch & restore</span>
                <span>✳ No AI required</span>
              </div>
            </section>
          ) : !c ? (
            <section className="template-section">
              <div className="section-title">
                <h2>Choose a starting point</h2>
                <span>Small tools. Room to grow.</span>
              </div>
              <div className="template-grid">
                {(["reading", "budget", "blank"] as const).map((kind, i) => (
                  <button
                    key={kind}
                    className="template-card"
                    onClick={() =>
                      kind === "blank"
                        ? openModal("collection")
                        : attemptPlan(() =>
                            basePlan(
                              doc,
                              w,
                              `Create ${kind === "reading" ? "Reading" : "Budget"} collection`,
                              [
                                {
                                  type: "addCollection",
                                  collection: template(kind),
                                },
                              ],
                            ),
                          )
                    }
                  >
                    <span className={`template-icon tone-${i}`}>
                      {["▤", "◈", "＋"][i]}
                    </span>
                    <h3>
                      {
                        [
                          "Reading tracker",
                          "Personal budget",
                          "Start from scratch",
                        ][i]
                      }
                    </h3>
                    <p>
                      {
                        [
                          "Books, progress, and the stories you keep.",
                          "Income, expenses, and a clearer picture.",
                          "A blank collection, shaped around your idea.",
                        ][i]
                      }
                    </p>
                    <span className="template-cta">
                      {kind === "blank"
                        ? "Create collection"
                        : "Preview template"}{" "}
                      <ArrowIcon />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="canvas" aria-label={`${c.name} collection`}>
              <div className="canvas-heading">
                <div className="view-tabs" aria-label="Collection view">
                  <button
                    aria-pressed={view === "table"}
                    onClick={() => setView("table")}
                  >
                    ▤ Table
                  </button>
                  <button
                    aria-pressed={view === "cards"}
                    onClick={() => setView("cards")}
                  >
                    ▦ Cards
                  </button>
                </div>
                <span className="record-count">
                  {c.records.length}{" "}
                  {c.records.length === 1 ? "record" : "records"}
                </span>
                <div className="canvas-actions">
                  <button
                    className="secondary"
                    onClick={() => openModal("field")}
                  >
                    ＋ Field
                  </button>
                  <button
                    onClick={() => {
                      setEditing(undefined);
                      openModal("record");
                    }}
                  >
                    ＋ Add record
                  </button>
                </div>
              </div>
              <div className="collection-tools">
                <label className="search-label">
                  <span className="sr-only">Filter records</span>
                  <input
                    type="search"
                    placeholder="Filter records…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label className="sort-label">
                  Sort{" "}
                  <select
                    aria-label="Sort records"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="">Creation order</option>
                    {c.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ↑
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="link-button"
                  onClick={() => {
                    setCompareId("");
                    openModal("history");
                  }}
                >
                  ◷ {w.commits.length} revisions
                </button>
              </div>
              {!c.records.length ? (
                <Empty>
                  <span className="empty-icon">▤</span>
                  <h3>Room for your first record.</h3>
                  <p>
                    Add something real. You can change the structure as you go.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(undefined);
                      openModal("record");
                    }}
                  >
                    Add your first record
                  </button>
                </Empty>
              ) : !records.length ? (
                <Empty>
                  <p>No records match this filter.</p>
                  <button className="secondary" onClick={() => setSearch("")}>
                    Clear filter
                  </button>
                </Empty>
              ) : view === "table" ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {c.fields.map((f) => (
                          <th key={f.id} scope="col">
                            <span className="field-kind">
                              {f.type === "computed" ? (
                                "ƒ"
                              ) : f.type === "number" ? (
                                "#"
                              ) : f.type === "date" ? (
                                "◷"
                              ) : f.type === "relation" ? (
                                <ArrowIcon size={12} />
                              ) : (
                                "Aa"
                              )}
                            </span>{" "}
                            {f.name}
                          </th>
                        ))}
                        <th scope="col">
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id}>
                          {c.fields.map((f) => {
                            const value = valueText(f, c, r, snapshot);
                            return (
                              <td
                                key={f.id}
                                className={
                                  f.type === "computed" ? "computed-cell" : ""
                                }
                              >
                                <span title={value.reason}>
                                  {f.type === "select" && r.values[f.id] ? (
                                    <span className="select-pill">
                                      {value.text}
                                    </span>
                                  ) : (
                                    value.text
                                  )}
                                </span>
                                {value.reason && (
                                  <small className="cell-reason">
                                    {value.reason}
                                  </small>
                                )}
                              </td>
                            );
                          })}
                          <td>
                            <button
                              className="icon-button"
                              aria-label={`Edit ${recordTitle(c, r)}`}
                              onClick={() => {
                                setEditing(r);
                                openModal("record");
                              }}
                            >
                              <ArrowIcon />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="record-grid">
                  {records.map((r) => (
                    <button
                      className="record-card"
                      key={r.id}
                      onClick={() => {
                        setEditing(r);
                        openModal("record");
                      }}
                    >
                      <h3>{recordTitle(c, r)}</h3>
                      <dl>
                        {c.fields
                          .filter((f) => f.id !== c.fields[0].id)
                          .map((f) => {
                            const value = valueText(f, c, r, snapshot);
                            return (
                              <div key={f.id}>
                                <dt>{f.name}</dt>
                                <dd>
                                  {value.text}
                                  {value.reason && (
                                    <small>{value.reason}</small>
                                  )}
                                </dd>
                              </div>
                            );
                          })}
                      </dl>
                      <span className="template-cta">
                        Edit record <ArrowIcon />
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="canvas-footer">
                <span>Changes are saved after each approved edit.</span>
                <span>INDEXEDDB · FORMAT 2</span>
              </div>
              {c.rules.map((rule) => (
                <MonthlyChart
                  key={rule.id}
                  collection={c}
                  fieldId={rule.setFieldId}
                />
              ))}
            </section>
          )}
          <footer className="page-footer">
            <span>
              <span className="status-dot" /> Private by default. Yours to
              export.
            </span>
            <span>
              Independent successor · Legacy import pending validation
            </span>
          </footer>
        </main>
      </div>
      {plan && (
        <Dialog
          title="Review your change"
          wide
          onClose={() => {
            setPlan(undefined);
            setError("");
          }}
        >
          <ErrorBox error={error} />
          <span className="eyebrow">PROPOSED CHANGE · NOT APPLIED</span>
          <h3 className="plan-title">{plan.summary}</h3>
          <ul className="diff-list">
            {preview ? (
              changes(preview).map((line, i) => <li key={i}>{line}</li>)
            ) : (
              <li>This plan is stale. Cancel and preview a fresh change.</li>
            )}
          </ul>
          <p className="help">
            Existing record values stay intact. Date rules apply to future
            transitions. Computed fields recalculate from your saved values.
          </p>
          {preview && <PlanSamples before={snapshot} after={preview} />}
          <details>
            <summary>Inspect typed plan</summary>
            <pre>{JSON.stringify(plan, null, 2)}</pre>
          </details>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setPlan(undefined)}>
              Cancel change
            </button>
            <button
              disabled={busy || !preview}
              onClick={() =>
                void tryAction(
                  () => applyPlan(doc, plan),
                  "Change applied and saved locally.",
                )
              }
            >
              Approve & apply
            </button>
          </div>
        </Dialog>
      )}
      {modal && (
        <Dialog
          title={
            {
              workspace: "Create a workspace",
              collection: "Create a collection",
              field: "Add a field",
              record: editing ? "Edit record" : "Add a record",
              branch: "Fork a branch",
              history: "History & restore",
              backup: "Backups & recovery",
            }[modal]
          }
          wide={modal === "history" || modal === "backup"}
          onClose={closeModal}
        >
          <ErrorBox error={error} />
          {modal === "workspace" && (
            <NameForm
              label="Workspace name"
              initial="My workspace"
              busy={busy}
              submit="Create workspace"
              onSubmit={async (name) => {
                try {
                  const next = createWorkspace(doc, name);
                  if (
                    await persist(
                      next,
                      "Workspace created. Choose a starting point.",
                    )
                  ) {
                    setWorkspaceId(next.workspaces.at(-1)!.id);
                    setCollectionId("");
                    closeModal();
                  }
                } catch (e) {
                  setError(explain(e));
                }
              }}
            />
          )}
          {modal === "collection" && w && (
            <NameForm
              label="Collection name"
              initial="My collection"
              busy={busy}
              submit="Preview collection"
              onSubmit={(name) =>
                attemptPlan(() =>
                  basePlan(doc, w, `Create ${name}`, [
                    {
                      type: "addCollection",
                      collection: template("blank", name),
                    },
                  ]),
                )
              }
            />
          )}
          {modal === "field" && w && c && (
            <FieldForm
              collection={c}
              snapshot={snapshot}
              onSubmit={(field) =>
                attemptPlan(() =>
                  basePlan(doc, w, `Add ${field.name}`, [
                    { type: "addField", collectionId: c.id, field },
                  ]),
                )
              }
            />
          )}
          {modal === "record" && w && c && (
            <RecordForm
              key={editing?.id ?? "new"}
              collection={c}
              snapshot={snapshot}
              record={editing}
              busy={busy}
              onSubmit={async (record) => {
                if (
                  await tryAction(
                    () => saveRecord(doc, w.id, c.id, record),
                    "Record saved locally.",
                  )
                )
                  closeModal();
              }}
              onDelete={
                editing
                  ? async () => {
                      if (
                        confirm(
                          "Delete this record? It will remain recoverable in history.",
                        )
                      ) {
                        if (
                          await tryAction(
                            () => deleteRecord(doc, w.id, c.id, editing.id),
                            "Record deleted. Previous revisions remain in history.",
                          )
                        )
                          closeModal();
                      }
                    }
                  : undefined
              }
            />
          )}
          {modal === "branch" && w && (
            <>
              <p className="help">
                Start an independent copy of “{activeBranch?.name}”. Existing
                records and ancestry are preserved. Changes on this branch won’t
                affect the original.
              </p>
              <NameForm
                label="Branch name"
                initial="Experiment"
                busy={busy}
                submit="Create branch"
                onSubmit={async (name) => {
                  if (
                    await tryAction(
                      () => forkBranch(doc, w.id, name),
                      "Branch created. You are editing the new branch.",
                    )
                  )
                    closeModal();
                }}
              />
            </>
          )}
          {modal === "history" && w && (
            <>
              <p className="help">
                Compare the current branch with a saved revision or another
                branch. Restores create a new revision; previous history is
                retained. Merging is not yet supported.
              </p>
              <label>
                Compare with branch
                <select value="" onChange={(e) => setCompareId(e.target.value)}>
                  <option value="">Choose a branch…</option>
                  {w.branches.map((b) => (
                    <option key={b.id} value={b.head}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="history-layout">
                <div className="history-list">
                  {[...w.commits].reverse().map((commit) => (
                    <button
                      key={commit.id}
                      className={compareId === commit.id ? "active" : ""}
                      onClick={() => setCompareId(commit.id)}
                    >
                      <span className="timeline-dot" />
                      <strong>{commit.message}</strong>
                      <small>
                        {new Date(commit.at).toLocaleString()} ·{" "}
                        {commit.id.slice(0, 6)}
                        {activeBranch?.head === commit.id ? " · current" : ""}
                      </small>
                    </button>
                  ))}
                </div>
                <div className="history-detail">
                  {selectedCommit ? (
                    <>
                      <h3>{selectedCommit.message}</h3>
                      <Diff lines={changes(selectedCommit.snapshot)} />
                      <p className="help">
                        Design only retains current record values and rejects
                        incompatible changes. Full restore replaces design and
                        records with this revision.
                      </p>
                      <div className="restore-buttons">
                        <button
                          disabled={busy}
                          className="secondary"
                          onClick={() => void restore(selectedCommit, "design")}
                        >
                          Restore design only
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void restore(selectedCommit, "full")}
                        >
                          Restore design + records
                        </button>
                      </div>
                    </>
                  ) : (
                    <Empty>Select a revision to compare and restore.</Empty>
                  )}
                </div>
              </div>
            </>
          )}
          {modal === "backup" && (
            <>
              <p className="help">
                Export a complete native backup with all workspaces, branches,
                records, and history. Keep files somewhere safe; browser storage
                can be cleared or evicted.
              </p>
              <div className="backup-summary">
                <strong>{doc.workspaces.length}</strong> workspaces{" "}
                <strong>{totalRecords(doc)}</strong> current-branch records
                <span>All branches included in export</span>
              </div>
              <button
                onClick={() =>
                  download(
                    exportBackup(doc),
                    `morph-infinity-${new Date().toISOString().slice(0, 10)}.json`,
                  )
                }
              >
                ↓ Export JSON backup
              </button>
              <hr />
              <h3>Restore from a backup</h3>
              <p className="help">
                Native format-2 backups only. Legacy v8 migration needs a real
                fixture and is not enabled.
              </p>
              <label className="file-label">
                Choose backup (maximum 5 MB)
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void importFile(e.target.files?.[0])}
                />
              </label>
              <button
                className="link-button"
                onClick={async () => {
                  try {
                    const previous = await repo?.beforeImport();
                    if (!previous)
                      throw new Error(
                        "No pre-import recovery copy is available yet.",
                      );
                    setPendingImport(previous);
                    setError("");
                  } catch (e) {
                    setError(explain(e));
                  }
                }}
              >
                Preview previous pre-import recovery copy
              </button>
              {pendingImport && (
                <div className="import-preview">
                  <h3>Preview replacement</h3>
                  <p>
                    {pendingImport.workspaces.length} workspaces ·{" "}
                    {totalRecords(pendingImport)} current-branch records · all
                    saved history included.
                  </p>
                  <p>
                    This replaces all current workspaces. A copy of your current
                    state will be retained locally before replacement.
                  </p>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await persist(
                          pendingImport,
                          "Backup restored. Previous state retained in recovery.",
                          true,
                        )
                      ) {
                        setWorkspaceId("");
                        setCollectionId("");
                        closeModal();
                      }
                    }}
                  >
                    Approve backup replacement
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setPendingImport(undefined)}
                  >
                    Cancel import
                  </button>
                </div>
              )}
            </>
          )}
        </Dialog>
      )}
    </div>
  );
  async function restore(commit: Commit, mode: "design" | "full") {
    if (
      !w ||
      !confirm(
        mode === "full"
          ? "Restore this revision’s design and records? Current edits remain recoverable in history."
          : "Restore this revision’s design while retaining current records? Incompatible changes will be rejected.",
      )
    )
      return;
    if (
      await tryAction(
        () => restoreCommit(doc!, w.id, commit.id, mode),
        mode === "full"
          ? "Design and historical records restored."
          : "Design restored; current records retained.",
      )
    )
      closeModal();
  }
}
