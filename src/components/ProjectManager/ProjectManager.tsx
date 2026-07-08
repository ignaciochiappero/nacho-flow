import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Checkbox,
  Typography,
  Box,
  TextField,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  Add as AddIcon,
  Check as CheckIcon,
  FolderOpen as OpenIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { api, ProjectSummary } from 'src/services/api';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { modelFromModelStore } from 'src/utils';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';

interface ProjectManagerProps {
  open: boolean;
  onClose: () => void;
}

export const ProjectManager = ({ open, onClose }: ProjectManagerProps) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const model = useModelStore((state) => modelFromModelStore(state));
  const currentProjectId = useUiStateStore((state) => state.currentProjectId);
  const currentProjectTitle = useUiStateStore((state) => state.currentProjectTitle);
  const setCurrentProject = useUiStateStore((state) => state.actions.setCurrentProject);
  const forceSaveCallback = useUiStateStore((state) => state.forceSaveCallback);
  const { load } = useInitialDataManager();

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'error' });
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: 'success' });
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      showError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    if (open) {
      loadProjects();
      setSelectedIds([]);
    }
  }, [open, loadProjects]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;

    try {
      const project = await api.createProject(newTitle.trim(), model);
      setNewTitle('');
      setCurrentProject(project.id, project.title);
      showSuccess(`Project "${project.title}" created`);
      loadProjects();
    } catch (err) {
      showError('Failed to create project');
    }
  }, [newTitle, model, loadProjects, setCurrentProject, showError, showSuccess]);

  const handleOpen = useCallback(async (id: string, title: string) => {
    try {
      const project = await api.getProject(id);
      const result = load(project.model, { fitToView: true, resetUi: true });

      if (!result.success) {
        showError(`Could not open project: ${result.message}`);
        return;
      }

      setCurrentProject(id, title);
      showSuccess(`Opened "${title}"`);
      onClose();
    } catch (err) {
      showError('Failed to open project');
    }
  }, [load, setCurrentProject, onClose, showError, showSuccess]);

  const handleForceSave = useCallback(async () => {
    if (!currentProjectId) {
      showError('No project is open');
      return;
    }

    if (!forceSaveCallback) {
      showError('Save is not ready yet');
      return;
    }

    const saved = await forceSaveCallback();

    if (saved) {
      showSuccess('Project saved');
    } else {
      showError('Failed to save project');
    }
  }, [currentProjectId, forceSaveCallback, showError, showSuccess]);

  const handleDelete = useCallback(async (id: string, title: string) => {
    if (!confirm(`Delete project "${title}"?`)) return;

    try {
      await api.deleteProject(id);
      if (currentProjectId === id) {
        setCurrentProject(null, null);
      }
      showSuccess(`Project "${title}" deleted`);
      loadProjects();
    } catch (err) {
      showError('Failed to delete project');
    }
  }, [loadProjects, currentProjectId, setCurrentProject, showError, showSuccess]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleExportSqlite = useCallback(async (ids?: string[]) => {
    try {
      const blob = await api.exportSqlite(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `isoflow-projects-${Date.now()}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('SQLite file exported');
    } catch (err) {
      showError('Failed to export SQLite');
    }
  }, [showError, showSuccess]);

  const handleImportSqlite = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sqlite,.db';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      showSuccess('SQLite import is under development');
    };

    input.click();
  }, [showSuccess]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const singleSelected = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Project Manager</DialogTitle>

        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder="New project title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              fullWidth
            />
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              startIcon={<AddIcon />}
            >
              Create
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {loading ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Loading projects...
            </Typography>
          ) : projects.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No saved projects yet
            </Typography>
          ) : (
            <List dense>
              {projects.map((project) => (
                <ListItem
                  key={project.id}
                  button
                  onClick={() => handleToggleSelect(project.id)}
                  onDoubleClick={() => handleOpen(project.id, project.title)}
                  sx={{ borderRadius: 1 }}
                >
                  <Checkbox
                    edge="start"
                    checked={selectedIds.includes(project.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(project.id);
                    }}
                  />
                  <ListItemText
                    primary={project.title}
                    secondary={`Updated: ${formatDate(project.updated_at)}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(project.id, project.title);
                      }}
                      title="Open project"
                    >
                      <OpenIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id, project.title);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>

        <DialogActions>
          {currentProjectId && (
            <Button
              onClick={handleForceSave}
              startIcon={<SaveIcon />}
              color="primary"
            >
              Save "{currentProjectTitle}"
            </Button>
          )}
          <Button onClick={handleImportSqlite} startIcon={<ImportIcon />}>
            Import SQLite
          </Button>
          <Button
            onClick={() => handleExportSqlite()}
            startIcon={<ExportIcon />}
          >
            Export All
          </Button>
          {selectedIds.length > 0 && (
            <Button
              variant="contained"
              onClick={() => handleExportSqlite(selectedIds)}
              startIcon={<CheckIcon />}
            >
              Export Selected ({selectedIds.length})
            </Button>
          )}
          {singleSelected && (
            <Button
              variant="contained"
              color="success"
              onClick={() => {
                const p = projects.find((proj) => proj.id === singleSelected);
                if (p) handleOpen(singleSelected, p.title);
              }}
              startIcon={<OpenIcon />}
            >
              Open
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};
