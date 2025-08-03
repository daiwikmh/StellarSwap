import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"

interface SidebarProps {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  ethPrice?: number
  xlmPrice?: number
}

export default function Sidebar({ sidebarCollapsed, setSidebarCollapsed, ethPrice = 3247.82, xlmPrice = 0.124 }: SidebarProps) {
  return (
    <>
      <div
        className={`${sidebarCollapsed ? "w-16" : "w-70"} bg-neutral-900 border-r border-neutral-700 transition-all duration-300 fixed md:relative z-50 md:z-auto h-full md:h-auto ${!sidebarCollapsed ? "md:block" : ""}`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-8">
            <div className={`${sidebarCollapsed ? "hidden" : "block"}`}>
              <h1 className="text-orange-500 font-bold text-lg tracking-wider">crossinch+</h1>
              <p className="text-neutral-500 text-xs">CROSS-CHAIN PROTOCOL</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-neutral-400 hover:text-orange-500"
            >
              <ChevronRight
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              />
            </Button>
          </div>

          {!sidebarCollapsed && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs text-neutral-400 tracking-wider mb-3">WALLET BALANCES</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-neutral-800 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">Ξ</span>
                      </div>
                      <span className="text-sm text-white">ETH</span>
                    </div>
                    <span className="text-sm text-white font-mono">2.4567</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-neutral-800 rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">★</span>
                      </div>
                      <span className="text-sm text-white">XLM</span>
                    </div>
                    <span className="text-sm text-white font-mono">15,432.89</span>
                  </div>
                  
                </div>
              </div>

              <div className="mt-8 p-4 bg-neutral-800 border border-neutral-700 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-xs text-white">PROTOCOL ONLINE</span>
                </div>
                <div className="text-xs text-neutral-500">
                  <div>UPTIME: 99.7%</div>
                  <div>SWAPS: 1,247 TODAY</div>
                  <div>VOLUME: $2.4M</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!sidebarCollapsed && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarCollapsed(true)} />
      )}
    </>
  )
}