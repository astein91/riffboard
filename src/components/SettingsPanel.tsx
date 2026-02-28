import { useEffect, useState } from 'react';
import { useSettingsStore, AI_PROVIDERS } from '../stores/settings';

const AI_KEY_PROVIDERS = [...AI_PROVIDERS] as string[];
const VOICE_PROVIDERS = ['deepgram'];
const PROVIDER_OPTIONS = [...AI_PROVIDERS];

function KeyRow({ provider, isConfigured, maskedKey, loading, inputValue, onInputChange, onSave, onClear }: {
  provider: string; isConfigured: boolean; maskedKey?: string; loading: boolean;
  inputValue: string; onInputChange: (v: string) => void; onSave: () => void; onClear: () => void;
}) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 500, textTransform: 'capitalize' }}>{provider}</span>
        {isConfigured && (
          <button onClick={onClear} disabled={loading} style={{
            background: 'none', border: '1px solid #333', borderRadius: 6,
            color: '#f87171', fontSize: 12, padding: '3px 10px', cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}>Clear</button>
        )}
      </div>
      {isConfigured ? (
        <div style={{ marginTop: 6, fontSize: 13, color: '#555', fontFamily: 'monospace' }}>{maskedKey}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input type="password" placeholder={`Enter ${provider} API key`} value={inputValue}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
            style={{
              flex: 1, background: '#151515', border: '1px solid #222',
              borderRadius: 8, padding: '8px 12px', color: '#eee',
              fontSize: 13, outline: 'none', fontFamily: 'monospace',
            }} />
          <button onClick={onSave} disabled={loading || !inputValue.trim()} style={{
            background: '#222', border: '1px solid #333', borderRadius: 8,
            color: '#eee', fontSize: 13, padding: '8px 16px', cursor: 'pointer',
            opacity: loading || !inputValue.trim() ? 0.4 : 1,
          }}>Save</button>
        </div>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const isOpen = useSettingsStore(s => s.isOpen);
  const close = useSettingsStore(s => s.close);
  const keys = useSettingsStore(s => s.keys);
  const configured = useSettingsStore(s => s.configured);
  const loading = useSettingsStore(s => s.loading);
  const loadKeys = useSettingsStore(s => s.loadKeys);
  const setKey = useSettingsStore(s => s.setKey);
  const clearKey = useSettingsStore(s => s.clearKey);
  const selectedModel = useSettingsStore(s => s.selectedModel);
  const selectedProvider = useSettingsStore(s => s.selectedProvider);
  const loadPreferences = useSettingsStore(s => s.loadPreferences);
  const savePreferences = useSettingsStore(s => s.savePreferences);

  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [localModel, setLocalModel] = useState('');
  const [localProvider, setLocalProvider] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadKeys();
      loadPreferences();
    }
  }, [isOpen]);

  useEffect(() => {
    setLocalModel(selectedModel);
    setLocalProvider(selectedProvider);
  }, [selectedModel, selectedProvider]);

  if (!isOpen) return null;

  const handleSaveKey = async (provider: string) => {
    const val = keyInputs[provider];
    if (!val?.trim()) return;
    await setKey(provider, val.trim());
    setKeyInputs(prev => ({ ...prev, [provider]: '' }));
  };

  const handleSavePreferences = () => {
    savePreferences(localModel, localProvider);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div style={{
        background: '#0f0f0f', border: '1px solid #222', borderRadius: 12,
        width: 480, maxHeight: '80vh', overflow: 'auto',
        padding: 24, position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button
            onClick={close}
            style={{
              background: 'none', border: 'none', color: '#666', cursor: 'pointer',
              fontSize: 20, padding: '0 4px', lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* AI Providers */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            AI Providers
          </h3>
          {AI_KEY_PROVIDERS.map(provider => (
            <KeyRow key={provider} provider={provider} isConfigured={configured.includes(provider)}
              maskedKey={keys[provider]} loading={loading} inputValue={keyInputs[provider] ?? ''}
              onInputChange={v => setKeyInputs(prev => ({ ...prev, [provider]: v }))}
              onSave={() => handleSaveKey(provider)} onClear={() => clearKey(provider)} />
          ))}
        </div>

        {/* Voice */}
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Voice
          </h3>
          {VOICE_PROVIDERS.map(provider => (
            <KeyRow key={provider} provider={provider} isConfigured={configured.includes(provider)}
              maskedKey={keys[provider]} loading={loading} inputValue={keyInputs[provider] ?? ''}
              onInputChange={v => setKeyInputs(prev => ({ ...prev, [provider]: v }))}
              onSave={() => handleSaveKey(provider)} onClear={() => clearKey(provider)} />
          ))}
        </div>

        {/* Model Preferences Section */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Model Preferences
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Provider</label>
              <select
                value={localProvider}
                onChange={e => setLocalProvider(e.target.value)}
                style={{
                  width: '100%', background: '#151515', border: '1px solid #222',
                  borderRadius: 8, padding: '8px 12px', color: '#eee',
                  fontSize: 13, outline: 'none',
                }}
              >
                <option value="">Default</option>
                {PROVIDER_OPTIONS.map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 4 }}>Model</label>
              <input
                type="text"
                placeholder="e.g. gemini-2.5-flash"
                value={localModel}
                onChange={e => setLocalModel(e.target.value)}
                style={{
                  width: '100%', background: '#151515', border: '1px solid #222',
                  borderRadius: 8, padding: '8px 12px', color: '#eee',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={handleSavePreferences}
              disabled={loading}
              style={{
                background: '#222', border: '1px solid #333', borderRadius: 8,
                color: '#eee', fontSize: 13, padding: '8px 16px', cursor: 'pointer',
                alignSelf: 'flex-end',
                opacity: loading ? 0.4 : 1,
              }}
            >Save Preferences</button>
          </div>
        </div>
      </div>
    </div>
  );
}
