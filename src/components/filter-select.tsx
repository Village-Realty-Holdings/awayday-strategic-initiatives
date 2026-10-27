import { NativeSelect } from "@/components/ui/native-select";

/** Compact filter dropdown whose empty value means "all". */
export function FilterSelect({
  value,
  onChange,
  label,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <NativeSelect size="sm" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="px-2.5">
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>{render ? render(o) : o}</option>
      ))}
    </NativeSelect>
  );
}
