import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

interface Source {
  name: string;
  type: 'rss' | 'github' | 'discord' | 'content_monitor';
  url: string;
  enabled: boolean;
}

export function TopicEdit() {
  const { slug } = useParams<{ slug: string }>();
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
  const [loadingData, setLoadingData] = useState(true);
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
    if (slug) {
      console.log('Loading topic data for editing:', slug);
      // Load topic configuration
      fetch(`http://localhost:8000/topics/${slug}`, {
        headers: {
          "Authorization": `Bearer your-secure-api-key-minimum-32-chars`,
        },
      })
      .then(response => response.json())
      .then(data => {
        console.log('Topic config loaded:', JSON.stringify(data, null, 2));
        const loadedData = {
          name: data.name || slug,
          slug: data.slug || slug,
          enabled: data.enabled !== undefined ? data.enabled : true,
          lookbackDays: data.lookback_days || data.lookbackDays || 7,
          assistantId: data.assistantId || data.assistant_id || '',
          prompt: data.prompt || `Analyze the following developer news items and create a comprehensive summary for developers.

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
          includeKeywords: data.include_keywords || data.includeKeywords || [],
          excludeKeywords: data.exclude_keywords || data.excludeKeywords || [],
          cronExpression: data.schedule?.cron || '',
          cronTimezone: data.schedule?.timezone || 'Europe/Paris',
          slackChannels: data.channels?.slack?.channels || [],
          sources: data.sources || []
        };
        
        console.log('Setting form data:', loadedData);
        setFormData(loadedData);
        setLoadingData(false);
      })
      .catch(error => {
        console.error('Error loading topic config:', error);
        setLoadingData(false);
        // Fallback to basic data
        setFormData(prev => ({
          ...prev,
          name: slug,
          slug: slug
        }));
      });
    }
  }, [slug]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
      const requestBody = {
        name: formData.name,
        slug: formData.slug,
        enabled: formData.enabled,
        lookbackDays: formData.lookbackDays,
        assistantId: formData.assistantId || null,
        prompt: formData.prompt || null,
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

      const response = await fetch(`http://localhost:8000/topics/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer your-secure-api-key-minimum-32-chars',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Topic updated:', result);
        navigate(`/topics/${slug}`);
      } else {
        const error = await response.text();
        console.error('API error:', error);
        alert('Failed to update topic: ' + response.status);
      }
      
    } catch (error) {
      console.error('Error updating topic:', error);
      alert('Error updating topic: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div>
        <div className="mb-6">
          <Link
            to={`/topics/${slug}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Topic
          </Link>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <div>Loading topic data...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link
            to={`/topics/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#6b7280',
              textDecoration: 'none'
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Topic
          </Link>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f8fafc'
          }}>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#111827',
              margin: '0'
            }}>Edit Topic</h1>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            {/* Basic Information */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="name" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Topic Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter topic name"
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="slug" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                Slug *
              </label>
              <input
                type="text"
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleInputChange}
                required
                pattern="^[a-z0-9-]+$"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                placeholder="topic-slug"
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <p style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '4px',
                margin: '4px 0 0 0'
              }}>
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <div>
                <label htmlFor="lookbackDays" style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px'
                }}>
                  Lookback Days
                </label>
                <input
                  type="number"
                  id="lookbackDays"
                  name="lookbackDays"
                  value={formData.lookbackDays}
                  onChange={handleInputChange}
                  min="1"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                paddingTop: '28px'
              }}>
                <input
                  type="checkbox"
                  id="enabled"
                  name="enabled"
                  checked={formData.enabled}
                  onChange={handleInputChange}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#3b82f6'
                  }}
                />
                <label htmlFor="enabled" style={{
                  marginLeft: '8px',
                  fontSize: '14px',
                  color: '#111827'
                }}>
                  Enabled
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="assistantId" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                OpenAI Assistant ID (Optional)
              </label>
              <input
                type="text"
                id="assistantId"
                name="assistantId"
                value={formData.assistantId}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                placeholder="asst_..."
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="prompt" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px'
              }}>
                System Prompt (Optional)
              </label>
              <textarea
                id="prompt"
                name="prompt"
                value={formData.prompt}
                onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                rows={8}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontFamily: 'Monaco, Menlo, Consolas, monospace',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  minHeight: '120px'
                }}
                placeholder="Enter custom prompt for OpenAI processing..."
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <p style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '4px',
                margin: '4px 0 0 0'
              }}>
                Custom prompt to send to OpenAI before the news items content
              </p>
            </div>

            {/* Schedule */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px'
              }}>Schedule</h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '16px'
              }}>
                <div>
                  <label htmlFor="cronExpression" style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Cron Expression (Optional)
                  </label>
                  <input
                    type="text"
                    id="cronExpression"
                    name="cronExpression"
                    value={formData.cronExpression}
                    onChange={handleInputChange}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    placeholder="0 8 * * 1,3,5"
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                <div>
                  <label htmlFor="cronTimezone" style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '6px'
                  }}>
                    Timezone
                  </label>
                  <select
                    id="cronTimezone"
                    name="cronTimezone"
                    value={formData.cronTimezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, cronTimezone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
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
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px'
              }}>Keywords</h3>
            
              {/* Include Keywords */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Include Keywords
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    style={{
                      flex: '1',
                      padding: '8px 12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Add keyword..."
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                  <button type="button" onClick={addKeyword} className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    Add
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '8px'
                }}>
                  {formData.includeKeywords.map((keyword, index) => (
                    <span key={index} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      fontSize: '12px',
                      fontWeight: '500',
                      borderRadius: '16px'
                    }}>
                      {keyword}
                      <button type="button" onClick={() => removeKeyword(keyword)} style={{
                        marginLeft: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#60a5fa',
                        cursor: 'pointer'
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Exclude Keywords */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Exclude Keywords
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newExcludeKeyword}
                    onChange={(e) => setNewExcludeKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExcludeKeyword())}
                    style={{
                      flex: '1',
                      padding: '8px 12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Add exclude keyword..."
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                  <button type="button" onClick={addExcludeKeyword} className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    Add
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginTop: '8px'
                }}>
                  {formData.excludeKeywords.map((keyword, index) => (
                    <span key={index} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 12px',
                      backgroundColor: '#fecaca',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: '500',
                      borderRadius: '16px'
                    }}>
                      {keyword}
                      <button type="button" onClick={() => removeExcludeKeyword(keyword)} style={{
                        marginLeft: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer'
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Sources */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px'
              }}>Sources *</h3>
            
              {/* Source List */}
              <div style={{ marginBottom: '16px' }}>
                {formData.sources.map((source, index) => (
                  <div key={index} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: '1' }}>
                        <div style={{ fontWeight: '500', fontSize: '14px' }}>{source.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {source.type} • {source.url}
                          {!source.enabled && ' • Disabled'}
                        </div>
                      </div>
                      <button type="button" onClick={() => removeSource(index)} style={{
                        marginLeft: '12px',
                        fontSize: '14px',
                        color: '#dc2626',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                      }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Add Source Form */}
              {showSourceForm ? (
                <div style={{
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <input
                      type="text"
                      value={newSource.name}
                      onChange={(e) => setNewSource(prev => ({ ...prev, name: e.target.value }))}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box'
                      }}
                      placeholder="Source name"
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <select
                      value={newSource.type}
                      onChange={(e) => setNewSource(prev => ({ ...prev, type: e.target.value as any }))}
                      style={{
                        padding: '8px 12px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    >
                      <option value="rss">RSS</option>
                      <option value="github">GitHub</option>
                      <option value="discord">Discord</option>
                      <option value="content_monitor">Content Monitor</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <input
                      type="url"
                      value={newSource.url}
                      onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                      style={{
                        flex: '1',
                        padding: '8px 12px',
                        border: '2px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        boxSizing: 'border-box'
                      }}
                      placeholder="Source URL"
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '14px'
                    }}>
                      <input
                        type="checkbox"
                        checked={newSource.enabled}
                        onChange={(e) => setNewSource(prev => ({ ...prev, enabled: e.target.checked }))}
                        style={{
                          marginRight: '8px',
                          width: '16px',
                          height: '16px',
                          accentColor: '#3b82f6'
                        }}
                      />
                      Enabled
                    </label>
                    <button type="button" onClick={addSource} className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                      Add
                    </button>
                    <button type="button" onClick={() => setShowSourceForm(false)} className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowSourceForm(true)} style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '8px 16px',
                  backgroundColor: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: '8px'
                }}>
                  + Add Source
                </button>
              )}

              {formData.sources.length === 0 && (
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginTop: '8px'
                }}>
                  At least one source is required
                </p>
              )}
            </div>

            {/* Slack Channels */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                marginBottom: '16px'
              }}>Slack Channels</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newSlackChannel}
                  onChange={(e) => setNewSlackChannel(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSlackChannel())}
                  style={{
                    flex: '1',
                    padding: '8px 12px',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    boxSizing: 'border-box'
                  }}
                  placeholder="#channel-name"
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button type="button" onClick={addSlackChannel} className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                  Add
                </button>
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '8px'
              }}>
                {formData.slackChannels.map((channel, index) => (
                  <span key={index} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    fontSize: '12px',
                    fontWeight: '500',
                    borderRadius: '16px'
                  }}>
                    {channel}
                    <button type="button" onClick={() => removeSlackChannel(channel)} style={{
                      marginLeft: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#34d399',
                      cursor: 'pointer'
                    }}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '24px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <Link
                to={`/topics/${slug}`}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || formData.sources.length === 0}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Topic'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}