import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Shield, User } from "lucide-react";
import { API_BASE_URL } from '../../config/api';

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
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [showAddRow, setShowAddRow] = useState(false);
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
      const response = await fetch(`${API_BASE_URL}/members`, {
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

  const handleAddMember = async () => {
    if (!newMember.email.trim()) {
      alert('Email is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(newMember),
      });

      if (response.ok) {
        fetchMembers();
        setShowAddRow(false);
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

  const handleCancelAdd = () => {
    setShowAddRow(false);
    setNewMember({ email: '', name: '', role: 'user' });
  };

  const handleUpdateMember = async (member: Member) => {
    try {
      const response = await fetch(`${API_BASE_URL}/members/${member.id}`, {
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
      const response = await fetch(`${API_BASE_URL}/members/${id}`, {
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
          <button className="btn btn-primary" onClick={() => setShowAddRow(true)}>
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
            {showAddRow && (
              <tr className="bg-blue-50">
                <td>
                  <input
                    type="email"
                    placeholder="Enter email address"
                    value={newMember.email}
                    onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                    className="input-sm w-full"
                    autoFocus
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="Name (optional)"
                    value={newMember.name}
                    onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                    className="input-sm w-full"
                  />
                </td>
                <td>
                  <select
                    value={newMember.role}
                    onChange={(e) => setNewMember({...newMember, role: e.target.value as 'admin' | 'user'})}
                    className="input-sm w-full"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className="text-sm text-gray-500">Will be active</span>
                </td>
                <td>
                  <span className="text-sm text-gray-500">-</span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddMember}
                      className="btn btn-sm btn-success"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelAdd}
                      className="btn btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}
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

    </div>
  );
}