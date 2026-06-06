"use client"; 
 
import { useState, useEffect } from 'react'; 
import { getSession } from '@/lib/utils/session'; 
import { subscribeToQuestions } from '@/lib/firebase/questions-service'; 
import { FormQuestion } from '@/lib/types'; 
import { addLokomotivSubmission } from '@/lib/firebase/lokomotiv-service'; 
import { Loader2, CheckCircle2, AlertCircle, Save, X } from 'lucide-react'; 
 
interface DynamicFormProps { 
  category: FormQuestion['category']; 
  stationId: string; 
  onSuccess?: () => void; 
} 
 
export default function DynamicForm({ category, stationId, onSuccess }: DynamicFormProps) { 
  const [questions, setQuestions] = useState<FormQuestion[]>([]); 
  const [loading, setLoading] = useState(true); 
  const [saving, setSaving] = useState(false); 
  const [formData, setFormData] = useState<Record<string, any>>({}); 
  const [session, setSession] = useState<any>(null); 
  const [success, setSuccess] = useState(false); 
 
  useEffect(() => { 
    setSession(getSession()); 
    const unsubscribeQuestions = subscribeToQuestions(category, stationId, (data) => { 
      setQuestions(data.filter(q => q.isVisible)); 
      setLoading(false); 
    }); 
 
    return () => { 
      unsubscribeQuestions(); 
    }; 
  }, [category, stationId]); 
 
  const handleInputChange = (key: string, value: any) => { 
    setFormData(prev => ({ ...prev, [key]: value })); 
  }; 
 
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (saving || !session) return; 
 
    setSaving(true); 
    try { 
      await addLokomotivSubmission({ 
        staffCode: session.code, 
        staffName: session.displayName, 
        nodeId: session.nodeId!, 
        stationId: stationId, 
        category: category, 
        timestamp: Date.now(), 
        data: formData, // Store dynamic fields in a data object 
      } as any); 
 
      setSuccess(true); 
      if (onSuccess) onSuccess(); 
    } catch (err) { 
      console.error(err); 
      alert("Xatolik yuz berdi"); 
    } finally { 
      setSaving(false); 
    } 
  }; 
 
  if (loading) return <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /></div>; 
 
  if (success) return ( 
    <div className="bg-success/10 border-2 border-success/20 p-10 rounded-[40px] text-center space-y-4 animate-in zoom-in-95"> 
      <CheckCircle2 className="w-16 h-16 text-success mx-auto" /> 
      <h2 className="text-2xl font-black uppercase text-success">Muvaffaqiyatli saqlandi!</h2> 
      <button onClick={() => { setSuccess(false); setFormData({}); }} className="px-8 py-3 bg-success text-white rounded-2xl font-black uppercase text-xs">Yangi yozuv</button> 
    </div> 
  ); 
 
  return ( 
    <form onSubmit={handleSubmit} className="space-y-8"> 
      {questions.map((q) => ( 
        <div key={q.id} className="space-y-3"> 
          <label className="block text-xs font-black text-primary uppercase tracking-widest px-1"> 
            {q.label} {q.isRequired && <span className="text-danger">*</span>} 
          </label> 
           
          {q.fieldType === 'text' && ( 
            <input 
              required={q.isRequired} 
              value={formData[q.fieldKey] || ''} 
              onChange={(e) => handleInputChange(q.fieldKey, e.target.value)} 
              className="w-full h-16 px-6 bg-background border-2 border-primary/5 rounded-3xl font-bold focus:border-primary transition-all" 
            /> 
          )} 
 
          {q.fieldType === 'number' && ( 
            <input 
              type="number" 
              required={q.isRequired} 
              value={formData[q.fieldKey] || ''} 
              onChange={(e) => handleInputChange(q.fieldKey, e.target.value)} 
              className="w-full h-16 px-6 bg-background border-2 border-primary/5 rounded-3xl font-bold focus:border-primary transition-all text-2xl" 
            /> 
          )} 
 
          {q.fieldType === 'dropdown' && ( 
            <select 
              required={q.isRequired} 
              value={formData[q.fieldKey] || ''} 
              onChange={(e) => handleInputChange(q.fieldKey, e.target.value)} 
              className="w-full h-16 px-6 bg-background border-2 border-primary/5 rounded-3xl font-bold focus:border-primary transition-all uppercase tracking-widest text-sm" 
            > 
              <option value="">Tanlang...</option> 
              {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)} 
            </select> 
          )} 
 
          {q.fieldType === 'boolean' && ( 
            <div className="flex gap-2"> 
              <button 
                type="button" 
                onClick={() => handleInputChange(q.fieldKey, true)} 
                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${formData[q.fieldKey] === true ? 'bg-primary text-white shadow-lg' : 'bg-muted opacity-40'}`} 
              > 
                HA 
              </button> 
              <button 
                type="button" 
                onClick={() => handleInputChange(q.fieldKey, false)} 
                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${formData[q.fieldKey] === false ? 'bg-danger text-white shadow-lg' : 'bg-muted opacity-40'}`} 
              > 
                YO'Q 
              </button> 
            </div> 
          )} 
        </div> 
      ))} 
 
      <button 
        type="submit" 
        disabled={saving} 
        className="w-full py-6 bg-accent text-white rounded-[32px] font-black text-xl uppercase shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50" 
      > 
        {saving ? <Loader2 className="w-8 h-8 animate-spin" /> : <><Save className="w-6 h-6" /> SAQLASH</>} 
      </button> 
    </form> 
  ); 
} 
