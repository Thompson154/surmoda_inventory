interface AdminToggleProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function AdminToggle({ value, onChange }: AdminToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      ¿Es admin global? (sin asignación a tienda)
    </label>
  );
}
