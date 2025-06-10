// FileSelector.js - Add to src/components directory

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  margin-bottom: 20px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const Title = styled.h4`
  margin: 0;
  color: #f0f6fc;
  font-size: 16px;
  font-weight: 600;
`;

const FileBrowser = styled.div`
  border: 1px solid #30363d;
  border-radius: 6px;
  background-color: #161b22;
  max-height: 300px;
  overflow-y: auto;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0d1117;
    border-radius: 0 6px 6px 0;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #58a6ff;
  }
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #21262d;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${props => props.selected ? 'rgba(56, 139, 253, 0.1)' : 'transparent'};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: ${props => props.selected ? 'rgba(56, 139, 253, 0.15)' : '#21262d'};
  }
`;

const FileIcon = styled.span`
  margin-right: 12px;
  font-size: 16px;
`;

const FileName = styled.span`
  flex: 1;
  color: ${props => props.selected ? '#58a6ff' : '#c9d1d9'};
`;

const Checkbox = styled.input`
  margin-left: 12px;
  cursor: pointer;
  width: 16px;
  height: 16px;
`;

const PathNavigator = styled.div`
  display: flex;
  align-items: center;
  background-color: #21262d;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  overflow-x: auto;
  white-space: nowrap;
  
  &::-webkit-scrollbar {
    height: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 2px;
  }
`;

const PathItem = styled.span`
  cursor: pointer;
  color: #58a6ff;
  transition: all 0.2s ease;
  
  &:hover {
    color: #f0f6fc;
    text-decoration: underline;
  }
`;

const PathSeparator = styled.span`
  margin: 0 8px;
  color: #8b949e;
`;

const EmptyState = styled.div`
  padding: 20px;
  text-align: center;
  color: #8b949e;
`;

const LoadingState = styled.div`
  padding: 20px;
  text-align: center;
  color: #8b949e;
`;

const FileSelector = ({ 
  repository, 
  onSelect, 
  selectedItems = [],
  octokit
}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Load contents when repository or path changes
  useEffect(() => {
    if (!repository || !octokit) return;
    
    const loadContents = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const encodedPath = currentPath ? currentPath.replace(/^\//, '') : '';
        const { data: contentsData } = await octokit.repos.getContent({
          owner: repository.owner.login,
          repo: repository.name,
          path: encodedPath,
          ref: 'main', // Default to main branch
          headers: { 'If-None-Match': '' } // Prevent caching
        });
        
        setContents(Array.isArray(contentsData) ? contentsData : [contentsData]);
      } catch (err) {
        console.error('Error loading contents:', err);
        setError('Failed to load repository contents');
        setContents([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadContents();
  }, [repository, currentPath, octokit]);
  
  // Handle item click (navigate or toggle selection)
  const handleItemClick = (item, isCheckboxClick) => {
    if (item.type === 'dir' && !isCheckboxClick) {
      // Navigate into directory
      setCurrentPath(item.path);
    } else {
      // Toggle selection
      const isSelected = selectedItems.some(
        selected => selected.path === item.path && selected.repo.id === repository.id
      );
      
      if (isSelected) {
        onSelect(selectedItems.filter(
          selected => !(selected.path === item.path && selected.repo.id === repository.id)
        ));
      } else {
        onSelect([...selectedItems, {
          ...item,
          repo: repository
        }]);
      }
    }
  };
  
  // Handle path navigation
  const handlePathNavigation = (index) => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const newPath = index < 0 ? '' : '/' + pathSegments.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };
  
  // Check if an item is selected
  const isItemSelected = (item) => {
    return selectedItems.some(
      selected => selected.path === item.path && selected.repo.id === repository.id
    );
  };
  
  // Render path navigation
  const renderPathNavigation = () => {
    const pathSegments = currentPath.split('/').filter(Boolean);
    
    return (
      <PathNavigator>
        <PathItem onClick={() => handlePathNavigation(-1)}>Root</PathItem>
        {pathSegments.map((segment, index) => (
          <React.Fragment key={index}>
            <PathSeparator>/</PathSeparator>
            <PathItem onClick={() => handlePathNavigation(index)}>
              {segment}
            </PathItem>
          </React.Fragment>
        ))}
      </PathNavigator>
    );
  };
  
  // Render content
  const renderContent = () => {
    if (loading) {
      return <LoadingState>Loading contents...</LoadingState>;
    }
    
    if (error) {
      return <EmptyState>{error}</EmptyState>;
    }
    
    if (contents.length === 0) {
      return <EmptyState>This directory is empty.</EmptyState>;
    }
    
    return contents
      .sort((a, b) => {
        // Sort directories first, then files, then alphabetically
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
      })
      .map(item => {
        const selected = isItemSelected(item);
        
        return (
          <FileItem 
            key={item.sha} 
            selected={selected}
            onClick={() => handleItemClick(item, false)}
          >
            <FileIcon>{item.type === 'dir' ? '📁' : '📄'}</FileIcon>
            <FileName selected={selected}>{item.name}</FileName>
            <Checkbox 
              type="checkbox" 
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                handleItemClick(item, true);
              }}
            />
          </FileItem>
        );
      });
  };
  
  return (
    <Container>
      <Header>
        <Title>{repository?.name || 'Select Files'}</Title>
      </Header>
      
      {repository && renderPathNavigation()}
      
      <FileBrowser>
        {renderContent()}
      </FileBrowser>
    </Container>
  );
};

export default FileSelector;
