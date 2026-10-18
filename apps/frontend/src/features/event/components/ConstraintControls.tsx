import type { Hardness, Priority } from '../../../generated/constraint'
import { Select } from '../../../shared/ui/Input'

export function ConstraintControls({
  hardness,
  priority,
  onHardness,
  onPriority,
  label,
}: {
  hardness: Hardness
  priority: Priority
  onHardness: (value: Hardness) => void
  onPriority: (value: Exclude<Priority, null>) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex" role="group" aria-label={`${label}の強さ`}>
        {(
          [
            { value: 'hard', text: '必須', description: '必ず守る条件' },
            { value: 'soft', text: '任意', description: 'できるだけ守る条件' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.description}
            aria-pressed={hardness === option.value}
            onClick={() => onHardness(option.value)}
            className={`min-h-9 border border-line px-2.5 text-xs first:rounded-l-md last:rounded-r-md ${hardness === option.value ? 'bg-wash font-semibold text-brand' : 'bg-white text-muted'}`}
          >
            {option.text}
          </button>
        ))}
      </div>
      {hardness === 'soft' && (
        <Select
          aria-label={`${label}の優先度`}
          value={priority ?? 'mid'}
          onChange={(change) => {
            const value = change.target.value
            if (value === 'high' || value === 'mid' || value === 'low')
              onPriority(value)
          }}
        >
          <option value="high">優先度：高</option>
          <option value="mid">優先度：中</option>
          <option value="low">優先度：低</option>
        </Select>
      )}
    </div>
  )
}
