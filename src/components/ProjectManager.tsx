// src/components/ProjectManager.tsx
"use client";

import { useState, useEffect } from 'react';
import { ProjectBudget, loadProjectBudgets, saveProjectBudgets, getProjectProgress } from '@/lib/timeAnalytics';

interface ProjectManagerProps {
  entries: any[];
  onProjectSelect?: (project: string, customer: string) => void;
}

export default function ProjectManager({ entries, onProjectSelect }: ProjectManagerProps) {
  const [projects, setProjects] = useState<ProjectBudget[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    customer: '',
    budgetHours: '',
    hourlyRate: '',
    startDate: '',
    endDate: '',
    status: 'active' as const
  });

  useEffect(() => {
    setProjects(loadProjectBudgets());
  }, []);

  function saveProjects(newProjects: ProjectBudget[]) {
    setProjects(newProjects);
    saveProjectBudgets(newProjects);
  }

  function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.customer || !formData.budgetHours) return;

    const project: ProjectBudget = {
      id: crypto.randomUUID(),
      name: formData.name,
      customer: formData.customer,
      budgetHours: Number(formData.budgetHours),
      hourlyRate: Number(formData.hourlyRate) || 0,
      startDate: formData.startDate || new Date().toISOString().split('T')[0],
      endDate: formData.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: formData.status,
      createdAt: new Date().toISOString()
    };

    saveProjects([...projects, project]);
    setFormData({
      name: '',
      customer: '',
      budgetHours: '',
      hourlyRate: '',
      startDate: '',
      endDate: '',
      status: 'active'
    });
    setShowAddForm(false);
  }

  function updateProjectStatus(id: string, status: ProjectBudget['status']) {
    const updated = projects.map(p => p.id === id ? { ...p, status } : p);
    saveProjects(updated);
  }

  function deleteProject(id: string) {
    if (confirm('Är du säker på att du vill ta bort detta projekt?')) {
      saveProjects(projects.filter(p => p.id !== id));
    }
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Projekthantering</h3>
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid #10b981',
            background: '#10b981',
            color: 'white',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          + Nytt projekt
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addProject} style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16, 
          background: '#f8fafc' 
        }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Lägg till nytt projekt</h4>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <input
              placeholder="Projektnamn"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            />
            <input
              placeholder="Kund"
              value={formData.customer}
              onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            />
            <input
              placeholder="Budget (timmar)"
              type="number"
              value={formData.budgetHours}
              onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
              required
            />
            <input
              placeholder="Timpris (kr)"
              type="number"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            />
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            />
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: '#10b981',
                color: 'white'
              }}
            >
              Skapa projekt
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: 'white'
              }}
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {projects.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 20 }}>
            Inga projekt ännu. Skapa ditt första projekt ovan.
          </div>
        ) : (
          projects.map(project => {
            const progress = getProjectProgress(project, entries);
            const progressColor = progress.isOverBudget ? '#ef4444' : 
                                 progress.percentage > 80 ? '#f59e0b' : '#10b981';

            return (
              <div key={project.id} style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: 8, 
                padding: 16,
                background: project.status === 'active' ? 'white' : '#f8fafc'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      {project.name}
                    </h4>
                    <div style={{ fontSize: 14, color: '#6b7280' }}>
                      {project.customer} • {project.startDate} → {project.endDate}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={project.status}
                      onChange={(e) => updateProjectStatus(project.id, e.target.value as ProjectBudget['status'])}
                      style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', fontSize: 12 }}
                    >
                      <option value="active">Aktiv</option>
                      <option value="completed">Slutförd</option>
                      <option value="on_hold">Pausad</option>
                    </select>
                    <button
                      onClick={() => deleteProject(project.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #ef4444',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: 12
                      }}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>
                      {progress.usedHours.toFixed(1)}h / {project.budgetHours}h
                    </span>
                    <span style={{ fontSize: 12, color: progressColor, fontWeight: 600 }}>
                      {progress.percentage}%
                    </span>
                  </div>
                  <div style={{ 
                    height: 8, 
                    backgroundColor: '#f1f5f9', 
                    borderRadius: 4, 
                    overflow: 'hidden' 
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, progress.percentage)}%`,
                      backgroundColor: progressColor,
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Project stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Återstående</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {progress.remainingHours.toFixed(1)}h
                    </div>
                  </div>
                  {project.hourlyRate > 0 && (
                    <>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Intjänat</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {(progress.usedHours * project.hourlyRate).toLocaleString('sv-SE')} kr
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>Budget kvar</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {(progress.remainingHours * project.hourlyRate).toLocaleString('sv-SE')} kr
                        </div>
                      </div>
                    </>
                  )}
                  {progress.estimatedCompletion && (
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>Beräknat klart</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {progress.estimatedCompletion.toLocaleDateString('sv-SE')}
                      </div>
                    </div>
                  )}
                </div>

                {onProjectSelect && (
                  <button
                    onClick={() => onProjectSelect(project.name, project.customer)}
                    style={{
                      marginTop: 12,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #0ea5e9',
                      background: '#0ea5e9',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  >
                    Välj för tidrapport
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
