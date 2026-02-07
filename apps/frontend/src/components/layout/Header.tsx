import { Activity, BarChart3 } from 'lucide-react'
import { TimeSlider } from '@/components/historical/TimeSlider'
import { useAppContext } from '@/context/AppContext'
import { ModeToggle } from './ModeToggle'

export function Header() {
  const { mode, fetchRange, setFetchRange, bin, setBin } = useAppContext()

  const handleStartDateChange = (date: string) => {
    setFetchRange((current) => ({ ...current, start: date }))
  }

  const handleEndDateChange = (date: string) => {
    setFetchRange((current) => ({ ...current, end: date }))
  }

  const handleBinChange = (newBin: 'day' | 'month' | 'year') => {
    setBin(newBin)
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-primary">
            {mode === 'live' ? <Activity className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}
            <h1 className="text-lg font-semibold">Triangular Arbitrage</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            {mode === 'live' ? 'Live Detection' : 'Historical Analysis'}
          </span>
        </div>

        <div className="flex justify-center">
          {mode === 'historical' ? (
            <TimeSlider
              fetchRange={fetchRange}
              bin={bin}
              onStartDateChange={handleStartDateChange}
              onEndDateChange={handleEndDateChange}
              onBinChange={handleBinChange}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-4">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
