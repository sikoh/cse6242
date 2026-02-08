import { Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import type { ConnectionStatus as ConnectionStatusType, LiveConfig } from '@/types'
import { ConnectionStatus } from './ConnectionStatus'

interface LiveControlsProps {
  config: LiveConfig
  onConfigChange: (config: LiveConfig) => void
  isPaused: boolean
  onPauseChange: (paused: boolean) => void
  onClear: () => void
  status: ConnectionStatusType
  onReconnect: () => void
  staleMinutes: number
  onStaleMinutesChange: (minutes: number) => void
}

export function LiveControls({
  config,
  onConfigChange,
  isPaused,
  onPauseChange,
  onClear,
  status,
  onReconnect,
  staleMinutes,
  onStaleMinutesChange,
}: LiveControlsProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          <ConnectionStatus status={status} />
          {status === 'disconnected' || status === 'error' ? (
            <Button variant="ghost" size="sm" onClick={onReconnect}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Reconnect
            </Button>
          ) : null}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Playback controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isPaused ? 'default' : 'secondary'}
            size="sm"
            onClick={() => onPauseChange(!isPaused)}
          >
            {isPaused ? (
              <>
                <Play className="mr-1 h-3 w-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="mr-1 h-3 w-3" />
                Pause
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Fee control */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Fee %</label>
          <div className="w-32">
            <Slider
              value={[config.fee * 10]}
              min={0}
              max={10}
              step={1}
              onValueChange={([v]) => onConfigChange({ ...config, fee: v / 10 })}
            />
          </div>
          <span className="w-12 text-sm font-mono">{config.fee.toFixed(2)}%</span>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Min profit control */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Min Profit</label>
          <div className="w-32">
            <Slider
              value={[config.minProfit * 100]}
              min={0}
              max={200}
              step={1}
              onValueChange={([v]) => onConfigChange({ ...config, minProfit: v / 100 })}
            />
          </div>
          <span className="w-12 text-sm font-mono">{config.minProfit.toFixed(2)}%</span>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Notional control */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Notional $</label>
          <Input
            type="number"
            value={config.notional}
            onChange={(e) => onConfigChange({ ...config, notional: Number(e.target.value) })}
            className="w-24"
            min={1}
            max={100000}
          />
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Stale minutes control */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Stale</label>
          <div className="w-24">
            <Slider
              value={[staleMinutes]}
              min={1}
              max={30}
              step={1}
              onValueChange={([v]) => onStaleMinutesChange(v)}
            />
          </div>
          <span className="w-12 font-mono text-sm">{staleMinutes}m</span>
        </div>
      </div>
    </div>
  )
}
