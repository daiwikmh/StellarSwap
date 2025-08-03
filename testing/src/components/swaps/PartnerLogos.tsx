interface Partner {
  name: string
  symbol: string
}

const partnerLogos: Partner[] = [
  { name: "Ethereum", symbol: "Ξ" },
  { name: "Stellar", symbol: "★" },
  { name: "1INCH", symbol: "◊" },
]

export default function PartnerLogos() {
  return (
    <div className="border-t border-neutral-700 bg-neutral-900 p-4">
      <div className="text-xs text-neutral-400 tracking-wider mb-3 text-center">SUPPORTED PROTOCOLS</div>
      <div className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide">
        {partnerLogos.map((partner, index) => (
          <div
            key={index}
            className="flex-shrink-0 flex flex-col items-center gap-2 p-3 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 bg-neutral-800 border border-neutral-700 rounded-full flex items-center justify-center hover:border-orange-500 transition-colors">
              <span className="text-orange-500 font-bold">{partner.symbol}</span>
            </div>
            <span className="text-xs text-neutral-400 whitespace-nowrap">{partner.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}