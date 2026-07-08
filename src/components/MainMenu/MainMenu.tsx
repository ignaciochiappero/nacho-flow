import React, { useState, useCallback, useMemo } from 'react';
import { Menu, Typography, Divider, Card } from '@mui/material';
import {
  Menu as MenuIcon,
  GitHub as GitHubIcon,
  QuestionAnswer as QuestionAnswerIcon,
  DataObject as ExportJsonIcon,
  ImageOutlined as ExportImageIcon,
  FolderOpen as FolderOpenIcon,
  DeleteOutline as DeleteOutlineIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { exportAsJSON, modelFromModelStore } from 'src/utils';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import { useModelStore } from 'src/stores/modelStore';
import { MenuItem } from './MenuItem';

export const MainMenu = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const model = useModelStore((state) => {
    return modelFromModelStore(state);
  });
  const isMainMenuOpen = useUiStateStore((state) => {
    return state.isMainMenuOpen;
  });
  const mainMenuOptions = useUiStateStore((state) => {
    return state.mainMenuOptions;
  });
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const initialDataManager = useInitialDataManager();

  const onToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
      uiStateActions.setIsMainMenuOpen(true);
    },
    [uiStateActions]
  );

  const gotoUrl = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  const { load } = initialDataManager;

  const onOpenModel = useCallback(async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';

    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (!file) {
        return;
      }

      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        try {
          const raw = e.target?.result;
          if (typeof raw !== 'string') {
            throw new Error('Invalid file contents');
          }

          const modelData = JSON.parse(raw);
          uiStateActions.setCurrentProject(null, null);

          const result = load(modelData, { fitToView: true, resetUi: true });

          if (!result.success) {
            window.alert(`Could not open model:\n${result.message}`);
            return;
          }
        } catch {
          window.alert('The selected file is not valid JSON.');
        }
      };

      fileReader.onerror = () => {
        window.alert('Failed to read the selected file.');
      };

      fileReader.readAsText(file);
    };

    await fileInput.click();
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, load]);

  const onExportAsJSON = useCallback(async () => {
    exportAsJSON(model);
    uiStateActions.setIsMainMenuOpen(false);
  }, [model, uiStateActions]);

  const onExportAsImage = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog('EXPORT_IMAGE');
  }, [uiStateActions]);

  const { clear } = initialDataManager;

  const onClearCanvas = useCallback(() => {
    clear();
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, clear]);

  const onOpenProjectManager = useCallback(() => {
    uiStateActions.setIsProjectManagerOpen(true);
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions]);

  const sectionVisibility = useMemo(() => {
    return {
      actions: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('ACTION') || opt.includes('EXPORT');
        })
      ),
      links: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('LINK');
        })
      ),
      version: Boolean(mainMenuOptions.includes('VERSION'))
    };
  }, [mainMenuOptions]);

  if (mainMenuOptions.length === 0) {
    return null;
  }

  return (
    <UiElement>
      <IconButton Icon={<MenuIcon />} name="Main menu" onClick={onToggleMenu} />

      <Menu
        anchorEl={anchorEl}
        open={isMainMenuOpen}
        onClose={() => {
          uiStateActions.setIsMainMenuOpen(false);
        }}
        elevation={0}
        sx={{
          mt: 2
        }}
        MenuListProps={{
          sx: {
            minWidth: '250px',
            py: 0
          }
        }}
      >
        <Card sx={{ py: 1 }}>
          {mainMenuOptions.includes('ACTION.OPEN') && (
            <MenuItem onClick={onOpenModel} Icon={<FolderOpenIcon />}>
              Open
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.JSON') && (
            <MenuItem onClick={onExportAsJSON} Icon={<ExportJsonIcon />}>
              Export as JSON
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.PNG') && (
            <MenuItem onClick={onExportAsImage} Icon={<ExportImageIcon />}>
              Export as image
            </MenuItem>
          )}

          {mainMenuOptions.includes('ACTION.CLEAR_CANVAS') && (
            <MenuItem onClick={onClearCanvas} Icon={<DeleteOutlineIcon />}>
              Clear the canvas
            </MenuItem>
          )}

          {mainMenuOptions.includes('PROJECT.MANAGER') && (
            <MenuItem onClick={onOpenProjectManager} Icon={<StorageIcon />}>
              Projects
            </MenuItem>
          )}

          {sectionVisibility.links && (
            <>
              <Divider />

              {mainMenuOptions.includes('LINK.GITHUB') && (
                <MenuItem
                  onClick={() => {
                    return gotoUrl(`${REPOSITORY_URL}`);
                  }}
                  Icon={<GitHubIcon />}
                >
                  GitHub
                </MenuItem>
              )}

              {mainMenuOptions.includes('LINK.DISCORD') && (
                <MenuItem
                  onClick={() => {
                    return gotoUrl('https://discord.gg/QYPkvZth7D');
                  }}
                  Icon={<QuestionAnswerIcon />}
                >
                  Discord
                </MenuItem>
              )}
            </>
          )}

          {sectionVisibility.version && (
            <>
              <Divider />

              {mainMenuOptions.includes('VERSION') && (
                <MenuItem>
                  <Typography variant="body2" color="text.secondary">
                    Isoflow v{PACKAGE_VERSION}
                  </Typography>
                </MenuItem>
              )}
            </>
          )}
        </Card>
      </Menu>
    </UiElement>
  );
};
