type BrandPeakProps = {
  className?: string;
};

// Monograma «Λ» del Brand Book (pág. 7). Solo decorativo: marca de agua en zonas de marca.
export default function BrandPeak({ className }: BrandPeakProps) {
  return (
    <svg className={className} viewBox="0 0 181 186" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M67 0h47l67 186h-37L90.5 39 37 186H0z" />
      <path d="M70 186l20.5-55L111 186z" />
    </svg>
  );
}
