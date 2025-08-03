"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Transaction {
  from: string
  to: string
  time: string
  status: string
}

const mockTransactions: Transaction[] = [
  { from: "0.5 ETH", to: "500 XLM", time: "2 min ago", status: "completed" },
  { from: "1000 XLM", to: "1.0 ETH", time: "1 hour ago", status: "completed" },
  { from: "0.25 ETH", to: "250 XLM", time: "3 hours ago", status: "completed" },
]

export default function RecentTransactions() {
  return (
    <Card className="bg-neutral-900 border-neutral-700 mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">RECENT SWAPS</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockTransactions.map((tx, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-neutral-800 rounded border border-neutral-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <div>
                  <div className="text-sm text-white font-mono">
                    {tx.from} → {tx.to}
                  </div>
                  <div className="text-xs text-neutral-500">{tx.time}</div>
                </div>
              </div>
              <div className="text-xs text-white bg-white/20 px-2 py-1 rounded uppercase tracking-wider">
                {tx.status}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}