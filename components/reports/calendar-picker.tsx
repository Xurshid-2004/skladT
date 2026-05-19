"use client"; 
 
import { useState } from 'react'; 
import { DayPicker, DateRange } from 'react-day-picker'; 
import 'react-day-picker/style.css'; 
import { Calendar as CalendarIcon, X, Check } from 'lucide-react'; 
import type { CalendarMode, ReportPeriod } from '@/lib/types'; 
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { uz } from 'date-fns/locale';

interface CalendarPickerProps {
  onPeriodSelect: (period: ReportPeriod) => void;
  onCancel: () => void;
}

export default function CalendarPicker({ onPeriodSelect, onCancel }: CalendarPickerProps) {
  const [mode, setMode] = useState<CalendarMode>('single');
  const [selectedSingle, setSelectedSingle] = useState<Date>(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const handleConfirm = () => {
    let period: ReportPeriod;
    const now = new Date();

    if (mode === 'single' && selectedSingle) {
      period = {
        mode: 'single',
        startDate: selectedSingle.setHours(0, 0, 0, 0),
        endDate: selectedSingle.setHours(23, 59, 59, 999),
        label: format(selectedSingle, 'dd.MM.yyyy')
      };
    } else if (mode === 'range' && selectedRange?.from && selectedRange?.to) {
      const from = new Date(selectedRange.from);
      const to = new Date(selectedRange.to);
      period = {
        mode: 'range',
        startDate: from.setHours(0, 0, 0, 0),
        endDate: to.setHours(23, 59, 59, 999),
        label: `${format(from, 'dd.MM')} - ${format(to, 'dd.MM.yyyy')}`
      };
    } else if (mode === 'month') {
      const start = startOfMonth(new Date(selectedYear, selectedMonth));
      const end = endOfMonth(new Date(selectedYear, selectedMonth));
      period = {
        mode: 'month',
        startDate: start.getTime(),
        endDate: end.getTime(),
        label: format(start, 'MMMM yyyy', { locale: uz })
      };
    } else if (mode === 'year') {
      const start = startOfYear(new Date(selectedYear, 0));
      const end = endOfYear(new Date(selectedYear, 0));
      period = {
        mode: 'year',
        startDate: start.getTime(),
        endDate: end.getTime(),
        label: `${selectedYear}-yil`
      };
    } else {
      return;
    }

    onPeriodSelect(period);
  };

  const months = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="bg-background border-2 border-primary/20 rounded-[40px] shadow-2xl overflow-hidden w-full max-w-md animate-in zoom-in-95 duration-300">
      <div className="p-6 bg-primary text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6" />
          <h3 className="font-black uppercase tracking-tighter text-xl">Vaqtni tanlang</h3>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-2 bg-muted/30 border-b border-primary/5 flex gap-1">
        {(['single', 'range', 'month', 'year'] as CalendarMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${
              mode === m ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'
            }`}
          >
            {m === 'single' ? '1 kun' : m === 'range' ? 'Oraliq' : m === 'month' ? 'Oylik' : 'Yillik'}
          </button>
        ))}
      </div>

      <div className="p-6 min-h-[350px] flex flex-col items-center justify-center">
        {mode === 'single' && (
          <DayPicker
            mode="single"
            selected={selectedSingle}
            onSelect={(d) => d && setSelectedSingle(d)}
            locale={uz}
          />
        )}
        {mode === 'range' && (
          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            locale={uz}
          />
        )}
        {mode === 'month' && (
          <div className="w-full space-y-6">
            <div className="grid grid-cols-3 gap-2">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`py-3 rounded-xl font-black text-sm transition-all ${selectedYear === y ? 'bg-primary text-white' : 'bg-muted'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {months.map((m, i) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(i)}
                  className={`py-3 rounded-xl font-bold text-xs transition-all ${selectedMonth === i ? 'bg-accent text-white' : 'bg-muted'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === 'year' && (
          <div className="w-full grid grid-cols-2 gap-4">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`py-8 rounded-3xl font-black text-2xl transition-all ${selectedYear === y ? 'bg-primary text-white shadow-xl scale-105' : 'bg-muted opacity-60'}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-muted/20 border-t-2 border-primary/5 flex gap-4">
        <button
          onClick={onCancel}
          className="flex-1 py-4 bg-muted text-muted-foreground rounded-2xl font-black uppercase hover:bg-muted/50 transition-all"
        >
          Bekor qilish
        </button>
        <button
          onClick={handleConfirm}
          className="flex-[2] py-4 bg-accent text-white rounded-2xl font-black uppercase shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> Tasdiqlash
        </button>
      </div>
    </div>
  );
}
