import React from 'react';
import {
  SettingsIcon,
  FolderIcon,
  PeerIcon,
  CloudIcon,
  BranchIcon,
  LogIcon,
  FilesIcon,
  EditIcon,
  MergeIcon,
  DownloadIcon,
  CelebrationIcon,
  PlusIcon,
  CheckIcon,
  CloseIcon,
  NewFolderIcon,
} from '../assets/icons';

/**
 * Icon component wrapper for easy usage in React Native views
 * Usage: <Icon name="settings" size={24} color="#58a6ff" />
 */
export const Icon = ({ name, size = 24, color = '#58a6ff' }) => {
  const icons = {
    settings: SettingsIcon,
    folder: FolderIcon,
    peer: PeerIcon,
    cloud: CloudIcon,
    branch: BranchIcon,
    log: LogIcon,
    files: FilesIcon,
    edit: EditIcon,
    merge: MergeIcon,
    download: DownloadIcon,
    celebration: CelebrationIcon,
    plus: PlusIcon,
    check: CheckIcon,
    close: CloseIcon,
    newFolder: NewFolderIcon,
  };

  const IconComponent = icons[name];
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return <IconComponent size={size} color={color} />;
};

export default Icon;
