  import React, { useEffect, useMemo, useState } from "react";

const GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const INITIAL_STOCK = { "A+": 20, "A-": 6, "B+": 15, "B-": 0, "O+": 30, "O-": 5, "AB+": 12, "AB-": 0 };
const INITIAL_REQUESTS = [
  { id: 101, hospital: "SMS Hospital", group: "O+", units: 1, status: "Pending" },
  { id: 102, hospital: "Fortis Hospital", group: "B-", units: 2, status: "Pending" },
  { id: 103, hospital: "Rajasthan Hospital", group: "A+", units: 10, status: "Approved" },
];
const STORAGE_KEY = "raktsetu-bloodbank-demo-v2";
const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";
const primary = "rounded-xl bg-[#A61B2B] px-4 py-2.5 font-medium text-white hover:bg-red-800 disabled:opacity-50";
const secondary = "rounded-xl border border-[#A61B2B] px-4 py-2.5 font-medium text-[#A61B2B] hover:bg-red-50";
const field = "w-full rounded-xl border border-gray-300 bg-white p-2.5 focus:outline-none focus:ring-2 focus:ring-red-200";

function loadDemo() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (data && data.stock && Array.isArray(data.requests) && GROUPS.every(g => Number.isInteger(data.stock[g]) && data.stock[g] >= 0)) return data;
  } catch { /* use sample data */ }
  return { stock: INITIAL_STOCK, requests: INITIAL_REQUESTS };
}

function exportCSV(filename, headers, rows) {
  const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BloodBank() {
  const [data, setData] = useState(loadDemo);
  const { stock, requests } = data;
  const [page, setPage] = useState("Dashboard");
  const [group, setGroup] = useState("A+");
  const [units, setUnits] = useState("");
  const [operation, setOperation] = useState("add");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [requestGroupFilter, setRequestGroupFilter] = useState("All");
  const [requestSort, setRequestSort] = useState("newest");
  const [stockSort, setStockSort] = useState("group");
  const [stockFilter, setStockFilter] = useState("All");
  const [hospital, setHospital] = useState("");
  const [newRequestGroup, setNewRequestGroup] = useState("A+");
  const [newRequestUnits, setNewRequestUnits] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { setMessage("Browser storage is unavailable. Changes may not persist."); }
  }, [data]);

  const stockStatus = n => n === 0 ? "Out of stock" : n < 10 ? "Low stock" : "In stock";
  const totalUnits = Object.values(stock).reduce((sum, n) => sum + n, 0);
  const pending = requests.filter(r => r.status === "Pending").length;
  const approved = requests.filter(r => r.status === "Approved").length;
  const low = Object.values(stock).filter(n => n > 0 && n < 10).length;
  const out = Object.values(stock).filter(n => n === 0).length;
  const stockRows = useMemo(() => {
    let rows = GROUPS.map(g => ({ group: g, units: stock[g] }));
    if (stockFilter !== "All") rows = rows.filter(r => stockStatus(r.units) === stockFilter);
    return rows.sort((a, b) => stockSort === "highest" ? b.units - a.units : stockSort === "lowest" ? a.units - b.units : GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  }, [stock, stockSort, stockFilter]);

  const requestRows = useMemo(() => requests.filter(r =>
    (statusFilter === "All" || r.status === statusFilter) &&
    (requestGroupFilter === "All" || r.group === requestGroupFilter) &&
    (`REQ-${r.id} ${r.hospital} ${r.group}`.toLowerCase().includes(search.toLowerCase().trim()))
  ).sort((a, b) => requestSort === "oldest" ? a.id - b.id : requestSort === "units-high" ? b.units - a.units : requestSort === "units-low" ? a.units - b.units : b.id - a.id), [requests, search, statusFilter, requestGroupFilter, requestSort]);

  function adjustStock(e) {
    e.preventDefault();
    const n = Number(units);
    if (!Number.isSafeInteger(n) || n <= 0) return setMessage("Enter a valid positive whole number of units.");
    if (operation === "remove" && stock[group] < n) return setMessage("Cannot remove more units than available.");
    setData(prev => ({ ...prev, stock: { ...prev.stock, [group]: prev.stock[group] + (operation === "add" ? n : -n) } }));
    setUnits(""); setMessage(`${n} unit(s) ${operation === "add" ? "added to" : "removed from"} ${group} stock.`); setPage("Stock");
  }

  function handleRequest(id, action) {
    const request = requests.find(r => r.id === id);
    if (!request || request.status !== "Pending") return;
    if (action === "Approved" && stock[request.group] < request.units) return setMessage(`Insufficient ${request.group} stock to approve REQ-${id}.`);
    setData(prev => ({
      stock: action === "Approved" ? { ...prev.stock, [request.group]: prev.stock[request.group] - request.units } : prev.stock,
      requests: prev.requests.map(r => r.id === id && r.status === "Pending" ? { ...r, status: action } : r)
    }));
    setMessage(`REQ-${id} ${action.toLowerCase()}.`);
  }

  function createRequest(e) {
    e.preventDefault();
    const n = Number(newRequestUnits);
    if (!hospital.trim() || !Number.isSafeInteger(n) || n <= 0) return setMessage("Enter a hospital name and valid positive units.");
    const id = Math.max(100, ...requests.map(r => r.id)) + 1;
    setData(prev => ({ ...prev, requests: [...prev.requests, { id, hospital: hospital.trim(), group: newRequestGroup, units: n, status: "Pending" }] }));
    setHospital(""); setNewRequestUnits(""); setMessage(`REQ-${id} created.`); setPage("Requests");
  }

  function resetDemo() {
    if (!window.confirm("Reset all demo stock and requests?")) return;
    setData({ stock: { ...INITIAL_STOCK }, requests: INITIAL_REQUESTS.map(r => ({ ...r })) });
    setMessage("Demo data reset.");
  }

  const requestActions = r => r.status === "Pending" ? (
    <div className="flex flex-wrap gap-2">
      <button className={primary} onClick={() => handleRequest(r.id, "Approved")}>Approve</button>
      <button className={secondary} onClick={() => handleRequest(r.id, "Declined")}>Decline</button>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#FBFAF8] text-[#101828] md:flex">
      <aside className="bg-[#101828] p-6 text-white md:w-60 md:shrink-0">
        <h1 className="mb-7 text-2xl font-bold">🩸 RaktSetu</h1>
        <nav className="flex flex-wrap gap-2 md:flex-col" aria-label="Blood bank navigation">
          {["Dashboard", "Requests", "Stock", "Add Stock"].map(item => <button key={item} onClick={() => { setPage(item); setMessage(""); }} className={`rounded-xl px-4 py-3 text-left ${page === item ? "bg-[#A61B2B] text-white" : "text-gray-300 hover:bg-gray-700"}`}>{item}</button>)}
        </nav>
        <p className="mt-8 text-xs text-gray-400">Demo only · Browser-local data</p>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-2xl font-bold md:text-3xl">{page === "Dashboard" ? "Blood bank dashboard" : page}</h2><p className="mt-1 text-gray-500">Blood Bank Management · Sample data</p></div>
          <button className={primary} onClick={() => setPage("Add Stock")}>+ Update stock</button>
        </header>
        {message && <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"><span>{message}</span><button aria-label="Dismiss message" onClick={() => setMessage("")}>✕</button></div>}

        {page === "Dashboard" && <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[["Total blood units", totalUnits], ["Pending requests", pending], ["Approved requests", approved], ["Low-stock groups", low], ["Out-of-stock groups", out]].map(([label, value]) => <div key={label} className={card}><p className="text-sm text-gray-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></div>)}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <section className={card}><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-bold">Pending requests</h3><button className="text-sm font-medium text-[#A61B2B]" onClick={() => setPage("Requests")}>View all</button></div>
              {requests.filter(r => r.status === "Pending").length === 0 ? <p className="text-gray-500">No pending requests.</p> : requests.filter(r => r.status === "Pending").slice(0, 5).map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p className="font-semibold">REQ-{r.id} · {r.group} · {r.units} unit(s)</p><p className="text-sm text-gray-500">{r.hospital}</p></div>{requestActions(r)}</div>)}
            </section>
            <section className={card}><h3 className="mb-4 text-xl font-bold">Stock by blood group</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{GROUPS.map(g => <div key={g} className="rounded-xl border p-3 text-center"><p className="font-bold">{g}</p><p className="text-xl">{stock[g]}</p><p className={`text-xs ${stock[g] === 0 ? "text-red-700" : stock[g] < 10 ? "text-orange-700" : "text-green-700"}`}>{stockStatus(stock[g])}</p></div>)}</div><button className={`${secondary} mt-4 w-full`} onClick={() => setPage("Stock")}>Manage inventory</button></section>
          </div>
          <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-gray-600">🛡️ Demo dashboard. Real blood inventory requires verified records, expiry tracking, traceability, access controls and clinical checks before release.</div>
        </>}

        {page === "Requests" && <section className={card}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">Blood requests ({requestRows.length})</h3><button className={secondary} onClick={() => exportCSV("blood-requests.csv", ["Request ID", "Hospital", "Blood Group", "Units", "Status"], requestRows.map(r => [`REQ-${r.id}`, r.hospital, r.group, r.units, r.status]))}>Export CSV</button></div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">Search hospital or ID<input className={`${field} mt-1`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests" /></label>
            <label className="text-sm">Status<select className={`${field} mt-1`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>{["All", "Pending", "Approved", "Declined"].map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Blood group<select className={`${field} mt-1`} value={requestGroupFilter} onChange={e => setRequestGroupFilter(e.target.value)}>{["All", ...GROUPS].map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="text-sm">Sort by<select className={`${field} mt-1`} value={requestSort} onChange={e => setRequestSort(e.target.value)}><option value="newest">Newest ID first</option><option value="oldest">Oldest ID first</option><option value="units-high">Units: high to low</option><option value="units-low">Units: low to high</option></select></label>
          </div>
          <form onSubmit={createRequest} className="mb-6 rounded-xl bg-gray-50 p-4"><h4 className="mb-3 font-semibold">+ Create a demo request</h4><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-sm">Hospital name<input className={`${field} mt-1`} required maxLength={100} value={hospital} onChange={e => setHospital(e.target.value)} placeholder="Hospital name" /></label><label className="text-sm">Blood group<select className={`${field} mt-1`} value={newRequestGroup} onChange={e => setNewRequestGroup(e.target.value)}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label><label className="text-sm">Units<input className={`${field} mt-1`} type="number" min="1" step="1" required value={newRequestUnits} onChange={e => setNewRequestUnits(e.target.value)} /></label><div className="flex items-end"><button type="submit" className={`${primary} w-full`}>Create request</button></div></div></form>
          {requestRows.length === 0 ? <p className="text-gray-500">No requests match your filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-gray-50"><tr>{["Request", "Hospital", "Group", "Units", "Status", "Action"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{requestRows.map(r => <tr key={r.id} className="border-t"><td className="p-3 font-medium">REQ-{r.id}</td><td className="p-3">{r.hospital}</td><td className="p-3">{r.group}</td><td className="p-3">{r.units}</td><td className="p-3">{r.status}</td><td className="p-3">{requestActions(r)}</td></tr>)}</tbody></table></div>}
        </section>}

        {page === "Stock" && <section className={card}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">Blood stock inventory</h3><button className={secondary} onClick={() => exportCSV("blood-stock.csv", ["Blood Group", "Units", "Status"], stockRows.map(r => [r.group, r.units, stockStatus(r.units)]))}>Export CSV</button></div>
          <div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="text-sm">Stock status<select className={`${field} mt-1`} value={stockFilter} onChange={e => setStockFilter(e.target.value)}>{["All", "In stock", "Low stock", "Out of stock"].map(v => <option key={v}>{v}</option>)}</select></label><label className="text-sm">Sort by<select className={`${field} mt-1`} value={stockSort} onChange={e => setStockSort(e.target.value)}><option value="group">Blood group order</option><option value="highest">Units: high to low</option><option value="lowest">Units: low to high</option></select></label></div>
          {stockRows.length === 0 ? <p className="text-gray-500">No stock matches your filter.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{stockRows.map(r => <div key={r.group} className="rounded-xl border p-5 text-center"><h4 className="text-2xl font-bold">{r.group}</h4><p className="my-2 text-gray-600">{r.units} units</p><p className={r.units === 0 ? "text-red-700" : r.units < 10 ? "text-orange-700" : "text-green-700"}>{stockStatus(r.units)}</p><button className="mt-3 text-sm font-medium text-[#A61B2B] underline" onClick={() => { setGroup(r.group); setPage("Add Stock"); }}>Adjust</button></div>)}</div>}
          <button className={`${primary} mt-6`} onClick={() => setPage("Add Stock")}>+ Adjust blood stock</button>
        </section>}

        {page === "Add Stock" && <section className={`${card} max-w-xl`}><h3 className="mb-5 text-xl font-bold">Adjust blood stock</h3><form onSubmit={adjustStock} className="space-y-5"><label className="block">Blood group<select className={`${field} mt-2`} value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select></label><label className="block">Operation<select className={`${field} mt-2`} value={operation} onChange={e => setOperation(e.target.value)}><option value="add">Add units</option><option value="remove">Remove units (demo adjustment)</option></select></label><p className="text-sm text-gray-600">Available {group} stock: <strong>{stock[group]} units</strong></p><label className="block">Number of units<input className={`${field} mt-2`} type="number" min="1" step="1" required value={units} onChange={e => setUnits(e.target.value)} placeholder="Enter units" /></label><button className={`${primary} w-full`} type="submit">Save stock adjustment</button></form></section>}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500"><span>Local demo data only. No real patient or donor records.</span><button className="underline hover:text-red-700" onClick={resetDemo}>Reset demo data</button></div>
      </main>
    </div>
  );
}
