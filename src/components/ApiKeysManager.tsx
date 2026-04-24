import React, { useState, useEffect } from 'react';
import { Trash2, Plus, Key } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
}

export function ApiKeysManager({ onKeyChange }: { onKeyChange: (key: string) => void }) {
  const [keys, setKeys] = useState<ApiKey[]>(() => {
    const saved = localStorage.getItem('linguo_api_key_manager');
    if (saved) return JSON.parse(saved);
    return [{ id: '1', name: 'Llave predeterminada', key: 'AIzaSyCbIH6PvNaSJPTwD06Yr-TdLZa8xUbYUzo' }];
  });
  const [activeKeyId, setActiveKeyId] = useState<string>(() => localStorage.getItem('linguo_active_api_key_id') || '1');
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    localStorage.setItem('linguo_api_key_manager', JSON.stringify(keys));
    localStorage.setItem('linguo_active_api_key_id', activeKeyId);
    
    const activeKey = keys.find(k => k.id === activeKeyId)?.key;
    onKeyChange(activeKey || '');
  }, [keys, activeKeyId, onKeyChange]);

  const addKey = () => {
    if (newName && newKey) {
      const newEntry = { id: Date.now().toString(), name: newName, key: newKey };
      setKeys([...keys, newEntry]);
      setNewName('');
      setNewKey('');
    }
  };

  return (
    <div className="space-y-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-2 mb-2 text-zinc-100">
        <Key size={16} />
        <h3 className="font-bold text-sm uppercase tracking-widest">Gestor de API Keys</h3>
      </div>
      
      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-2 bg-zinc-950 p-2 rounded-lg border border-zinc-800">
            <input 
              type="radio" 
              checked={activeKeyId === k.id} 
              onChange={() => setActiveKeyId(k.id)}
              className="accent-amber-500"
            />
            <span className="text-xs text-zinc-300 flex-grow">{k.name}</span>
            {k.id !== '1' && (
              <button onClick={() => {
                setKeys(keys.filter(item => item.id !== k.id));
                if (activeKeyId === k.id) setActiveKeyId('1');
              }} className="text-zinc-600 hover:text-red-500">
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800">
        <input placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} className="bg-zinc-950 text-xs p-2 rounded border border-zinc-800" />
        <input placeholder="API Key" value={newKey} onChange={e => setNewKey(e.target.value)} type="password" className="bg-zinc-950 text-xs p-2 rounded border border-zinc-800" />
        <button onClick={addKey} className="flex justify-center items-center gap-2 bg-amber-500/10 text-amber-500 text-[10px] font-bold p-2 rounded border border-amber-500/20 hover:bg-amber-500/20">
          <Plus size={12} /> Añadir Key
        </button>
      </div>
    </div>
  );
}
