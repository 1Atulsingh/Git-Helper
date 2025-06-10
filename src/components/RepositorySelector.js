// RepositorySelector.js - Add to src/components directory

import React from 'react';
import styled from 'styled-components';

const SelectorContainer = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #f0f6fc;
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  background-color: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  padding-right: 32px;
  
  &:hover, &:focus {
    border-color: #58a6ff;
    outline: none;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HelperText = styled.p`
  margin-top: 6px;
  font-size: 12px;
  color: #8b949e;
`;

const RepositorySelector = ({ 
  label, 
  repositories, 
  selectedRepo, 
  onChange, 
  helperText,
  disabled = false,
  excludeRepos = []
}) => {
  // Filter out excluded repositories
  const filteredRepos = repositories.filter(repo => 
    !excludeRepos.some(excluded => excluded.id === repo.id)
  );
  
  return (
    <SelectorContainer>
      <Label>{label}</Label>
      <Select 
        value={selectedRepo ? selectedRepo.id : ''} 
        onChange={(e) => {
          const selected = filteredRepos.find(repo => repo.id === parseInt(e.target.value));
          onChange(selected);
        }}
        disabled={disabled || filteredRepos.length === 0}
      >
        <option value="">Select a repository</option>
        {filteredRepos.map(repo => (
          <option key={repo.id} value={repo.id}>
            {repo.full_name}
          </option>
        ))}
      </Select>
      {helperText && <HelperText>{helperText}</HelperText>}
    </SelectorContainer>
  );
};

export default RepositorySelector;
