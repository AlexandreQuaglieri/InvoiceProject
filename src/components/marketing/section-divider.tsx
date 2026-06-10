import { SAPigeon } from '@/components/brand/street-art'

/**
 * Divider décoratif entre deux sections — avec, en option, le pigeon
 * pochoir perché sur la ligne (cf. maquette).
 */
export function SectionDivider({ pigeon = false }: { pigeon?: boolean }) {
  return (
    <div className="relative" aria-hidden="true">
      <hr className="border-t" />
      {pigeon && (
        <SAPigeon
          size={52}
          flip
          className="pointer-events-none absolute -bottom-px right-[9%] select-none text-foreground opacity-85"
        />
      )}
    </div>
  )
}
