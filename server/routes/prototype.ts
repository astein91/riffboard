/**
 * Prototype API routes for Voice Riff Studio integration
 * Provides endpoints for idea extraction and prototype building
 */

import { Router } from 'express';

const router = Router();

/**
 * POST /api/ideas/extract
 * Extract UI ideas from voice transcript using Gemini
 */
router.post('/ideas/extract', async (req, res) => {
  try {
    const { transcript } = req.body;
    const geminiApiKey = req.headers['x-gemini-api-key'] as string;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'transcript is required' });
    }

    if (!geminiApiKey) {
      return res.status(401).json({ error: 'Gemini API key required in X-Gemini-API-Key header' });
    }

    // TODO: Implement Gemini-powered idea extraction
    // Use geminiApiKey to call Gemini API
    // For now, return mock data
    const mockIdeas = [
      {
        id: `idea_${Date.now()}_1`,
        title: 'Pricing Page',
        description: 'A pricing page with three tiers showing feature comparison',
        confidence: 95,
      },
      {
        id: `idea_${Date.now()}_2`,
        title: 'Dark Mode Toggle',
        description: 'Add a dark/light theme switcher to the navigation',
        confidence: 87,
      },
    ];

    res.json({ ideas: mockIdeas });
  } catch (error) {
    console.error('Error extracting ideas:', error);
    res.status(500).json({ error: 'Failed to extract ideas' });
  }
});

/**
 * POST /api/prototype/build
 * Build a prototype from an idea using OpenCode
 */
router.post('/prototype/build', async (req, res) => {
  try {
    const { instruction } = req.body;
    const geminiApiKey = req.headers['x-gemini-api-key'] as string;

    if (!instruction || typeof instruction !== 'string') {
      return res.status(400).json({ error: 'instruction is required' });
    }

    if (!geminiApiKey) {
      return res.status(401).json({ error: 'Gemini API key required in X-Gemini-API-Key header' });
    }

    // TODO: Implement OpenCode integration with geminiApiKey
    // For now, return mock React component
    const mockCode = `import React, { useState } from 'react';

function App() {
  const [darkMode, setDarkMode] = useState(false);

  const tiers = [
    {
      name: 'Starter',
      price: '$9/mo',
      features: ['Basic features', 'Email support', '5GB storage']
    },
    {
      name: 'Pro',
      price: '$29/mo',
      features: ['All features', 'Priority support', '50GB storage', 'Advanced analytics']
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: ['Custom features', 'Dedicated support', 'Unlimited storage', 'SLA guarantee']
    }
  ];

  return (
    <div style={{
      padding: '40px',
      background: darkMode ? '#1a1a1a' : '#ffffff',
      minHeight: '100vh',
      color: darkMode ? '#ffffff' : '#000000',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
          <h1 style={{ fontSize: '36px', margin: 0 }}>Pricing</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '10px 20px',
              background: darkMode ? '#ffffff' : '#000000',
              color: darkMode ? '#000000' : '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
          {tiers.map((tier, index) => (
            <div
              key={tier.name}
              style={{
                padding: '32px',
                background: darkMode ? '#2a2a2a' : '#f8f9fa',
                borderRadius: '16px',
                border: \`2px solid \${darkMode ? '#404040' : '#e0e0e0'}\`,
                transform: index === 1 ? 'scale(1.05)' : 'scale(1)'
              }}
            >
              <h2 style={{ fontSize: '24px', marginTop: 0 }}>{tier.name}</h2>
              <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '16px 0' }}>
                {tier.price}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0' }}>
                {tier.features.map((feature) => (
                  <li key={feature} style={{ padding: '8px 0' }}>
                    ✓ {feature}
                  </li>
                ))}
              </ul>
              <button style={{
                width: '100%',
                padding: '12px',
                background: index === 1 ? '#0066cc' : darkMode ? '#404040' : '#e0e0e0',
                color: index === 1 ? '#ffffff' : darkMode ? '#ffffff' : '#000000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600'
              }}>
                Get Started
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;`;

    res.json({ code: mockCode });
  } catch (error) {
    console.error('Error building prototype:', error);
    res.status(500).json({ error: 'Failed to build prototype' });
  }
});

/**
 * POST /api/prototype/update
 * Update an existing prototype with a new instruction
 */
router.post('/prototype/update', async (req, res) => {
  try {
    const { currentCode, instruction } = req.body;
    const geminiApiKey = req.headers['x-gemini-api-key'] as string;

    if (!currentCode || typeof currentCode !== 'string') {
      return res.status(400).json({ error: 'currentCode is required' });
    }

    if (!instruction || typeof instruction !== 'string') {
      return res.status(400).json({ error: 'instruction is required' });
    }

    if (!geminiApiKey) {
      return res.status(401).json({ error: 'Gemini API key required in X-Gemini-API-Key header' });
    }

    // TODO: Implement OpenCode integration for updates with geminiApiKey
    // For now, return modified code with a comment
    const updatedCode = currentCode.replace(
      'function App() {',
      `function App() {\n  // Updated: ${instruction}`
    );

    res.json({ code: updatedCode });
  } catch (error) {
    console.error('Error updating prototype:', error);
    res.status(500).json({ error: 'Failed to update prototype' });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'riffboard-prototype-api' });
});

export default router;
