import { warnaTipe } from '../../utils/tipeUnit'
export function TipeBadge({ tipe }) {
  if (!tipe) return null
  return (
    <span style={{
      marginLeft: 6, fontSize: 10, fontWeight: 700,
      padding: '2px 6px', borderRadius: 4,
      ...warnaTipe(tipe),
    }}>{tipe}</span>
  )
}
