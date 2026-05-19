"use client"; 
 
import AdminLayout from '@/components/admin/admin-layout'; 
import { useState, useEffect } from 'react'; 
import {  
  Plus, Edit3, Trash2, Save, X, Loader2,  
  ListOrdered, Settings2, Eye, EyeOff, LayoutGrid
} from 'lucide-react'; 
import { subscribeToQuestions, createQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '@/lib/firebase/questions-service'; 
import { getSession } from '@/lib/utils/session';
import { FormQuestion } from '@/lib/types';

export default function QuestionsConstructor() { 
  const [activeCategory, setActiveCategory] = useState<FormQuestion['category']>('lokomotiv');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<FormQuestion | null>(null);
  const [session, setSession] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<FormQuestion>>({
    label: "",
    fieldKey: "",
    fieldType: "text",
    isRequired: true,
    isVisible: true,
    options: [],
    order: 0,
    stationId: ""
  });

  useEffect(() => {
    setSession(getSession());
    const unsubscribe = subscribeToQuestions(activeCategory, undefined, (data) => {
      setQuestions(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeCategory]);

  const handleSave = async () => {
    if (!formData.label || !formData.fieldKey || !session) return;
    setLoading(true);
    
    const data = {
      ...formData,
      category: activeCategory,
      order: editingQuestion ? formData.order : questions.length,
      updatedAt: Date.now()
    } as Omit<FormQuestion, 'id' | 'createdAt' | 'updatedAt'>;

    if (editingQuestion) {
      await updateQuestion(editingQuestion.id, data, session.code, session.displayName);
    } else {
      await createQuestion(data, session.code, session.displayName);
    }

    setShowAddModal(false);
    setEditingQuestion(null);
    setFormData({ label: "", fieldKey: "", fieldType: "text", isRequired: true, isVisible: true, options: [], order: 0, stationId: "" });
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Ushbu savolni o'chirishni xohlaysizmi?") || !session) return;
    setLoading(true);
    await deleteQuestion(id, session.code, session.displayName);
    setLoading(false);
  };

  const toggleVisibility = async (q: FormQuestion) => {
    if (!session) return;
    await updateQuestion(q.id, { isVisible: !q.isVisible }, session.code, session.displayName);
  };

  return ( 
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase">SO'ROVNOMALAR KONSTRUKTORI</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest mt-1">Dinamik formalar va no-code boshqaruv</p>
          </div>
          <button onClick={() => { setEditingQuestion(null); setShowAddModal(true); }} className="px-8 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
            <Plus className="w-4 h-4" /> Yangi savol qo'shish
          </button>
        </div>

        {/* Categories Tab */}
        <div className="flex p-2 bg-muted/50 rounded-3xl overflow-x-auto gap-1">
          {['lokomotiv', 'korxona', 'qurulish', 'tamirlash'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as FormQuestion['category'])}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeCategory === cat ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:bg-primary/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-20 bg-background/50 rounded-3xl border-2 border-dashed border-primary/10">
              <p className="text-muted-foreground font-black uppercase text-xs">Savollar hali mavjud emas</p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className={`bg-background p-6 rounded-3xl border-2 transition-all flex items-center justify-between group ${q.isVisible ? 'border-primary/5 hover:border-primary/20' : 'opacity-40 border-transparent bg-muted/50'}`}>
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center font-black text-xs text-muted-foreground">{q.order + 1}</div>
                  <div>
                    <h3 className="font-bold text-sm leading-none flex items-center gap-2">
                      {q.label}
                      {q.isRequired && <span className="text-danger text-lg">*</span>}
                    </h3>
                    <p className="text-[10px] font-bold opacity-40 uppercase mt-1">{q.fieldKey} • {q.fieldType}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => toggleVisibility(q)} className="p-3 hover:bg-muted rounded-xl transition-colors">
                    {q.isVisible ? <Eye className="w-5 h-5 text-primary" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button onClick={() => { setEditingQuestion(q); setFormData(q); setShowAddModal(true); }} className="p-3 hover:bg-muted rounded-xl transition-colors">
                    <Edit3 className="w-5 h-5 text-accent" />
                  </button>
                  <button onClick={() => handleDelete(q.id)} className="p-3 hover:bg-danger/10 rounded-xl transition-colors text-danger">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background w-full max-w-lg rounded-[40px] shadow-2xl border-2 border-primary/10 overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-8 bg-primary text-white flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {editingQuestion ? "Savolni tahrirlash" : "Yangi savol qo'shish"}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Savol nomi (Label)</label>
                  <input 
                    value={formData.label}
                    onChange={(e) => setFormData(p => ({ ...p, label: e.target.value }))}
                    placeholder="Masalan: Lokomotiv raqami"
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase opacity-40">Field Key (Bazadagi nomi)</label>
                  <input 
                    value={formData.fieldKey}
                    onChange={(e) => setFormData(p => ({ ...p, fieldKey: e.target.value }))}
                    placeholder="Masalan: lokomotivNumber"
                    className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-mono text-sm transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Turi</label>
                    <select 
                      value={formData.fieldType}
                      onChange={(e) => setFormData(p => ({ ...p, fieldType: e.target.value as any }))}
                      className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="datetime">DateTime</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Tartibi</label>
                    <input 
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData(p => ({ ...p, order: Number(e.target.value) }))}
                      className="w-full h-14 px-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                    />
                  </div>
                </div>

                {formData.fieldType === 'dropdown' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase opacity-40">Variantlar (Har qator alohida)</label>
                    <textarea 
                      value={formData.options?.join('\n')}
                      onChange={(e) => setFormData(p => ({ ...p, options: e.target.value.split('\n').filter(v => v.trim()) }))}
                      placeholder="Variant 1&#10;Variant 2&#10;Variant 3"
                      className="w-full h-32 p-6 bg-muted border-2 border-transparent focus:border-primary rounded-2xl font-bold transition-all"
                    />
                  </div>
                )}

                <div className="flex gap-6 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.isRequired ? 'bg-primary border-primary' : 'border-primary/20 group-hover:border-primary/40'}`}>
                      {formData.isRequired && <Plus className="w-4 h-4 text-white rotate-45" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={formData.isRequired} onChange={(e) => setFormData(p => ({ ...p, isRequired: e.target.checked }))} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Majburiy</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.isVisible ? 'bg-primary border-primary' : 'border-primary/20 group-hover:border-primary/40'}`}>
                      {formData.isVisible && <Plus className="w-4 h-4 text-white rotate-45" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={formData.isVisible} onChange={(e) => setFormData(p => ({ ...p, isVisible: e.target.checked }))} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ko'rinadigan</span>
                  </label>
                </div>

                <button 
                  onClick={handleSave}
                  disabled={loading || !formData.label || !formData.fieldKey}
                  className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 mt-6"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "SAQLASH"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  ); 
} 
