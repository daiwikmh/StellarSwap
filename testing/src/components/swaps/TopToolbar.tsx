"use client"

import { Button } from "@/components/ui/button"
import { Bell, Settings } from "lucide-react"

interface TopToolbarProps {
  ethPrice?: number
  xlmPrice?: number
}

export default function TopToolbar({ ethPrice = 3247.82, xlmPrice = 0.124 }: TopToolbarProps) {
  return (
    <div className="h-16 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="text-sm text-neutral-400">
          crossinch+ / <span className="text-orange-500">SWAP</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-xs text-neutral-500">ETH: ${ethPrice.toFixed(2)} | XLM: ${xlmPrice.toFixed(3)}</div>
        <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-500">
          <Bell className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-orange-500">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}