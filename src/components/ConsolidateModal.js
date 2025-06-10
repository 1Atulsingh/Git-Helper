// ConsolidateModal.js - Add to src/components directory

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import RepositorySelector from './RepositorySelector';
import FileSelector from './FileSelector';
import PathConfigurator from './PathConfigurator';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(13, 17, 23, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in-out;
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background-color: #0d1117;
  border-radius: 10px;
  width: 700px;
  max-width: 90%;
  max-height: 90vh;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  border: 1px solid #30363d;
  animation: slideIn 0.3s ease-out;
  overflow: hidden;
  
  @keyframes slideIn {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

const ModalHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to right, #161b22, #0d1117);
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f0f6fc;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #0d1117;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #30363d;
    border-radius: 3px;
  }
`;

const ModalFooter = styled.div`
  padding: 16px 20px;
  border-top: 1px solid #30363d;
  display: flex;
  justify-content: space-between;
  background-color: #161b22;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
`;

const StepDot = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: ${props => props.active ? '#58a6ff' : '#30363d'};
  margin: 0 5px;
  transition: all 0.3s ease;
  
  ${props => props.completed && `
    background-color: #2ea043;
  `}
`;

const StepTitle = styled.h4`
  margin-top: 0;
  margin-bottom: 20px;
  color: #f0f6fc;
  font-size: 16px;
  font-weight: 600;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button`
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 10px 16px;
  font-size: 14px;
  
  &:focus {
    outline: none;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  background: linear-gradient(to bottom, #238636, #2ea043);
  color: white;
  border: none;
  
  &:hover:not(:disabled) {
    background: linear-gradient(to bottom, #2ea043, #238636);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  &:active:not(:disabled) {
    transform: translateY(1px);
  }
`;

const SecondaryButton = styled(Button)`
  background: linear-gradient(to bottom, #30363d, #21262d);
  color: #c9d1d9;
  border: 1px solid #30363d;
  
  &:hover:not(:disabled) {
    background: linear-gradient(to bottom, #3c444d, #30363d);
    color: #f0f6fc;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  
  &:hover {
    color: #f0f6fc;
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px #58a6ff;
  }
`;

const SourceRepoContainer = styled.div`
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
  background-color: #161b22;
`;

const SourceRepoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const SourceRepoTitle = styled.h5`
  margin: 0;
  color: #f0f6fc;
  font-size: 15px;
  font-weight: 600;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: #f85149;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 8px;
  border-radius: 4px;
  
  &:hover {
    background-color: rgba(248, 81, 73, 0.1);
  }
`;

const AddSourceButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px;
  background-color: #21262d;
  border: 1px dashed #30363d;
  border-radius: 6px;
  color: #58a6ff;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 20px;
  
  &:hover {
    background-color: #30363d;
    border-color: #58a6ff;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const WarningBox = styled.div`
  background-color: rgba(210, 153, 34, 0.1);
  border: 1px solid #d29922;
  border-radius: 6px;
  padding: 12px 16px;
  margin-top: 20px;
  color: #e3b341;
  font-size: 14px;
  
  strong {
    color: #f0f6fc;
  }
`;

const CommitMessageInput = styled.div`
  margin-top: 20px;
  
  label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #f0f6fc;
  }
  
  textarea {
    width: 100%;
    height: 80px;
    padding: 12px;
    border-radius: 6px;
    background-color: #21262d;
    color: #c9d1d9;
    border: 1px solid #30363d;
    resize: vertical;
    font-family: inherit;
    transition: all 0.2s ease;
    
    &:hover, &:focus {
      border-color: #58a6ff;
      outline: none;
    }
  }
`;

const SummaryItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #21262d;
  
  &:last-child {
    border-bottom: none;
  }
`;

const SummaryIcon = styled.span`
  margin-right: 12px;
  font-size: 16px;
`;

const SummaryContent = styled.div`
  flex: 1;
`;

const SummaryPath = styled.div`
  color: #c9d1d9;
  font-size: 14px;
`;

const SummarySource = styled.div`
  color: #8b949e;
  font-size: 12px;
`;

const SummaryTarget = styled.div`
  color: #58a6ff;
  font-size: 12px;
`;

const ProgressContainer = styled.div`
  margin-top: 20px;
`;

const ProgressBar = styled.div`
  height: 8px;
  background-color: #21262d;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div`
  height: 100%;
  background-color: #2ea043;
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  display: flex;
  justify-content: space-between;
  color: #8b949e;
  font-size: 12px;
`;

const StatusMessage = styled.div`
  margin-top: 12px;
  color: #c9d1d9;
  font-size: 14px;
`;

const MAX_SOURCE_REPOS = 3;

const ConsolidateModal = ({ 
  isOpen, 
  onClose, 
  repositories, 
  octokit,
  onConsolidate
}) => {
  const [step, setStep] = useState(1);
  const [targetRepo, setTargetRepo] = useState(null);
  const [sourceRepos, setSourceRepos] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [targetPaths, setTargetPaths] = useState({});
  const [commitMessage, setCommitMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  
  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTargetRepo(null);
      setSourceRepos([]);
      setSelectedItems({});
      setTargetPaths({});
      setCommitMessage('');
      setProgress(0);
      setStatus('');
      setIsProcessing(false);
      setErrors({});
    }
  }, [isOpen]);
  
  // Handle next step
  const handleNext = () => {
    if (step === 1) {
      // Validate target repo selection
      if (!targetRepo) {
        setErrors({ targetRepo: 'Please select a target repository' });
        return;
      }
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      // Validate source repo selection
      if (sourceRepos.length === 0) {
        setErrors({ sourceRepos: 'Please select at least one source repository' });
        return;
      }
      setErrors({});
      setStep(3);
    } else if (step === 3) {
      // Validate file selection and target paths
      const newErrors = {};
      
      sourceRepos.forEach(repo => {
        const repoItems = selectedItems[repo.id] || [];
        if (repoItems.length === 0) {
          newErrors[`items_${repo.id}`] = 'Please select at least one file or folder';
        }
        
        const path = targetPaths[repo.id] || '';
        if (!path.trim()) {
          newErrors[`path_${repo.id}`] = 'Please specify a target path';
        } else if (!/^[a-zA-Z0-9_\-\/\.]+$/.test(path)) {
          newErrors[`path_${repo.id}`] = 'Path contains invalid characters';
        }
      });
      
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      
      setErrors({});
      setStep(4);
    } else if (step === 4) {
      // Validate commit message
      if (!commitMessage.trim()) {
        setErrors({ commitMessage: 'Please enter a commit message' });
        return;
      }
      
      setErrors({});
      handleConsolidate();
    }
  };
  
  // Handle back step
  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };
  
  // Handle adding a source repository
  const handleAddSourceRepo = () => {
    if (sourceRepos.length < MAX_SOURCE_REPOS) {
      setSourceRepos([...sourceRepos, null]);
    }
  };
  
  // Handle removing a source repository
  const handleRemoveSourceRepo = (index) => {
    const newSourceRepos = [...sourceRepos];
    const removedRepo = newSourceRepos[index];
    newSourceRepos.splice(index, 1);
    setSourceRepos(newSourceRepos);
    
    // Clean up related state
    if (removedRepo) {
      const newSelectedItems = { ...selectedItems };
      delete newSelectedItems[removedRepo.id];
      setSelectedItems(newSelectedItems);
      
      const newTargetPaths = { ...targetPaths };
      delete newTargetPaths[removedRepo.id];
      setTargetPaths(newTargetPaths);
    }
  };
  
  // Handle updating a source repository
  const handleUpdateSourceRepo = (index, repo) => {
    const newSourceRepos = [...sourceRepos];
    newSourceRepos[index] = repo;
    setSourceRepos(newSourceRepos);
    
    // Initialize selected items and target path
    if (repo) {
      setSelectedItems(prev => ({
        ...prev,
        [repo.id]: prev[repo.id] || []
      }));
      
      setTargetPaths(prev => ({
        ...prev,
        [repo.id]: prev[repo.id] || repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
      }));
    }
  };
  
  // Handle selecting items from a repository
  const handleSelectItems = (repoId, items) => {
    setSelectedItems(prev => ({
      ...prev,
      [repoId]: items
    }));
  };
  
  // Handle updating target path
  const handleUpdateTargetPath = (repoId, path) => {
    setTargetPaths(prev => ({
      ...prev,
      [repoId]: path
    }));
  };
  
  // Handle consolidation
  const handleConsolidate = async () => {
    setIsProcessing(true);
    setProgress(0);
    setStatus('Preparing consolidation...');
    
    try {
      // Prepare data for consolidation
      const consolidationData = {
        targetRepo,
        sourceRepos: sourceRepos.filter(Boolean),
        selectedItems,
        targetPaths,
        commitMessage
      };
      
      // Call the consolidation function
      await onConsolidate(consolidationData, {
        onProgress: (percent, message) => {
          setProgress(percent);
          setStatus(message);
        }
      });
      
      // Success
      setProgress(100);
      setStatus('Consolidation completed successfully!');
      
      // Close modal after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Consolidation error:', error);
      setStatus(`Error: ${error.message || 'Failed to consolidate repositories'}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Get total selected items count
  const getTotalSelectedItems = () => {
    return Object.values(selectedItems).reduce((total, items) => total + items.length, 0);
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <StepTitle>Select Target Repository</StepTitle>
            <RepositorySelector
              label="Target Repository (where files will be consolidated)"
              repositories={repositories}
              selectedRepo={targetRepo}
              onChange={setTargetRepo}
              helperText="This is the repository where all selected files will be copied to."
              error={errors.targetRepo}
            />
          </>
        );
      case 2:
        return (
          <>
            <StepTitle>Select Source Repositories</StepTitle>
            
            {sourceRepos.map((repo, index) => (
              <SourceRepoContainer key={index}>
                <SourceRepoHeader>
                  <SourceRepoTitle>Source Repository {index + 1}</SourceRepoTitle>
                  <RemoveButton onClick={() => handleRemoveSourceRepo(index)}>
                    Remove
                  </RemoveButton>
                </SourceRepoHeader>
                
                <RepositorySelector
                  label={`Source Repository ${index + 1}`}
                  repositories={repositories}
                  selectedRepo={repo}
                  onChange={(selected) => handleUpdateSourceRepo(index, selected)}
                  excludeRepos={[targetRepo, ...sourceRepos.filter((r, i) => i !== index && r !== null)]}
                  helperText="Select a repository to copy files from."
                />
              </SourceRepoContainer>
            ))}
            
            {sourceRepos.length < MAX_SOURCE_REPOS && (
              <AddSourceButton 
                onClick={handleAddSourceRepo}
                disabled={sourceRepos.length >= MAX_SOURCE_REPOS}
              >
                + Add Source Repository ({sourceRepos.length}/{MAX_SOURCE_REPOS})
              </AddSourceButton>
            )}
            
            {errors.sourceRepos && (
              <div style={{ color: '#f85149', marginTop: '10px' }}>
                {errors.sourceRepos}
              </div>
            )}
          </>
        );
      case 3:
        return (
          <>
            <StepTitle>Select Files and Configure Paths</StepTitle>
            
            {sourceRepos.filter(Boolean).map((repo, index) => (
              <SourceRepoContainer key={repo.id}>
                <SourceRepoHeader>
                  <SourceRepoTitle>{repo.name}</SourceRepoTitle>
                </SourceRepoHeader>
                
                <FileSelector
                  repository={repo}
                  octokit={octokit}
                  selectedItems={selectedItems[repo.id] || []}
                  onSelect={(items) => handleSelectItems(repo.id, items)}
                />
                
                {errors[`items_${repo.id}`] && (
                  <div style={{ color: '#f85149', marginBottom: '10px' }}>
                    {errors[`items_${repo.id}`]}
                  </div>
                )}
                
                <PathConfigurator
                  label={`Target Path in ${targetRepo?.name}`}
                  path={targetPaths[repo.id] || ''}
                  onChange={(path) => handleUpdateTargetPath(repo.id, path)}
                  helperText="Specify where files should be placed in the target repository."
                  error={errors[`path_${repo.id}`]}
                  placeholder={`${repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`}
                />
              </SourceRepoContainer>
            ))}
          </>
        );
      case 4:
        return (
          <>
            <StepTitle>Review and Confirm</StepTitle>
            
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ color: '#f0f6fc', marginBottom: '10px' }}>Target Repository:</h5>
              <div style={{ padding: '10px', backgroundColor: '#161b22', borderRadius: '6px', color: '#c9d1d9' }}>
                {targetRepo?.full_name}
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <h5 style={{ color: '#f0f6fc', marginBottom: '10px' }}>Selected Items ({getTotalSelectedItems()}):</h5>
              <div style={{ maxHeight: '200px', overflow: 'auto', backgroundColor: '#161b22', borderRadius: '6px' }}>
                {sourceRepos.filter(Boolean).map(repo => {
                  const items = selectedItems[repo.id] || [];
                  return items.map((item, i) => (
                    <SummaryItem key={`${repo.id}-${i}`}>
                      <SummaryIcon>{item.type === 'dir' ? '📁' : '📄'}</SummaryIcon>
                      <SummaryContent>
                        <SummaryPath>{item.path}</SummaryPath>
                        <SummarySource>From: {repo.name}</SummarySource>
                        <SummaryTarget>To: {targetRepo?.name}/{targetPaths[repo.id]}/{item.path.split('/').pop()}</SummaryTarget>
                      </SummaryContent>
                    </SummaryItem>
                  ));
                })}
              </div>
            </div>
            
            <CommitMessageInput>
              <label htmlFor="commitMessage">Commit Message:</label>
              <textarea
                id="commitMessage"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe the changes being made"
              />
              {errors.commitMessage && (
                <div style={{ color: '#f85149', marginTop: '6px' }}>
                  {errors.commitMessage}
                </div>
              )}
            </CommitMessageInput>
            
            <WarningBox>
              <strong>Note:</strong> This operation will copy the current content only, without preserving commit history. This is not equivalent to Git's merge or rebase operations.
            </WarningBox>
          </>
        );
      case 5:
        return (
          <>
            <StepTitle>Consolidating Repositories</StepTitle>
            
            <ProgressContainer>
              <ProgressBar>
                <ProgressFill progress={progress} />
              </ProgressBar>
              <ProgressText>
                <span>{progress}% Complete</span>
                <span>{getTotalSelectedItems()} items</span>
              </ProgressText>
            </ProgressContainer>
            
            <StatusMessage>{status}</StatusMessage>
          </>
        );
      default:
        return null;
    }
  };
  
  // Don't render if modal is not open
  if (!isOpen) {
    return null;
  }
  
  return (
    <ModalOverlay>
      <ModalContent>
        <ModalHeader>
          <h3>Consolidate Repositories</h3>
          <CloseButton onClick={onClose}>&times;</CloseButton>
        </ModalHeader>
        
        <ModalBody>
          <StepIndicator>
            {[1, 2, 3, 4, 5].map(i => (
              <StepDot 
                key={i} 
                active={i === step}
                completed={i < step}
              />
            ))}
          </StepIndicator>
          
          {renderStepContent()}
        </ModalBody>
        
        <ModalFooter>
          <ButtonGroup>
            {step > 1 && step < 5 && !isProcessing && (
              <SecondaryButton onClick={handleBack}>
                Back
              </SecondaryButton>
            )}
          </ButtonGroup>
          
          <ButtonGroup>
            <SecondaryButton onClick={onClose} disabled={isProcessing}>
              Cancel
            </SecondaryButton>
            
            {step < 5 && (
              <PrimaryButton onClick={handleNext} disabled={isProcessing}>
                {step === 4 ? 'Consolidate' : 'Next'}
              </PrimaryButton>
            )}
          </ButtonGroup>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default ConsolidateModal;
