import './ui.css'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

export default function Spinner({ size = 'md', color }: Props) {
  return (
    <span
      className={`ui-spinner ui-spinner-${size}`}
      style={color ? { borderTopColor: color, borderRightColor: color } : undefined}
      aria-label="Loading"
    />
  )
}
