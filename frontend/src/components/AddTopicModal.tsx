import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTopicAdded: () => void;
  editingTopic?: any; // Topic data for editing, null for creation
}

interface Source {
  name: string;
  type: 'rss' | 'github' | 'discord' | 'content_monitor';
  url: string;
  enabled: boolean;
}

export function AddTopicModal({ isOpen, onClose, onTopicAdded, editingTopic }: AddTopicModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    enabled: true,
    lookbackDays: 7,
    assistantId: '',
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

  // Initialize form data when editing
  useEffect(() => {
    if (editingTopic) {
      console.log('Loading topic data for editing:', editingTopic.slug);
      // Load topic configuration
      fetch(`http://localhost:8000/topics/${editingTopic.slug}`, {
        headers: {
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
      })
      .then(response => response.json())
      .then(data => {
        console.log('Topic config loaded:', JSON.stringify(data, null, 2));
        const loadedData = {
          name: data.name || editingTopic.name,
          slug: data.slug || editingTopic.slug,
          enabled: data.enabled !== undefined ? data.enabled : true,
          lookbackDays: data.lookback_days || data.lookbackDays || 7,
          assistantId: data.assistantId || data.assistant_id || '',
          includeKeywords: data.include_keywords || data.includeKeywords || [],
          excludeKeywords: data.exclude_keywords || data.excludeKeywords || [],
          cronExpression: data.schedule?.cron || '',
          cronTimezone: data.schedule?.timezone || 'Europe/Paris',
          slackChannels: data.channels?.slack?.channels || [],
          sources: data.sources || []
        };
        
        console.log('Setting form data:', loadedData);
        console.log('Sources in loaded data:', loadedData.sources);
        console.log('Slack channels in loaded data:', loadedData.slackChannels);
        
        setFormData(prevData => ({
          ...loadedData
        }));
        
        // Also populate the source and slack channel arrays in the local state
        if (loadedData.sources.length > 0) {
          console.log('Loaded sources:', loadedData.sources);
        }
        if (loadedData.slackChannels.length > 0) {
          console.log('Loaded slack channels:', loadedData.slackChannels);
        }
      })
      .catch(error => {
        console.error('Error loading topic config:', error);
        // Fallback to basic data
        setFormData(prev => ({
          ...prev,
          name: editingTopic.name,
          slug: editingTopic.slug
        }));
      });
    } else {
      // Reset form for new topic
      setFormData({
        name: '',
        slug: '',
        enabled: true,
        lookbackDays: 7,
        assistantId: '',
        includeKeywords: [],
        excludeKeywords: [],
        cronExpression: '',
        cronTimezone: 'Europe/Paris',
        slackChannels: [],
        sources: []
      });
    }
  }, [editingTopic]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
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
        sources: [...prev.sources, newSource]
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
    setLoading(true);

    try {
      const isEditing = !!editingTopic;
      console.log(isEditing ? 'Updating topic:' : 'Creating topic:', formData);
      
      const requestBody = {
        name: formData.name,
        slug: formData.slug,
        enabled: formData.enabled,
        lookbackDays: formData.lookbackDays,
        assistantId: formData.assistantId || null,
        ...(formData.includeKeywords.length > 0 && { includeKeywords: formData.includeKeywords }),
        ...(formData.excludeKeywords.length > 0 && { excludeKeywords: formData.excludeKeywords }),
        ...(formData.cronExpression.trim() && {
          schedule: {
            cron: formData.cronExpression,
            timezone: formData.cronTimezone
          }
        }),
        sources: formData.sources,
        ...(formData.slackChannels.length > 0 && {
          channels: {
            slack: {
              channels: formData.slackChannels
            }
          }
        })
      };

      const url = isEditing 
        ? `http://localhost:8000/topics/${editingTopic.slug}`
        : 'http://localhost:8000/topics';
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-secure-api-key-minimum-32-chars',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(isEditing ? 'Topic updated:' : 'Topic created:', result);
        
        // Reset form only when creating new topic
        if (!isEditing) {
          setFormData({
            name: '',
            slug: '',
            enabled: true,
            lookbackDays: 7,
            assistantId: '',
            includeKeywords: [],
            excludeKeywords: [],
            cronExpression: '',
            cronTimezone: 'Europe/Paris',
            slackChannels: [],
            sources: []
          });
        }
        
        onTopicAdded();
        onClose();
      } else {
        const error = await response.text();
        console.error('API error:', error);
        alert('Failed to create topic: ' + response.status);
      }
      
    } catch (error) {
      console.error('Error creating topic:', error);
      alert('Error creating topic: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
            {editingTopic ? `Edit Topic: ${editingTopic.name}` : 'Create New Topic'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem'
            }}
          >
            <X className="icon" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Basic Information */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              Topic Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleNameChange}
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
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
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
                name="lookbackDays"
                value={formData.lookbackDays}
                onChange={handleInputChange}
                min="1"
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', fontWeight: '500', marginTop: '1.75rem' }}>
                <input
                  type="checkbox"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleInputChange}
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
              name="assistantId"
              value={formData.assistantId}
              onChange={handleInputChange}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
              placeholder="asst_..."
            />
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
                  name="cronExpression"
                  value={formData.cronExpression}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                  placeholder="0 8 * * 1,3,5"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Timezone
                </label>
                <select
                  name="cronTimezone"
                  value={formData.cronTimezone}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem' }}
                >
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
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
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
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
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())}
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
            {showSourceForm ? (
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
            ) : (
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
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSlackChannel())}
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
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb'
          }}>
            <button
              type="button"
              onClick={onClose}
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
              {loading ? (editingTopic ? 'Updating...' : 'Creating...') : (editingTopic ? 'Update Topic' : 'Create Topic')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}