export function ErrorBox({ error }: { error: string }) {
  return <p className="card border-[#f0c8c3] bg-[#fdf0ee] text-sm text-berry">{error}</p>;
}
