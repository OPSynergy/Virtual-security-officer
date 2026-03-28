export function Card({ className = "", ...props }) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/60 shadow-xl shadow-black/20 backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}

export function CardHeader({ className = "", ...props }) {
  return <div className={`border-b border-zinc-800/80 px-5 py-4 ${className}`} {...props} />;
}

export function CardTitle({ className = "", ...props }) {
  return <h3 className={`text-base font-semibold tracking-tight text-zinc-100 ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }) {
  return <div className={`px-5 py-4 ${className}`} {...props} />;
}
