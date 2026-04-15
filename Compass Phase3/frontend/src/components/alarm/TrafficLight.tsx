interface Props {
  status: 'green' | 'yellow' | 'red' | 'gray'
  size?: number
}

const COLOR_MAP: Record<Props['status'], string> = {
  green: '#3a9458',
  yellow: '#d97706',
  red: '#dc2626',
  gray: '#c4bfb5',
}

export default function TrafficLight({ status, size = 12 }: Props) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: COLOR_MAP[status],
        flexShrink: 0,
      }}
    />
  )
}
