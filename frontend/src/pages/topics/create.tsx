import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

interface Source {
  name: string;
  type: 'rss' | 'github' | 'discord' | 'content_monitor';
  url: string;
  enabled: boolean;
}

export function TopicCreate() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    enabled: true,
    lookbackDays: 7,
    assistantId: '',
    prompt: `Analyze the following developer news items and create a comprehensive summary for developers.

STRUCTURE REQUIRED:
🔥 TOP 5 CRITICAL UPDATES
- List the 5 most important items (breaking changes, major releases, critical features)
- Each point should be 1-2 lines maximum
- Use technical language appropriate for developers

📋 ADDITIONAL UPDATES
- List all other relevant items
- Include minor updates, improvements, and notable changes
- Keep each point concise but informative

NEWS ITEMS:

{items}

---
Provide the structured summary with the exact headers shown above (no markdown formatting):`,
    includeKeywords: [] as string[],
    excludeKeywords: [] as string[],
    cronExpression: '',
    cronTimezone: 'Europe/Paris',
    slackChannels: [] as string[],
    sources: [] as Source[]
  });
  const [loading, setLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcludeKeyword, setNewExcludeKeyword] = useState('');
  const [newSlackChannel, setNewSlackChannel] = useState('');
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [newSource, setNewSource] = useState<Source>({
    name: '',
    type: 'rss',
    url: '',
    enabled: true
  });

  const updateSlug = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setFormData(prev => ({ ...prev, slug }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.includeKeywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        includeKeywords: [...prev.includeKeywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      includeKeywords: prev.includeKeywords.filter(k => k !== keyword)
    }));
  };

  const addExcludeKeyword = () => {
    if (newExcludeKeyword.trim() && !formData.excludeKeywords.includes(newExcludeKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        excludeKeywords: [...prev.excludeKeywords, newExcludeKeyword.trim()]
      }));
      setNewExcludeKeyword('');
    }
  };

  const removeExcludeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      excludeKeywords: prev.excludeKeywords.filter(k => k !== keyword)
    }));
  };

  const addSlackChannel = () => {
    if (newSlackChannel.trim() && !formData.slackChannels.includes(newSlackChannel.trim())) {
      setFormData(prev => ({
        ...prev,
        slackChannels: [...prev.slackChannels, newSlackChannel.trim()]
      }));
      setNewSlackChannel('');
    }
  };

  const removeSlackChannel = (channel: string) => {
    setFormData(prev => ({
      ...prev,
      slackChannels: prev.slackChannels.filter(c => c !== channel)
    }));
  };

  const addSource = () => {
    if (newSource.name.trim() && newSource.url.trim()) {
      setFormData(prev => ({
        ...prev,
        sources: [...prev.sources, { ...newSource }]
      }));
      setNewSource({ name: '', type: 'rss', url: '', enabled: true });
      setShowSourceForm(false);
    }
  };

  const removeSource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.sources.length === 0) {
      alert('At least one source is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-secure-api-key-minimum-32-chars'
        },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          enabled: formData.enabled,
          lookback_days: formData.lookbackDays,
          assistant_id: formData.assistantId,
          prompt: formData.prompt,
          include_keywords: formData.includeKeywords,
          exclude_keywords: formData.excludeKeywords,
          cron_expression: formData.cronExpression,
          cron_timezone: formData.cronTimezone,
          slack_channels: formData.slackChannels,
          sources: formData.sources
        })
      });

      if (response.ok) {
        navigate('/topics');
      } else {
        const error = await response.text();
        console.error('Failed to create topic:', error);
        alert('Failed to create topic. Please try again.');
      }
    } catch (error) {
      console.error('Error creating topic:', error);
      alert('Error creating topic. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <Link 
            to="/topics" 
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#6b7280',
              textDecoration: 'none',
              marginRight: '1rem'
            }}
          >
            <ArrowLeft style={{ width: '1.25rem', height: '1.25rem', marginRight: '0.5rem' }} />
            Back to Topics
          </Link>
        </div>

        {/* Form Container */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          padding: '2rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
              Create New Topic
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Topic Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  updateSlug(e.target.value);
                }}
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                placeholder="Enter topic name"
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Slug *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                required
                pattern="^[a-z0-9-]+$"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                placeholder="topic-slug"
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Lookback Days
                </label>
                <input
                  type="number"
                  value={formData.lookbackDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, lookbackDays: parseInt(e.target.value) || 7 }))}
                  min="1"
                  max="30"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500', marginTop: '1.75rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                    style={{ marginRight: '0.5rem' }}
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                OpenAI Assistant ID (Optional)
              </label>
              <input
                type="text"
                value={formData.assistantId}
                onChange={(e) => setFormData(prev => ({ ...prev, assistantId: e.target.value }))}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                placeholder="asst_..."
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                System Prompt (Optional)
              </label>
              <textarea
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                rows={8}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                placeholder="Enter custom prompt for OpenAI processing..."
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                Custom prompt to send to OpenAI before the news items content
              </p>
            </div>

            {/* Schedule */}
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem', color: '#1f2937' }}>Schedule</h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Cron Expression (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    placeholder="0 8 * * 1,3,5"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                    Timezone
                  </label>
                  <select
                    value={formData.cronTimezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, cronTimezone: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  >
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem', color: '#1f2937' }}>Keywords</h3>
              
              {/* Include Keywords */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Include Keywords
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    placeholder="Add keyword..."
                  />
                  <button type="button" onClick={addKeyword} className="btn btn-sm btn-primary">Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {formData.includeKeywords.map((keyword, index) => (
                    <span key={index} style={{ backgroundColor: '#e0f2fe', color: '#0277bd', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                      {keyword}
                      <button type="button" onClick={() => removeKeyword(keyword)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#0277bd', cursor: 'pointer' }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Exclude Keywords */}
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Exclude Keywords
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={newExcludeKeyword}
                    onChange={(e) => setNewExcludeKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())}
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    placeholder="Add exclude keyword..."
                  />
                  <button type="button" onClick={addExcludeKeyword} className="btn btn-sm btn-primary">Add</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {formData.excludeKeywords.map((keyword, index) => (
                    <span key={index} style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                      {keyword}
                      <button type="button" onClick={() => removeExcludeKeyword(keyword)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#c62828', cursor: 'pointer' }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Sources */}
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem', color: '#1f2937' }}>Sources *</h3>
              
              {/* Source List */}
              <div style={{ marginBottom: '0.5rem' }}>
                {formData.sources.map((source, index) => (
                  <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{source.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {source.type} • {source.url}
                          {!source.enabled && ' • Disabled'}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeSource(index)} className="btn btn-sm" style={{backgroundColor: '#fee', color: '#b91c1c'}}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Source Form */}
              {showSourceForm && (
                <div style={{ border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={newSource.name}
                      onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                      placeholder="Source name"
                    />
                    <select
                      value={newSource.type}
                      onChange={(e) => setNewSource(prev => ({ ...prev, type: e.target.value as any }))}
                      style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                    >
                      <option value="rss">RSS</option>
                      <option value="github">GitHub</option>
                      <option value="discord">Discord</option>
                      <option value="content_monitor">Content Monitor</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="url"
                      value={newSource.url}
                      onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                      style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                      placeholder="Source URL"
                    />
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={newSource.enabled}
                        onChange={(e) => setNewSource(prev => ({ ...prev, enabled: e.target.checked }))}
                        style={{ marginRight: '0.25rem' }}
                      />
                      Enabled
                    </label>
                    <button type="button" onClick={addSource} className="btn btn-sm btn-primary">Add</button>
                    <button type="button" onClick={() => setShowSourceForm(false)} className="btn btn-sm btn-secondary">Cancel</button>
                  </div>
                </div>
              )}
              {!showSourceForm && (
                <button type="button" onClick={() => setShowSourceForm(true)} className="btn btn-sm btn-primary">
                  + Add Source
                </button>
              )}
              {formData.sources.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  At least one source is required
                </p>
              )}
            </div>

            {/* Slack Channels */}
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem', color: '#1f2937' }}>Slack Channels</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={newSlackChannel}
                  onChange={(e) => setNewSlackChannel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSlackChannel())}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  placeholder="#channel-name"
                />
                <button type="button" onClick={addSlackChannel} className="btn btn-sm btn-primary">Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {formData.slackChannels.map((channel, index) => (
                  <span key={index} style={{ backgroundColor: '#f0f9ff', color: '#0369a1', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                    {channel}
                    <button type="button" onClick={() => removeSlackChannel(channel)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer' }}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              marginTop: '2rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button
                type="button"
                onClick={() => navigate('/topics')}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || formData.sources.length === 0}
              >
                {loading ? 'Creating...' : 'Create Topic'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}