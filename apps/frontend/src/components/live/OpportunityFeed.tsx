import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatPercent, formatRelativeTime } from '@/lib/utils'
import type { LiveOpportunity } from '@/types'

interface OpportunityFeedProps {
  opportunities: LiveOpportunity[]
}

export function OpportunityFeed({ opportunities }: OpportunityFeedProps) {
  return (
    <Card className="flex h-125 flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b px-4">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="tracking-wide text-foreground">Live Opportunities</span>
          <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">
            {opportunities.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <div className="flex h-full flex-col">
          {opportunities.length > 0 && (
            <div className="flex items-center justify-between border-b border-border px-3 pb-3 text-[11px] font-semibold uppercase leading-none tracking-wider text-muted-foreground">
              <span>Triangle</span>
              <span>Profit</span>
            </div>
          )}
          <ScrollArea className="min-h-0 flex-1">
            {opportunities.length === 0 ? (
              <div className="flex h-full items-center justify-center p-3 text-center text-muted-foreground">
                <div>
                  <p className="text-sm font-medium">No opportunities detected yet</p>
                  <p className="text-xs">Markets are efficient most of the time</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {opportunities.map((opp) => (
                  <OpportunityItem key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}

function OpportunityItem({ opportunity }: { opportunity: LiveOpportunity }) {
  const profitColor =
    opportunity.profitPct > 0.5
      ? 'text-emerald-500'
      : opportunity.profitPct > 0.2
        ? 'text-green-500'
        : 'text-lime-500'

  return (
    <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/40">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="font-mono text-xs">
            {opportunity.currA}
          </Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant="outline" className="font-mono text-xs">
            {opportunity.currB}
          </Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant="outline" className="font-mono text-xs">
            {opportunity.currC}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{opportunity.direction}</span>
          <span>•</span>
          <span>{formatRelativeTime(opportunity.timestamp)}</span>
        </div>
      </div>
      <div className={`text-right font-mono text-base font-semibold ${profitColor}`}>
        +{formatPercent(opportunity.profitPct)}
      </div>
    </div>
  )
}
