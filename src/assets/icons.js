import React from 'react';
import { Svg, Circle, Path, Line, Polyline } from 'react-native-svg';

// Settings icon
export const SettingsIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6m-17.78 7.78l4.24-4.24m5.08-5.08l4.24-4.24" />
  </Svg>
);

// Folder icon
export const FolderIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
  </Svg>
);

// Peer/Network icon
export const PeerIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="6" cy="6" r="3" />
    <Circle cx="18" cy="6" r="3" />
    <Circle cx="12" cy="18" r="3" />
    <Path d="M9 9l6 6M15 9l-6 6M9 9h6M12 9v9" />
  </Svg>
);

// Cloud icon (Remote)
export const CloudIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M18.15 13a4 4 0 1 0-7.88.46M8.13 20.73A5 5 0 0 0 17 20h.5a5.5 5.5 0 0 0 .5-11" />
  </Svg>
);

// Branch icon
export const BranchIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Line x1="6" y1="3" x2="6" y2="15" />
    <Circle cx="18" cy="6" r="3" />
    <Circle cx="6" cy="18" r="3" />
    <Path d="M18 9a9 9 0 0 1-9 9" />
  </Svg>
);

// Log/Clipboard icon
export const LogIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M9 11l3 3L22 4" />
    <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </Svg>
);

// Files icon
export const FilesIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <Polyline points="13 2 13 9 20 9" />
  </Svg>
);

// Edit/Changes icon
export const EditIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

// Pull Request/Merge icon
export const MergeIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Line x1="18" y1="8" x2="18" y2="16" />
    <Line x1="18" y1="8" x2="9" y2="12" />
    <Line x1="18" y1="16" x2="9" y2="12" />
  </Svg>
);

// Download/Clone icon
export const DownloadIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Svg>
);

// Celebrate icon (Party)
export const CelebrationIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M11.5 1L14 8h7.5l-6 4.5 2.5 7.5L11.5 16l-6 4.5 2.5-7.5L1 8h7.5L11.5 1z" />
  </Svg>
);

// Plus icon
export const PlusIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

// Checkmark icon
export const CheckIcon = ({ color = '#3fb950', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

// X/Close icon
export const CloseIcon = ({ color = '#f78166', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);

// New/Folder Plus icon
export const NewFolderIcon = ({ color = '#58a6ff', size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2zM12 11v6M9 14h6" stroke={color} strokeWidth="1" fill="none" />
  </Svg>
);
