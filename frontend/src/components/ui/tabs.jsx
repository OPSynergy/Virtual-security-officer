export function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950/50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            activeTab === tab
              ? "bg-zinc-800 text-zinc-100 shadow-inner shadow-black/40"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
