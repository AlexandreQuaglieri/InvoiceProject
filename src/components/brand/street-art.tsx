/**
 * Pictogrammes street-art (pochoir) — portés depuis le handoff design
 * (design-refs/extract/facturation-quatools/project/onboarding/street-art.jsx).
 *
 * Style : silhouettes pleines monochromes façon pochoir, coulures discrètes,
 * projections de bombe. Les motifs héritent de la couleur du texte via
 * `fill="currentColor"` ; les « trous » de pochoir utilisent le token
 * `var(--background)` pour rester lisibles en clair comme en sombre.
 *
 * Usage : <SAPlane size={120} className="text-muted-foreground" flip />
 * — `size` pilote la largeur, la hauteur est dérivée du ratio du viewBox.
 * Composants purement présentationnels (server-safe, pas de 'use client').
 */

export type StreetArtProps = {
  size?: number;
  className?: string;
  flip?: boolean;
};

const SA_BG = "var(--background)";

function flipStyle(flip: boolean): React.CSSProperties | undefined {
  return flip ? { transform: "scaleX(-1)" } : undefined;
}

/* petites projections de bombe autour d'un motif */
function Speckles({ dots }: { dots: ReadonlyArray<readonly [number, number, number]> }) {
  return (
    <g opacity="0.55">
      {dots.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

/* coulure de peinture */
function Drip({ x, y, h = 12, w = 1.6 }: { x: number; y: number; h?: number; w?: number }) {
  return (
    <path
      d={`M${x - w / 2} ${y} q${w * 0.2} ${h * 0.55} 0 ${h * 0.8} q ${-w * 0.55} ${h * 0.25} ${-w * 0.1} ${-h * 0.05} q ${-w * 0.4} ${-h * 0.5} ${w * 0.6 - w} ${-h * 0.75} Z`}
      opacity="0.8"
    />
  );
}

/* ---------- 1. Avion en papier (la facture qui part) ---------- */
export function SAPlane({ size = 120, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 120 70"
      width={size}
      height={size * (70 / 120)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* traînée */}
      <g opacity="0.7">
        <path
          d="M4 52 q14 -7 26 -4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="7 7"
        />
        <path
          d="M14 62 q18 -8 30 -6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 8"
        />
      </g>
      {/* avion : corps + aile avec pont de pochoir */}
      <path d="M48 38 L112 8 L88 52 L72 42 Z" />
      <path d="M48 38 L84 26 L70 40 Z" opacity="0.45" />
      <path d="M72 44 L78 58 L82 47 Z" />
      <Drip x={90} y={50} h={11} />
      <Speckles dots={[[44, 28, 1.1], [104, 22, 0.9], [60, 56, 0.8], [110, 40, 1.2], [52, 14, 0.7]]} />
    </svg>
  );
}

/* ---------- 2. Rat coursier (enveloppe sur le dos) ---------- */
export function SARat({ size = 110, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 120 70"
      width={size}
      height={size * (70 / 120)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* corps profil, museau à gauche */}
      <path
        d="M12 50
           C16 42 26 36 36 35
           C44 26 62 23 74 30
           C86 36 88 48 80 54
           L78 62 L72 62 L72 56
           C62 59 48 59 40 56
           L39 62 L33 62 L34 55
           C24 55 14 56 12 50 Z"
      />
      {/* oreille */}
      <circle cx="36" cy="31" r="5" />
      {/* œil = trou de pochoir */}
      <circle cx="24" cy="44" r="2.2" fill={SA_BG} />
      {/* queue */}
      <path
        d="M86 48 C100 42 102 56 116 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* enveloppe sanglée sur le dos */}
      <g transform="rotate(-7 62 18)">
        <rect x="50" y="10" width="24" height="16" rx="1.5" />
        <path d="M50.8 12 L62 21.5 L73.2 12" fill="none" stroke={SA_BG} strokeWidth="1.8" />
      </g>
      <Drip x={20} y={56} h={10} />
      <Speckles dots={[[8, 36, 1], [94, 60, 1.1], [70, 6, 0.8], [108, 38, 0.9]]} />
    </svg>
  );
}

/* ---------- 3. Pigeon perché (à poser sur le bord d'une carte) ---------- */
export function SAPigeon({ size = 64, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 80 64"
      width={size}
      height={size * (64 / 80)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* corps dodu, queue à gauche, tête à droite */}
      <path
        d="M6 38
           C12 28 26 22 40 23
           C46 14 58 14 60 22
           C66 24 68 30 64 32
           C66 42 58 50 44 51
           L24 48 L6 44 Z"
      />
      {/* bec */}
      <path d="M64 24 L72 27 L63 30 Z" />
      {/* œil = trou */}
      <circle cx="56" cy="24" r="1.8" fill={SA_BG} />
      {/* aile en réserve */}
      <path d="M22 32 C30 28 42 28 48 33 C42 40 28 40 22 32 Z" fill={SA_BG} opacity="0.35" />
      {/* pattes posées sur la ligne y=60 */}
      <path
        d="M36 51 L34 60 M42 51 L42 60 M30 60 L38 60 M38 60 L46 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Speckles dots={[[12, 22, 0.9], [70, 40, 0.9], [26, 56, 0.7]]} />
    </svg>
  );
}

/* ---------- 4. Colis parachuté (le paiement qui arrive) ---------- */
export function SAParachute({ size = 90, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 90 110"
      width={size}
      height={size * (110 / 90)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* voile */}
      <path d="M10 34 C12 12 78 12 80 34 L66 34 C66 28 58 28 56 34 L48 34 C48 28 42 28 40 34 L32 34 C32 28 24 28 22 34 Z" />
      {/* suspentes */}
      <path
        d="M14 36 L34 64 M76 36 L56 64 M45 34 L45 62"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* caisse */}
      <rect x="30" y="62" width="30" height="24" rx="2" />
      <text
        x="45"
        y="80"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="15"
        fontWeight="700"
        fill={SA_BG}
      >
        €
      </text>
      <Drip x={36} y={86} h={11} />
      <Speckles dots={[[8, 52, 1], [82, 58, 1.1], [16, 90, 0.8], [74, 96, 0.9]]} />
    </svg>
  );
}

/* ---------- 5. Chat assis (queue qui pend du bord) ---------- */
export function SACat({ size = 70, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 80 110"
      width={size}
      height={size * (110 / 80)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* silhouette assise, base sur y=74 */}
      <path
        d="M24 20 L29 6 L37 16
           C41 14 45 14 49 16 L57 6 L62 20
           C68 28 68 36 64 42
           C72 52 74 64 72 74
           L14 74
           C12 62 16 50 24 42
           C20 36 20 28 24 20 Z"
      />
      {/* yeux = trous */}
      <circle cx="36" cy="28" r="2" fill={SA_BG} />
      <circle cx="50" cy="28" r="2" fill={SA_BG} />
      {/* queue qui pend sous la ligne */}
      <path
        d="M66 72 C74 84 60 90 68 104"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Speckles dots={[[10, 50, 1], [74, 34, 0.9], [22, 80, 0.7]]} />
    </svg>
  );
}

/* ---------- 6. Caméra de surveillance (clin d'œil conformité) ---------- */
export function SACam({ size = 90, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 110 80"
      width={size}
      height={size * (80 / 110)}
      className={className}
      style={flipStyle(flip)}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* potence depuis le haut */}
      <path
        d="M8 4 L8 26 L30 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* boîtier incliné */}
      <g transform="rotate(14 60 40)">
        <rect x="30" y="28" width="52" height="24" rx="4" />
        <rect x="78" y="32" width="12" height="16" rx="2" />
        <circle cx="86" cy="40" r="3.4" fill={SA_BG} />
        <rect x="36" y="24" width="34" height="6" rx="2" />
      </g>
      <Drip x={44} y={58} h={12} />
      <Speckles dots={[[100, 18, 1], [20, 60, 0.9], [96, 64, 0.8]]} />
    </svg>
  );
}

/* ---------- 7. Flèche bombée (accent) ---------- */
export function SAArrow({ size = 110, className, flip = false }: StreetArtProps) {
  return (
    <svg
      viewBox="0 0 120 60"
      width={size}
      height={size * (60 / 120)}
      className={className}
      style={flipStyle(flip)}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 44 C36 56 74 14 106 26" strokeWidth="4" strokeLinecap="round" />
      <path d="M94 14 L108 26 L92 32" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="currentColor" stroke="none" opacity="0.55">
        <circle cx="16" cy="32" r="1" />
        <circle cx="60" cy="46" r="0.9" />
        <circle cx="100" cy="42" r="1.1" />
      </g>
    </svg>
  );
}
