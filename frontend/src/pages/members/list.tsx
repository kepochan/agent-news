import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, User } from "lucide-react";

interface Member {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  addedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export function MembersList() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newMember, setNewMember] = useState({
    email: '',
    name: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch('http://localhost:8000/members', {
        headers: getAuthHeaders(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      } else {
        console.error('Failed to fetch members:', response.status);
      }
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:8000/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newMember),
      });

      if (response.ok) {
        fetchMembers();
        setShowAddModal(false);
        setNewMember({ email: '', name: '', role: 'user' });
      } else {
        const error = await response.text();
        alert('Failed to add member: ' + error);
      }
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Error adding member');
    }
  };

  const handleUpdateMember = async (member: Member) => {
    try {
      const response = await fetch(`http://localhost:8000/members/${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: member.name,
          role: member.role,
          isActive: member.isActive,
        }),
      });

      if (response.ok) {
        fetchMembers();
        setEditingMember(null);
      } else {
        const error = await response.text();
        alert('Failed to update member: ' + error);
      }
    } catch (error) {
      console.error('Error updating member:', error);
      alert('Error updating member');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:8000/members/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        fetchMembers();
      } else {
        const error = await response.text();
        alert('Failed to delete member: ' + error);
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Error deleting member');
    }
  };

  const toggleMemberStatus = async (member: Member) => {
    await handleUpdateMember({ ...member, isActive: !member.isActive });
  };

  if (loading) {
    return <div className="loading">Loading members...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Members Management</h1>
          <p className="subtitle">
            Manage whitelist of users who can access the application
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus className="icon-sm" />
            Add Member
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {member.role === 'admin' ? (
                      <Shield className="icon-sm text-amber-600" />
                    ) : (
                      <User className="icon-sm text-gray-500" />
                    )}
                    {member.email}
                  </div>
                </td>
                <td>
                  {editingMember?.id === member.id ? (
                    <input
                      type="text"
                      value={editingMember.name || ''}
                      onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                      className="input-sm"
                    />
                  ) : (
                    member.name || '-'
                  )}
                </td>
                <td>
                  {editingMember?.id === member.id ? (
                    <select
                      value={editingMember.role}
                      onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value as 'admin' | 'user' })}
                      className="input-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`badge ${member.role === 'admin' ? 'badge-warning' : 'badge-info'}`}>
                      {member.role}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    onClick={() => toggleMemberStatus(member)}
                    className={`btn btn-sm ${member.isActive ? 'btn-success' : 'btn-secondary'}`}
                  >
                    {member.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td>
                  <div className="text-sm text-gray-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td>
                  <div className="flex gap-2">
                    {editingMember?.id === member.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateMember(editingMember)}
                          className="btn btn-sm btn-primary"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="btn btn-sm btn-secondary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingMember(member)}
                          className="btn btn-sm btn-secondary"
                        >
                          <Edit className="icon-xs" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="btn btn-sm btn-danger"
                        >
                          <Trash2 className="icon-xs" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Member</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleAddMember}>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Role</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember({...newMember, role: e.target.value as 'admin' | 'user'})}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}